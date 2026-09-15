import { describe, expect, it } from "vitest";

import type {
  GameCommand,
  GameEvent,
  GameObservation,
  PlayerPolicy,
  RunConfig,
} from "../../src/application/contracts.js";
import {
  compareGameplayTraces,
  compareGameplayTracesForDivergence,
  createGameplayExecution,
  type GameplayTrace,
} from "../../src/application/gameplay-execution.js";
import { createBrowserGameplaySession } from "../../src/browser/gameplay-session.js";
import { ORIGINAL_V13_RULESET_ID } from "../../src/domain/rulesets.js";
import { createSimulationRunner } from "../../src/simulation/simulation-runner.js";
import {
  compareGameplayTraceBlock,
  COMPATIBILITY_CHECKPOINT_BLOCK_SIZE,
} from "../helpers/compatibility-corpus.js";
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

function createDiagnosticSession(sessionConfig: RunConfig = config) {
  return createBrowserGameplaySession(
    gameplayEngine,
    sessionConfig,
    undefined,
    {
      retainDiagnostics: true,
    },
  );
}

describe("gameplay diagnostics", () => {
  it("retains diagnostics only when explicitly enabled", () => {
    const ordinary = createGameplayExecution(gameplayEngine, config);
    ordinary.dispatch(noCommands);

    expect(() => ordinary.readDiagnostics()).toThrowError(
      "Gameplay diagnostics were not retained",
    );

    const retained = createGameplayExecution(gameplayEngine, config, {
      retainDiagnostics: true,
    });
    retained.dispatch(noCommands);

    expect(retained.readDiagnostics().checkpoints).toHaveLength(2);
  });

  it("isolates mutable commands and freezes policy and checkpoint values", () => {
    const execution = createGameplayExecution(gameplayEngine, config, {
      retainDiagnostics: true,
    });
    const command = { type: "dismiss-tutorial" as const };
    const commands: GameCommand[] = [command];
    const checkpoint = execution.dispatch(commands);

    commands[0] = { type: "toggle-pause" };
    expect(checkpoint.commands).toEqual([{ type: "dismiss-tutorial" }]);
    expect(checkpoint.commands).not.toBe(commands);
    expect(checkpoint.commands[0]).not.toBe(command);
    expect(Object.isFrozen(checkpoint.commands)).toBe(true);
    expect(Object.isFrozen(checkpoint.commands[0])).toBe(true);
    expect(Object.isFrozen(checkpoint.state)).toBe(true);
    expect(Object.isFrozen(checkpoint.state.player)).toBe(true);
    expect(Object.isFrozen(checkpoint.observation)).toBe(true);
    expect(Object.isFrozen(checkpoint.observation.player)).toBe(true);
    expect(Object.isFrozen(checkpoint.events)).toBe(true);
    expect(Object.isFrozen(checkpoint.events[0])).toBe(true);

    expect(() =>
      (checkpoint.commands as GameCommand[]).push({ type: "toggle-pause" }),
    ).toThrow();
    expect(() => Object.assign(checkpoint.state.player, { gold: 0 })).toThrow();
    expect(() =>
      Object.assign(checkpoint.observation.player, { gold: 0 }),
    ).toThrow();
    expect(() =>
      (checkpoint.events as GameEvent[]).push({
        type: "step-advanced",
        step: 99,
      }),
    ).toThrow();

    const observedInputs: Array<{
      observation: Readonly<GameObservation>;
      events: readonly GameEvent[];
    }> = [];
    const policy: PlayerPolicy = {
      descriptor: { id: "mutation-attempt", version: "1", config: {} },
      createAgent: () => ({
        decide(observation, events) {
          observedInputs.push({ observation, events });
          expect(() =>
            Object.assign(observation.player, { gold: 0 }),
          ).toThrow();
          expect(() =>
            (events as GameEvent[]).push({
              type: "step-advanced",
              step: 99,
            }),
          ).toThrow();
          return noCommands;
        },
      }),
    };
    const traces: GameplayTrace[] = [];
    createSimulationRunner(gameplayEngine, {
      onTrace: (trace) => traces.push(trace),
    }).run({ config, policy, maxSteps: 1 });

    expect(observedInputs).toHaveLength(1);
    expect(traces[0]?.checkpoints[1]?.state.score).toBe(0);
  });

  it("records equal browser and headless checkpoints for one command schedule", () => {
    const browser = createDiagnosticSession();
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
      "sha256-v1:29221607eb3e5fbe36b1100c2746825f35bd8ecb2d7369f49a95b84a23d90070",
      "sha256-v1:4110c42aaf9a3c0a6b077ebe0d35e7c5b234a80d8fca2249065c9c71a244d920",
      "sha256-v1:abb6fca0bffc4fc3e4a9d4e77eb9d711edd664ad23275f8270ff29da28e059fa",
      "sha256-v1:ba5e4f6f541ff02372d4c07235f834ab1bb9889aed3de9c15107aff9601a29ec",
    ]);
    expect(browserTrace.traceHash).toBe(
      "sha256-v1:355069f10719a483a4e136e185840ac88e37f083a159b0f4f6ee1eabacb837c0",
    );
    expect(compareGameplayTraces(browserTrace, headlessTrace)).toEqual({
      equal: true,
    });
  });

  it("records equal browser and policy observations during active running", () => {
    const browser = createDiagnosticSession();
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
    const session = createDiagnosticSession();
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

  it("reports a late checkpoint field before a deferred trace hash", () => {
    const session = createDiagnosticSession();
    for (let step = 0; step <= COMPATIBILITY_CHECKPOINT_BLOCK_SIZE; step += 1) {
      session.dispatch(noCommands);
    }

    const expected = session.readDiagnostics();
    const changedCheckpoint =
      expected.checkpoints[COMPATIBILITY_CHECKPOINT_BLOCK_SIZE];
    if (changedCheckpoint === undefined) {
      throw new Error("Expected a late checkpoint");
    }

    const actual = {
      schemaVersion: expected.schemaVersion,
      config: expected.config,
      checkpoints: [
        ...expected.checkpoints.slice(0, COMPATIBILITY_CHECKPOINT_BLOCK_SIZE),
        {
          ...changedCheckpoint,
          state: { ...changedCheckpoint.state, steps: 99 },
        },
        ...expected.checkpoints.slice(COMPATIBILITY_CHECKPOINT_BLOCK_SIZE + 1),
      ],
    };

    expect(
      compareGameplayTraceBlock(
        expected,
        {
          ...actual,
          checkpoints: actual.checkpoints.slice(
            0,
            COMPATIBILITY_CHECKPOINT_BLOCK_SIZE,
          ),
        },
        0,
      ),
    ).toEqual({ equal: true });
    expect(
      compareGameplayTraceBlock(
        expected,
        {
          ...actual,
          checkpoints: actual.checkpoints.slice(
            COMPATIBILITY_CHECKPOINT_BLOCK_SIZE,
          ),
        },
        COMPATIBILITY_CHECKPOINT_BLOCK_SIZE,
      ),
    ).toEqual({
      equal: false,
      difference: {
        path: "checkpoints[0].state.steps",
        expected: COMPATIBILITY_CHECKPOINT_BLOCK_SIZE,
        actual: 99,
      },
    });
  });

  it("reports the first command, state, observation, event, or RNG difference", () => {
    const session = createDiagnosticSession();
    session.dispatch(noCommands);
    const expected = session.readDiagnostics();

    const cases = [
      {
        label: "command",
        actual: {
          ...expected,
          checkpoints: [
            expected.checkpoints[0]!,
            {
              ...expected.checkpoints[1]!,
              commands: [{ type: "dismiss-tutorial" }],
            },
          ],
        },
        expectedDifference: {
          step: 1,
          kind: "command",
          path: "checkpoints[1].commands.length",
          expected: 0,
          actual: 1,
        },
      },
      {
        label: "state",
        actual: {
          ...expected,
          checkpoints: [
            expected.checkpoints[0]!,
            {
              ...expected.checkpoints[1]!,
              state: { ...expected.checkpoints[1]!.state, score: 99 },
            },
          ],
        },
        expectedDifference: {
          step: 1,
          kind: "state",
          path: "checkpoints[1].state.score",
          expected: 0,
          actual: 99,
        },
      },
      {
        label: "observation",
        actual: {
          ...expected,
          checkpoints: [
            expected.checkpoints[0]!,
            {
              ...expected.checkpoints[1]!,
              observation: {
                ...expected.checkpoints[1]!.observation,
                score: 99,
              },
            },
          ],
        },
        expectedDifference: {
          step: 1,
          kind: "observation",
          path: "checkpoints[1].observation.score",
          expected: 0,
          actual: 99,
        },
      },
      {
        label: "event",
        actual: {
          ...expected,
          checkpoints: [
            expected.checkpoints[0]!,
            {
              ...expected.checkpoints[1]!,
              events: [{ type: "step-advanced", step: 99 }],
            },
          ],
        },
        expectedDifference: {
          step: 1,
          kind: "event",
          path: "checkpoints[1].events[0].step",
          expected: 1,
          actual: 99,
        },
      },
      {
        label: "random",
        actual: {
          ...expected,
          checkpoints: [
            expected.checkpoints[0]!,
            {
              ...expected.checkpoints[1]!,
              state: {
                ...expected.checkpoints[1]!.state,
                random: {
                  ...expected.checkpoints[1]!.state.random,
                  state: expected.checkpoints[1]!.state.random.state + 1,
                },
              },
            },
          ],
        },
        expectedDifference: {
          step: 1,
          kind: "random",
          path: "checkpoints[1].state.random.state",
          expected: expected.checkpoints[1]!.state.random.state,
          actual: expected.checkpoints[1]!.state.random.state + 1,
        },
      },
    ] as const;

    for (const testCase of cases) {
      expect(
        compareGameplayTracesForDivergence(expected, testCase.actual),
        testCase.label,
      ).toMatchObject({
        identityDifferences: [],
        incompatibleDifference: null,
        behavioralDifference: testCase.expectedDifference,
      });
    }
  });

  it("compares the shared prefix before reporting unequal termination and separates ruleset identity", () => {
    const session = createDiagnosticSession();
    session.dispatch(noCommands);
    session.dispatch(noCommands);
    const expected = session.readDiagnostics();
    const shorter = {
      ...expected,
      checkpoints: expected.checkpoints.slice(0, 2),
    };

    expect(compareGameplayTracesForDivergence(expected, shorter)).toMatchObject(
      {
        identityDifferences: [],
        incompatibleDifference: null,
        behavioralDifference: {
          step: 2,
          kind: "termination",
          path: "checkpoints.length",
          expected: 3,
          actual: 2,
        },
      },
    );

    const identityOnly: GameplayTrace = {
      ...expected,
      config: { ...expected.config, ruleset: "candidate-v1" },
      checkpoints: expected.checkpoints.map((checkpoint) => ({
        ...checkpoint,
        state: { ...checkpoint.state, ruleset: "candidate-v1" },
        observation: { ...checkpoint.observation, ruleset: "candidate-v1" },
      })),
      traceHash: "candidate-trace",
    };

    expect(compareGameplayTracesForDivergence(expected, identityOnly)).toEqual({
      identityDifferences: [
        {
          path: "config.ruleset",
          expected: ORIGINAL_V13_RULESET_ID,
          actual: "candidate-v1",
        },
      ],
      incompatibleDifference: null,
      behavioralDifference: null,
    });
  });

  it("reports an initial-state difference at logical step zero", () => {
    const session = createDiagnosticSession();
    const expected = session.readDiagnostics();
    const actual = {
      ...expected,
      checkpoints: [
        {
          ...expected.checkpoints[0]!,
          state: { ...expected.checkpoints[0]!.state, score: 99 },
        },
      ],
    };

    expect(compareGameplayTracesForDivergence(expected, actual)).toMatchObject({
      behavioralDifference: {
        step: 0,
        kind: "state",
        path: "checkpoints[0].state.score",
        expected: 0,
        actual: 99,
      },
    });
  });
});
