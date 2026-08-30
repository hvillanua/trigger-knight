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
      "sha256-v1:312d2fe9876a5d7b4b533fcf4714b319204aa7a108839c3ec233a6e152762f1f",
      "sha256-v1:79474ebbf8344a15e8192cf7af6de8d078ad0f8ba8da817b48f87f8f25b4a8ec",
      "sha256-v1:ec3f85797a56a10b24a56e364b5e9e13354492f137257bf15891350d8c763759",
      "sha256-v1:e95882f9f8a523a8a01df51e15690ed965b95bbaf3c341fbc4616cec58fa5eeb",
    ]);
    expect(browserTrace.traceHash).toBe(
      "sha256-v1:6db942585052ea470ad5e13c3362718e6ed9835d991f3d73ba246b8e587fae93",
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
