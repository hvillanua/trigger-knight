import { describe, expect, it } from "vitest";

import type {
  GameCommand,
  PlayerPolicy,
  RunConfig,
} from "../../src/application/contracts.js";
import {
  compareGameplayTraces,
  type GameplayTrace,
} from "../../src/application/gameplay-execution.js";
import { createBrowserGameplaySession } from "../../src/browser/gameplay-session.js";
import { ORIGINAL_V13_RULESET_ID } from "../../src/domain/rulesets.js";
import { createSimulationRunner } from "../../src/simulation/simulation-runner.js";
import { createTestGameplayEngine } from "../helpers/gameplay-engine.js";

const gameplayEngine = createTestGameplayEngine();

const config: RunConfig = Object.freeze({
  ruleset: ORIGINAL_V13_RULESET_ID,
  seed: "parity-seed",
  initialProfile: Object.freeze({ schemaVersion: 1, scoreMultiplier: 1 }),
});

const noCommands: readonly GameCommand[] = Object.freeze([]);

const noCommandPolicy: PlayerPolicy = Object.freeze({
  descriptor: Object.freeze({
    id: "no-commands",
    version: "1",
    config: Object.freeze({}),
  }),
  createAgent: () =>
    Object.freeze({
      decide: () => noCommands,
    }),
});

describe("gameplay diagnostics", () => {
  it("records equal browser and headless checkpoints for one command schedule", () => {
    const browser = createBrowserGameplaySession(gameplayEngine, config);
    const browserResults = Array.from({ length: 3 }, () =>
      browser.dispatch(noCommands),
    );
    const headlessTraces: GameplayTrace[] = [];
    const runner = createSimulationRunner(gameplayEngine, {
      onTrace: (trace) => headlessTraces.push(trace),
    });

    runner.run({ config, policy: noCommandPolicy, maxSteps: 3 });

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
      "sha256-v1:135dc952a5e09d50f6cec5d21de9df8538b5157af229c1a22a468eaa761c8182",
      "sha256-v1:5170a3a1cde542f80099539726c626749f37e3aeb6e30462e08955fa8df9ab9d",
      "sha256-v1:1af0e7609964328755456ee902911d819d5e3e1c63c320a1638578015a49ed27",
      "sha256-v1:6f30ea1280760a1f86215a3b97d573054ae81f20d84a3f82fb0c5cc51bdfa43e",
    ]);
    expect(browserTrace.traceHash).toBe(
      "sha256-v1:49e5f75bd9d013b53b02d56002df4fdbf41e377eba42bbb0f2ffe2300b8df870",
    );
    expect(compareGameplayTraces(browserTrace, headlessTrace)).toEqual({
      equal: true,
    });
  });

  it("records equal browser and policy observations during active running", () => {
    const browser = createBrowserGameplaySession(gameplayEngine, config);
    browser.dispatch([{ type: "dismiss-tutorial" }]);
    for (let step = 1; step < 62; step += 1) {
      browser.dispatch(noCommands);
    }

    const traces: GameplayTrace[] = [];
    const policy: PlayerPolicy = {
      descriptor: { id: "dismiss-once", version: "1", config: {} },
      createAgent: () => {
        let firstDecision = true;

        return {
          decide: () => {
            if (firstDecision) {
              firstDecision = false;
              return [{ type: "dismiss-tutorial" }];
            }

            return noCommands;
          },
        };
      },
    };
    const runner = createSimulationRunner(gameplayEngine, {
      onTrace: (trace) => traces.push(trace),
    });
    runner.run({ config, policy, maxSteps: 62 });

    const browserTrace = browser.readDiagnostics();
    const headlessTrace = traces[0];
    if (headlessTrace === undefined) {
      throw new Error("Expected one headless diagnostic trace");
    }

    expect(compareGameplayTraces(browserTrace, headlessTrace)).toEqual({
      equal: true,
    });
    expect(browserTrace.checkpoints.at(-1)?.observation).toMatchObject({
      activeTicks: 2,
      movementSpeed: 2,
      distance: 3,
      day: 1,
      score: 30,
    });
  });

  it("identifies the first structured field that differs", () => {
    const session = createBrowserGameplaySession(gameplayEngine, config);
    session.dispatch(noCommands);
    session.dispatch(noCommands);
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
