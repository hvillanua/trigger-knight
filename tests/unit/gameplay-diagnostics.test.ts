import { describe, expect, it } from "vitest";

import type {
  GameCommand,
  PlayerPolicy,
  RunConfig,
} from "../../src/application/contracts.js";
import {
  gameplayEngine,
  WALKING_SKELETON_RULESET_ID,
} from "../../src/application/gameplay-engine.js";
import {
  compareGameplayTraces,
  type GameplayTrace,
} from "../../src/application/gameplay-execution.js";
import { createBrowserGameplaySession } from "../../src/browser/gameplay-session.js";
import { createSimulationRunner } from "../../src/simulation/simulation-runner.js";

const config: RunConfig = Object.freeze({
  ruleset: WALKING_SKELETON_RULESET_ID,
  seed: "parity-seed",
  initialProfile: Object.freeze({ schemaVersion: 1 }),
});

const advanceCommands: readonly GameCommand[] = Object.freeze([
  Object.freeze({ type: "advance" }),
]);

const advancePolicy: PlayerPolicy = Object.freeze({
  descriptor: Object.freeze({
    id: "advance-every-step",
    version: "1",
    config: Object.freeze({}),
  }),
  createAgent: () =>
    Object.freeze({
      decide: () => advanceCommands,
    }),
});

describe("gameplay diagnostics", () => {
  it("records equal browser and headless checkpoints for one command schedule", () => {
    const browser = createBrowserGameplaySession(gameplayEngine, config);
    const browserResults = Array.from({ length: 3 }, () =>
      browser.dispatch(advanceCommands),
    );
    const headlessTraces: GameplayTrace[] = [];
    const runner = createSimulationRunner(gameplayEngine, {
      onTrace: (trace) => headlessTraces.push(trace),
    });

    runner.run({ config, policy: advancePolicy, maxSteps: 3 });

    const browserTrace = browser.readDiagnostics();
    const headlessTrace = headlessTraces[0];
    if (headlessTrace === undefined) {
      throw new Error("Expected one headless diagnostic trace");
    }

    expect(browserTrace).toEqual(headlessTrace);
    expect(browserResults).toEqual(
      browserTrace.checkpoints.slice(1).map(({ observation, events }) => ({
        observation,
        events,
      })),
    );
    expect(
      browserTrace.checkpoints.map(({ checkpointHash }) => checkpointHash),
    ).toEqual([
      "sha256-v1:cee0c8788c72d14baaac6abf2b24f24ab139b43c576b8a882f8f1704c0e66def",
      "sha256-v1:5631aea00347a70cfe02daed09883c0be4e2379b47e46e9847b2982061d22ff7",
      "sha256-v1:1158b4d0d78f2bcf811e8c10e1d90a0598c1d98c84dcb229650dad3179fb128c",
      "sha256-v1:582cda6a52f1629c5c80ebbae27cc88d14bb8763a1be725389850939a5aa0a75",
    ]);
    expect(browserTrace.traceHash).toBe(
      "sha256-v1:36d4126c8be153f6ce8b3a44fd7b465a7a032be566e25c526dd38d1b85b0d772",
    );
    expect(compareGameplayTraces(browserTrace, headlessTrace)).toEqual({
      equal: true,
    });
  });

  it("identifies the first structured field that differs", () => {
    const session = createBrowserGameplaySession(gameplayEngine, config);
    session.dispatch(advanceCommands);
    session.dispatch(advanceCommands);
    const expected = session.readDiagnostics();
    const changedCheckpoint = expected.checkpoints[1];

    if (changedCheckpoint === undefined) {
      throw new Error("Expected a stepped checkpoint");
    }

    const actual: GameplayTrace = {
      ...expected,
      checkpoints: [
        expected.checkpoints[0]!,
        {
          ...changedCheckpoint,
          state: { ...changedCheckpoint.state, steps: 99 },
        },
        ...expected.checkpoints.slice(2),
      ],
    };

    expect(compareGameplayTraces(expected, actual)).toEqual({
      equal: false,
      difference: {
        path: "checkpoints[1].state.steps",
        expected: 1,
        actual: 99,
      },
    });
  });
});
