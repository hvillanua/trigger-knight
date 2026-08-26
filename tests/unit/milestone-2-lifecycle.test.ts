import { describe, expect, it } from "vitest";

import { fingerprintCanonicalJson } from "../../src/application/canonical-json.js";
import type {
  GameplayCheckpoint,
  GameplayTrace,
  RunState,
} from "../../src/application/contracts.js";
import { createSimulationRunner } from "../../src/simulation/simulation-runner.js";
import { createTestGameplayEngine } from "../helpers/gameplay-engine.js";
import {
  ORIGINAL_LIFECYCLE_TERMINAL_STEP,
  originalLifecycleConfig,
  originalLifecyclePolicy,
  runOriginalLifecycleScenario,
} from "../helpers/original-lifecycle.js";

const gameplayEngine = createTestGameplayEngine();

function requireCheckpoint(
  trace: GameplayTrace,
  predicate: (checkpoint: GameplayCheckpoint) => boolean,
  label: string,
): GameplayCheckpoint {
  const checkpoint = trace.checkpoints.find(predicate);

  if (checkpoint === undefined) {
    throw new Error(`Missing ${label} checkpoint`);
  }

  return checkpoint;
}

function restoreState(state: Readonly<RunState>): RunState {
  return JSON.parse(JSON.stringify(state)) as RunState;
}

describe("Milestone 2 original lifecycle", () => {
  it("matches browser-session and headless execution through lifespan death", () => {
    const browserTrace = runOriginalLifecycleScenario(gameplayEngine);
    const headlessTraces: GameplayTrace[] = [];
    const runner = createSimulationRunner(gameplayEngine, {
      onTrace: (trace) => headlessTraces.push(trace),
    });
    const request = {
      config: originalLifecycleConfig,
      policy: originalLifecyclePolicy,
      maxSteps: 3_000,
    };

    const result = runner.run(request);
    const repeated = runner.run(request);
    const headlessTrace = headlessTraces[0];
    if (headlessTrace === undefined) {
      throw new Error("Expected a headless lifecycle trace");
    }

    expect(browserTrace).toEqual(headlessTrace);
    expect(browserTrace.traceHash).toBe(
      "sha256-v1:1df71a75867b64933bfcbe613956443dc4eb9d4b9e916aa2842a30fb465f3cf8",
    );
    expect(browserTrace.checkpoints).toHaveLength(
      ORIGINAL_LIFECYCLE_TERMINAL_STEP + 1,
    );
    expect(browserTrace.checkpoints[1]).toMatchObject({
      state: {
        steps: 1,
        activeTicks: 0,
        lifespan: { whole: 99, fraction: 99 },
        lifecycle: { tutorialPage: 0, pregameStepsRemaining: 60 },
      },
      events: [{ type: "step-advanced", step: 1 }],
    });
    expect(browserTrace.checkpoints[61]).toMatchObject({
      state: {
        steps: 61,
        activeTicks: 0,
        lifecycle: { tutorialPage: null, pregameStepsRemaining: 0 },
      },
    });
    expect(browserTrace.checkpoints[71]).toMatchObject({
      state: {
        activeTicks: 10,
        movementSpeed: 10,
        distance: 55,
        score: 550,
        lifespan: { whole: 99, fraction: 59 },
      },
    });
    for (const index of [72, 73, 74]) {
      expect(browserTrace.checkpoints[index]).toMatchObject({
        state: {
          activeTicks: 10,
          movementSpeed: 10,
          distance: 55,
          score: 550,
          lifespan: { whole: 99, fraction: 59 },
          lifecycle: { paused: true },
        },
      });
    }
    expect(browserTrace.checkpoints[75]).toMatchObject({
      state: {
        activeTicks: 11,
        movementSpeed: 11,
        distance: 66,
        score: 660,
        lifespan: { whole: 99, fraction: 55 },
        lifecycle: { paused: false },
      },
      events: [
        { type: "pause-toggled", paused: false },
        { type: "step-advanced", step: 75 },
      ],
    });

    const terminal = browserTrace.checkpoints.at(-1);
    expect(terminal).toMatchObject({
      index: ORIGINAL_LIFECYCLE_TERMINAL_STEP,
      state: {
        steps: ORIGINAL_LIFECYCLE_TERMINAL_STEP,
        activeTicks: 2_500,
        lifecycle: { phase: "ended", terminalReason: "lifespan" },
      },
      observation: {
        activeTicks: 2_500,
        lifecycle: { phase: "ended", terminalReason: "lifespan" },
      },
      events: [
        { type: "step-advanced", step: ORIGINAL_LIFECYCLE_TERMINAL_STEP },
        { type: "lifespan-death" },
        { type: "run-ended", reason: "lifespan" },
      ],
    });
    expect(terminal?.checkpointHash).toBe(
      "sha256-v1:3fb10f49dfe2d0e62546457d1c87ded5d78f93df9292dea2bf02d3bb5759dd5e",
    );
    expect(result).toMatchObject({
      steps: ORIGINAL_LIFECYCLE_TERMINAL_STEP,
      activeTicks: 2_500,
      terminalReason: "lifespan",
      score: 373_950,
      day: 6,
      distance: 37_395,
    });
    expect(repeated).toEqual(result);
    expect(result.traceHash).toBe(
      "sha256-v1:914d7f0236b4babd1316deffa6f70cd499dedc78db495449306b1a0179b3d944",
    );
    expect(repeated.traceHash).toBe(result.traceHash);
  });

  it("continues identically from serialized lifecycle and lifespan checkpoints", () => {
    const uninterrupted = runOriginalLifecycleScenario(gameplayEngine);
    const boundaries = [
      requireCheckpoint(
        uninterrupted,
        ({ state }) => state.lifecycle.tutorialPage === 0 && state.steps === 1,
        "tutorial gate",
      ),
      requireCheckpoint(
        uninterrupted,
        ({ state }) =>
          state.lifecycle.pregameStepsRemaining === 0 &&
          state.activeTicks === 0,
        "pregame completion",
      ),
      requireCheckpoint(
        uninterrupted,
        ({ state }) => state.lifecycle.paused && state.steps === 72,
        "pause gate",
      ),
      requireCheckpoint(
        uninterrupted,
        ({ state }) =>
          state.lifespan.whole === 98 && state.lifespan.fraction === 99,
        "lifespan fraction carry",
      ),
      requireCheckpoint(
        uninterrupted,
        ({ state }) =>
          state.activeTicks === 2_499 && state.lifespan.whole === 0,
        "pre-death lifespan",
      ),
    ];
    const expectedTerminal = uninterrupted.checkpoints.at(-1);
    if (expectedTerminal === undefined) {
      throw new Error("Expected a terminal checkpoint");
    }

    for (const boundary of boundaries) {
      let state = restoreState(boundary.state);
      let finalEvents = boundary.events;

      for (const expected of uninterrupted.checkpoints.slice(
        boundary.index + 1,
      )) {
        const transition = gameplayEngine.step(state, expected.commands);
        state = transition.state;
        finalEvents = transition.events;
      }

      const observation = gameplayEngine.observe(state);
      const checkpointPayload = {
        index: expectedTerminal.index,
        commands: expectedTerminal.commands,
        state,
        observation,
        events: finalEvents,
      };

      expect(state).toEqual(expectedTerminal.state);
      expect(observation).toEqual(expectedTerminal.observation);
      expect(finalEvents).toEqual(expectedTerminal.events);
      expect(fingerprintCanonicalJson(checkpointPayload)).toBe(
        expectedTerminal.checkpointHash,
      );
    }
  });
});
