import { describe, expect, it } from "vitest";

import type { RunConfig, RunState } from "../../src/application/contracts.js";
import { ORIGINAL_V13_RULESET_ID } from "../../src/domain/rulesets.js";
import { createTestGameplayEngine } from "../helpers/gameplay-engine.js";

const gameplayEngine = createTestGameplayEngine();

function createRun(scoreMultiplier = 1): RunState {
  const initialLevelOneProfile = {
    schemaVersion: 1,
    level: 1,
    scoreMultiplier,
  };
  const config: RunConfig = {
    ruleset: ORIGINAL_V13_RULESET_ID,
    seed: "running-progression-seed",
    initialProfile: initialLevelOneProfile,
  };

  return gameplayEngine.createRun(config);
}

function stepMany(state: RunState, count: number): RunState {
  let current = state;

  for (let index = 0; index < count; index += 1) {
    current = gameplayEngine.step(current, []).state;
  }

  return current;
}

function finishPregame(state: RunState): RunState {
  const dismissed = gameplayEngine.step(state, [
    { type: "dismiss-tutorial" },
  ]).state;

  return stepMany(dismissed, 59);
}

describe("original-v1.3 running progression", () => {
  it("starts with the confirmed public running values", () => {
    const state = createRun();

    expect(state).toMatchObject({
      movementSpeed: 0,
      distance: 0,
      day: 1,
      score: 0,
    });
    expect(gameplayEngine.observe(state)).toMatchObject({
      movementSpeed: 0,
      distance: 0,
      day: 1,
      score: 0,
    });
  });

  it("accelerates before moving and caps movement speed at 15", () => {
    let state = finishPregame(createRun());

    for (let activeTick = 1; activeTick <= 20; activeTick += 1) {
      const previous = state;
      state = gameplayEngine.step(state, []).state;
      const expectedSpeed = Math.min(activeTick, 15);
      const expectedDistance =
        activeTick <= 15
          ? (activeTick * (activeTick + 1)) / 2
          : 120 + (activeTick - 15) * 15;

      expect(state).toMatchObject({
        movementSpeed: expectedSpeed,
        distance: expectedDistance,
        score: expectedDistance * 10,
      });
      expect(previous).not.toBe(state);
      expect(Object.isFrozen(state)).toBe(true);
    }
  });

  it("derives the observed day from authoritative distance", () => {
    const beforeBoundary = stepMany(finishPregame(createRun()), 473);

    expect(beforeBoundary).toMatchObject({ distance: 6_990, day: 1 });
    expect(gameplayEngine.observe(beforeBoundary)).toMatchObject({
      distance: 6_990,
      day: 1,
    });

    const afterBoundary = gameplayEngine.step(beforeBoundary, []).state;

    expect(afterBoundary).toMatchObject({ distance: 7_005, day: 2 });
    expect(gameplayEngine.observe(afterBoundary)).toMatchObject({
      distance: 7_005,
      day: 2,
    });
  });

  it("uses the explicit profile multiplier without deriving it from level", () => {
    const initial = createRun(1);
    const firstActiveTick = gameplayEngine.step(
      finishPregame(initial),
      [],
    ).state;

    expect(firstActiveTick).toMatchObject({
      movementSpeed: 1,
      distance: 1,
      score: 10,
    });

    const multiplied = gameplayEngine.step(
      finishPregame(createRun(1.25)),
      [],
    ).state;

    expect(multiplied.score).toBe(12.5);
  });

  it("freezes running progression behind every gameplay gate", () => {
    const initial = createRun();
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
    const ended: RunState = {
      ...active,
      lifecycle: { ...active.lifecycle, phase: "ended" },
    };
    const endGated = stepMany(ended, 3);

    for (const gated of [tutorialGated, pregameGated, ready]) {
      expect(gated).toMatchObject({
        movementSpeed: 0,
        distance: 0,
        day: 1,
        score: 0,
      });
    }
    expect(active).toMatchObject({
      movementSpeed: 1,
      distance: 1,
      day: 1,
      score: 10,
    });
    expect(pauseGated).toMatchObject({
      movementSpeed: 1,
      distance: 1,
      day: 1,
      score: 10,
    });
    expect(endGated).toMatchObject({
      movementSpeed: 1,
      distance: 1,
      day: 1,
      score: 10,
    });
  });
});
