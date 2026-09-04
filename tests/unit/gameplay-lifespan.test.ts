import { describe, expect, it } from "vitest";

import type { RunConfig, RunState } from "../../src/application/contracts.js";
import { ORIGINAL_V13_RULESET_ID } from "../../src/domain/rulesets.js";
import { createTestGameplayEngine } from "../helpers/gameplay-engine.js";

const gameplayEngine = createTestGameplayEngine();

const config: RunConfig = Object.freeze({
  ruleset: ORIGINAL_V13_RULESET_ID,
  seed: "lifespan-seed",
  initialProfile: Object.freeze({ schemaVersion: 1, scoreMultiplier: 1 }),
});

function stepMany(state: RunState, count: number): RunState {
  let current = state;

  for (let index = 0; index < count; index += 1) {
    current = gameplayEngine.step(current, []).state;
  }

  return current;
}

function finishPregame(state = gameplayEngine.createRun(config)): RunState {
  const dismissed = gameplayEngine.step(state, [
    { type: "dismiss-tutorial" },
  ]).state;

  return stepMany(dismissed, 59);
}

describe("original-v1.3 lifespan", () => {
  it("starts at the confirmed public 99.99 percent", () => {
    const state = gameplayEngine.createRun(config);

    expect(state).toMatchObject({
      lifespan: { whole: 99, fraction: 99 },
    });
    expect(gameplayEngine.observe(state)).toMatchObject({
      lifespan: { whole: 99, fraction: 99 },
    });
  });

  it("drains four fractional points per active tick and carries at zero", () => {
    const ready = finishPregame();
    const afterOneTick = gameplayEngine.step(ready, []).state;
    const beforeCarry = stepMany(afterOneTick, 23);
    const afterCarry = gameplayEngine.step(beforeCarry, []).state;

    expect(afterOneTick.lifespan).toEqual({ whole: 99, fraction: 95 });
    expect(beforeCarry.lifespan).toEqual({ whole: 99, fraction: 3 });
    expect(afterCarry.lifespan).toEqual({ whole: 98, fraction: 99 });
  });

  it("does not drain behind tutorial, pregame, or pause gates", () => {
    const initial = gameplayEngine.createRun(config);
    const tutorialGated = stepMany(initial, 3);
    const dismissed = gameplayEngine.step(tutorialGated, [
      { type: "dismiss-tutorial" },
    ]).state;
    const pregameGated = stepMany(dismissed, 58);
    const ready = gameplayEngine.step(pregameGated, []).state;
    const active = gameplayEngine.step(ready, []).state;
    const paused = gameplayEngine.step(active, [
      { type: "toggle-pause" },
    ]).state;
    const pauseGated = stepMany(paused, 3);

    for (const gated of [tutorialGated, pregameGated, ready]) {
      expect(gated.lifespan).toEqual({ whole: 99, fraction: 99 });
    }
    expect(active.lifespan).toEqual({ whole: 99, fraction: 95 });
    expect(pauseGated.lifespan).toEqual(active.lifespan);
  });

  it("ends once on the 2,500th active tick", () => {
    const beforeDeath = stepMany(finishPregame(), 2_499);

    expect(beforeDeath).toMatchObject({
      activeTicks: 2_499,
      lifespan: { whole: 0, fraction: 3 },
      lifecycle: { phase: "battling", terminalReason: null },
    });

    const death = gameplayEngine.step(beforeDeath, []);

    expect(death.state).toMatchObject({
      activeTicks: 2_500,
      lifespan: { whole: -1, fraction: 99 },
      lifecycle: { phase: "ended", terminalReason: "lifespan" },
    });
    expect(death.events).toEqual([
      { type: "step-advanced", step: 2_560 },
      { type: "lifespan-death" },
      { type: "run-ended", reason: "lifespan" },
    ]);
    expect(Object.isFrozen(death.state)).toBe(true);
    expect(Object.isFrozen(death.state.lifespan)).toBe(true);
    expect(Object.isFrozen(death.state.lifecycle)).toBe(true);
    expect(Object.isFrozen(death.events)).toBe(true);
    expect(death.events.every(Object.isFrozen)).toBe(true);
    expect(gameplayEngine.observe(death.state)).toMatchObject({
      lifespan: { whole: -1, fraction: 99 },
      lifecycle: {
        phase: "ended",
        terminalReason: "lifespan",
        activeGameplay: false,
      },
      actions: {
        canTogglePause: false,
        canDismissTutorial: false,
        canPurchaseCurrentEncounter: false,
      },
    });

    const afterDeath = gameplayEngine.step(death.state, []);

    expect(afterDeath.state).toMatchObject({
      activeTicks: 2_500,
      lifespan: { whole: -1, fraction: 99 },
      lifecycle: { phase: "ended", terminalReason: "lifespan" },
    });
    expect(afterDeath.events).toEqual([{ type: "step-advanced", step: 2_561 }]);
  });
});
