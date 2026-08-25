import { describe, expect, it } from "vitest";

import type {
  GameCommand,
  RunConfig,
  RunState,
} from "../../src/application/contracts.js";
import { ORIGINAL_V13_RULESET_ID } from "../../src/domain/rulesets.js";
import { createTestGameplayEngine } from "../helpers/gameplay-engine.js";

const gameplayEngine = createTestGameplayEngine();

function createRun(
  initialProfile: RunConfig["initialProfile"] = {
    schemaVersion: 1,
    scoreMultiplier: 1,
  },
): RunState {
  return gameplayEngine.createRun({
    ruleset: ORIGINAL_V13_RULESET_ID,
    seed: "lifecycle-seed",
    initialProfile,
  });
}

function stepMany(state: RunState, count: number): RunState {
  let current = state;

  for (let index = 0; index < count; index += 1) {
    current = gameplayEngine.step(current, []).state;
  }

  return current;
}

describe("original-v1.3 lifecycle", () => {
  it("gates every new run on tutorial page 0 regardless of preference", () => {
    const state = createRun({
      schemaVersion: 1,
      scoreMultiplier: 1,
      tutorialPreference: "disabled",
    });

    expect(state).toMatchObject({
      steps: 0,
      activeTicks: 0,
      lifecycle: {
        phase: "running",
        paused: false,
        tutorialPage: 0,
        pregameStepsRemaining: 60,
      },
    });
    expect(gameplayEngine.observe(state)).toEqual({
      ruleset: ORIGINAL_V13_RULESET_ID,
      steps: 0,
      activeTicks: 0,
      movementSpeed: 0,
      distance: 0,
      day: 1,
      score: 0,
      lifecycle: {
        phase: "running",
        paused: false,
        tutorialPage: 0,
        pregameStepsRemaining: 60,
        activeGameplay: false,
      },
      actions: {
        canTogglePause: true,
        canDismissTutorial: true,
      },
    });
  });

  it("processes pause and tutorial commands while active gameplay is gated", () => {
    const initial = createRun();
    const paused = gameplayEngine.step(initial, [{ type: "toggle-pause" }]);
    const dismissed = gameplayEngine.step(paused.state, [
      { type: "dismiss-tutorial" },
    ]);
    const stillPaused = gameplayEngine.step(dismissed.state, []);

    expect(paused.state).toMatchObject({
      steps: 1,
      activeTicks: 0,
      lifecycle: {
        paused: true,
        tutorialPage: 0,
        pregameStepsRemaining: 60,
      },
    });
    expect(paused.events).toEqual([
      { type: "pause-toggled", paused: true },
      { type: "step-advanced", step: 1 },
    ]);
    expect(dismissed.state).toMatchObject({
      steps: 2,
      activeTicks: 0,
      lifecycle: {
        paused: true,
        tutorialPage: null,
        pregameStepsRemaining: 60,
      },
    });
    expect(dismissed.events).toEqual([
      { type: "tutorial-dismissed", page: 0 },
      { type: "step-advanced", step: 2 },
    ]);
    expect(stillPaused.state).toMatchObject({
      steps: 3,
      activeTicks: 0,
      lifecycle: { pregameStepsRemaining: 60 },
    });
    expect(gameplayEngine.observe(stillPaused.state).actions).toEqual({
      canTogglePause: true,
      canDismissTutorial: false,
    });
  });

  it("uses 60 eligible logical opportunities for pregame before active ticks", () => {
    const dismissal = gameplayEngine.step(createRun(), [
      { type: "dismiss-tutorial" },
    ]);
    const afterSixtyPregameSteps = stepMany(dismissal.state, 59);

    expect(afterSixtyPregameSteps).toMatchObject({
      steps: 60,
      activeTicks: 0,
      lifecycle: { pregameStepsRemaining: 0 },
    });

    const firstActiveTick = gameplayEngine.step(afterSixtyPregameSteps, []);

    expect(firstActiveTick.state).toMatchObject({
      steps: 61,
      activeTicks: 1,
      lifecycle: { pregameStepsRemaining: 0 },
    });
    expect(
      gameplayEngine.observe(firstActiveTick.state).lifecycle,
    ).toMatchObject({ activeGameplay: true });
  });

  it("applies commands before deciding whether the same step is active", () => {
    const commands: readonly GameCommand[] = Object.freeze([
      Object.freeze({ type: "dismiss-tutorial" }),
      Object.freeze({ type: "toggle-pause" }),
      Object.freeze({ type: "toggle-pause" }),
    ]);
    const result = gameplayEngine.step(createRun(), commands);

    expect(result.state).toMatchObject({
      steps: 1,
      activeTicks: 0,
      lifecycle: {
        paused: false,
        tutorialPage: null,
        pregameStepsRemaining: 59,
      },
    });
    expect(result.events).toEqual([
      { type: "tutorial-dismissed", page: 0 },
      { type: "pause-toggled", paused: true },
      { type: "pause-toggled", paused: false },
      { type: "step-advanced", step: 1 },
    ]);
  });

  it("freezes active ticks while paused and resumes on the unpause step", () => {
    const dismissal = gameplayEngine.step(createRun(), [
      { type: "dismiss-tutorial" },
    ]);
    const active = stepMany(dismissal.state, 60);
    const paused = gameplayEngine.step(active, [{ type: "toggle-pause" }]);
    const held = gameplayEngine.step(paused.state, []);
    const resumed = gameplayEngine.step(held.state, [{ type: "toggle-pause" }]);

    expect(active.activeTicks).toBe(1);
    expect(paused.state).toMatchObject({
      activeTicks: 1,
      lifecycle: { paused: true },
    });
    expect(held.state).toMatchObject({ steps: 63, activeTicks: 1 });
    expect(resumed.state).toMatchObject({
      steps: 64,
      activeTicks: 2,
      lifecycle: { paused: false },
    });
  });

  it("keeps ended runs inactive and makes lifecycle commands ineligible", () => {
    const initial = createRun();
    const ended: RunState = {
      ...initial,
      lifecycle: { ...initial.lifecycle, phase: "ended" },
    };
    const result = gameplayEngine.step(ended, [
      { type: "dismiss-tutorial" },
      { type: "toggle-pause" },
    ]);

    expect(result.state).toMatchObject({
      steps: 1,
      activeTicks: 0,
      lifecycle: {
        phase: "ended",
        paused: false,
        tutorialPage: 0,
        pregameStepsRemaining: 60,
      },
    });
    expect(result.events).toEqual([{ type: "step-advanced", step: 1 }]);
    expect(gameplayEngine.observe(result.state).actions).toEqual({
      canTogglePause: false,
      canDismissTutorial: false,
    });
  });
});
