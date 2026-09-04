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
      "sha256-v1:f96a5c7f9c0f30f9935b370f60601e07e139a5ad6972fce21f239f069ea2c5d2",
      "sha256-v1:747230c1ab9e0e3fc2af7112cbb7d6574e79a70a74d578800ad9f1ba935a9259",
      "sha256-v1:ee338edd793bc4bf1cb186c9fdea561529f6849bde61d6ac1d2ecb12bc5d45eb",
      "sha256-v1:b766d40adfb229dd224839d144a93a2d6cfe7aa4b1c58ed42f5feccf6c3df257",
    ]);
    expect(browserTrace.traceHash).toBe(
      "sha256-v1:e82426d12095d64c7d0768d638d1a2ef2ef658e713ecb1e77eaa5d3cde074c46",
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
