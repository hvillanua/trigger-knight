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
      "sha256-v1:1a9de32d68bc2edc0c2c96be260a172a6a9917146cd6421605fe1533e69d3802",
      "sha256-v1:a027e229e23858f465cd4a2fc7e383345a0729d89236d4b50ceb83fd3a7908f4",
      "sha256-v1:e2b6646f8851afd7d803fb85054210c5c466a2d18bb25b5cb1963b0739575e46",
      "sha256-v1:730a0c4f78847c94a8a60980c11deedc7d279767b491677bd782e4f029cb1692",
    ]);
    expect(browserTrace.traceHash).toBe(
      "sha256-v1:cf3b380b23f5d9ba227ec975dacac9ce63620134835d2007c3df103bb5bace5d",
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
