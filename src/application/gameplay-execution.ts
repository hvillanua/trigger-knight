import type {
  GameCommand,
  GameEvent,
  GameObservation,
  RunState,
} from "../domain/contracts.js";
import {
  fingerprintCanonicalJson,
  normalizeCanonicalJson,
} from "./canonical-json.js";
import type { GameplayEngine, RunConfig } from "./gameplay-engine.js";

const GAMEPLAY_TRACE_SCHEMA_VERSION = 2 as const;

export interface GameplayCheckpoint {
  readonly index: number;
  readonly commands: readonly GameCommand[];
  readonly state: Readonly<RunState>;
  readonly observation: Readonly<GameObservation>;
  readonly events: readonly GameEvent[];
  readonly checkpointHash: string;
}

export interface GameplayTrace {
  readonly schemaVersion: typeof GAMEPLAY_TRACE_SCHEMA_VERSION;
  readonly config: Readonly<RunConfig>;
  readonly checkpoints: readonly GameplayCheckpoint[];
  readonly traceHash: string;
}

export interface GameplayTraceDifference {
  readonly path: string;
  readonly expected: unknown;
  readonly actual: unknown;
}

export type GameplayTraceComparison =
  | Readonly<{ equal: true }>
  | Readonly<{
      equal: false;
      difference: GameplayTraceDifference;
    }>;

export interface GameplayExecution {
  dispatch(commands: readonly GameCommand[]): GameplayCheckpoint;
  readCurrentCheckpoint(): GameplayCheckpoint;
  readDiagnostics(): GameplayTrace;
}

export interface GameplayExecutionOptions {
  readonly retainDiagnostics?: boolean;
}

interface CheckpointPayload {
  readonly index: number;
  readonly commands: readonly GameCommand[];
  readonly state: Readonly<RunState>;
  readonly observation: Readonly<GameObservation>;
  readonly events: readonly GameEvent[];
}

function normalizeAs<T>(value: T): T {
  return normalizeCanonicalJson(value) as unknown as T;
}

function payloadFor(checkpoint: GameplayCheckpoint): CheckpointPayload {
  return Object.freeze({
    index: checkpoint.index,
    commands: checkpoint.commands,
    state: checkpoint.state,
    observation: checkpoint.observation,
    events: checkpoint.events,
  });
}

function createCheckpoint(payload: CheckpointPayload): GameplayCheckpoint {
  let checkpointHash: string | undefined;

  return Object.freeze({
    ...payload,
    get checkpointHash(): string {
      checkpointHash ??= fingerprintCanonicalJson(payload);
      return checkpointHash;
    },
  });
}

export function createGameplayExecution(
  engine: GameplayEngine,
  config: RunConfig,
  options: GameplayExecutionOptions = {},
): GameplayExecution {
  const normalizedConfig = normalizeAs(config);
  const retainDiagnostics = options.retainDiagnostics ?? true;
  let state = normalizeAs(engine.createRun(normalizedConfig));
  let observation = normalizeAs(engine.observe(state));
  let currentCheckpoint = createCheckpoint({
    index: 0,
    commands: Object.freeze([]),
    state,
    observation,
    events: Object.freeze([]),
  });
  const checkpoints: GameplayCheckpoint[] = retainDiagnostics
    ? [currentCheckpoint]
    : [];

  const readCurrentCheckpoint = (): GameplayCheckpoint => currentCheckpoint;

  return Object.freeze({
    dispatch(commands: readonly GameCommand[]): GameplayCheckpoint {
      const normalizedCommands = normalizeAs(commands);
      const result = engine.step(state, normalizedCommands);
      state = normalizeAs(result.state);
      observation = normalizeAs(engine.observe(state));
      const checkpoint = createCheckpoint({
        index: currentCheckpoint.index + 1,
        commands: normalizedCommands,
        state,
        observation,
        events: normalizeAs(result.events),
      });
      currentCheckpoint = checkpoint;
      if (retainDiagnostics) {
        checkpoints.push(checkpoint);
      }
      return checkpoint;
    },
    readCurrentCheckpoint,
    readDiagnostics(): GameplayTrace {
      if (!retainDiagnostics) {
        throw new Error("Gameplay diagnostics were not retained");
      }

      const frozenCheckpoints = Object.freeze([...checkpoints]);
      const tracePayload = Object.freeze({
        schemaVersion: GAMEPLAY_TRACE_SCHEMA_VERSION,
        config: normalizedConfig,
        checkpoints: Object.freeze(frozenCheckpoints.map(payloadFor)),
      });

      return Object.freeze({
        ...tracePayload,
        checkpoints: frozenCheckpoints,
        traceHash: fingerprintCanonicalJson(tracePayload),
      });
    },
  });
}

function joinPath(path: string, key: string): string {
  return path === "" ? key : `${path}.${key}`;
}

function findDifference(
  expected: unknown,
  actual: unknown,
  path: string,
): GameplayTraceDifference | undefined {
  if (Object.is(expected, actual)) {
    return undefined;
  }

  if (Array.isArray(expected) && Array.isArray(actual)) {
    const sharedLength = Math.min(expected.length, actual.length);
    for (let index = 0; index < sharedLength; index += 1) {
      const difference = findDifference(
        expected[index],
        actual[index],
        `${path}[${index}]`,
      );
      if (difference !== undefined) {
        return difference;
      }
    }

    if (expected.length !== actual.length) {
      return {
        path: `${path}.length`,
        expected: expected.length,
        actual: actual.length,
      };
    }

    return undefined;
  }

  if (
    expected !== null &&
    actual !== null &&
    typeof expected === "object" &&
    typeof actual === "object" &&
    !Array.isArray(expected) &&
    !Array.isArray(actual)
  ) {
    const expectedRecord = expected as Record<string, unknown>;
    const actualRecord = actual as Record<string, unknown>;
    const keys = [
      ...new Set([...Object.keys(expected), ...Object.keys(actual)]),
    ].sort();

    for (const key of keys) {
      const difference = findDifference(
        expectedRecord[key],
        actualRecord[key],
        joinPath(path, key),
      );
      if (difference !== undefined) {
        return difference;
      }
    }

    return undefined;
  }

  return { path, expected, actual };
}

export function compareGameplayTraces(
  expected: GameplayTrace,
  actual: GameplayTrace,
): GameplayTraceComparison {
  if (expected.schemaVersion !== actual.schemaVersion) {
    return Object.freeze({
      equal: false,
      difference: Object.freeze({
        path: "schemaVersion",
        expected: expected.schemaVersion,
        actual: actual.schemaVersion,
      }),
    });
  }

  const configDifference = findDifference(
    expected.config,
    actual.config,
    "config",
  );
  if (configDifference !== undefined) {
    return Object.freeze({ equal: false, difference: configDifference });
  }

  if (expected.checkpoints.length !== actual.checkpoints.length) {
    return Object.freeze({
      equal: false,
      difference: Object.freeze({
        path: "checkpoints.length",
        expected: expected.checkpoints.length,
        actual: actual.checkpoints.length,
      }),
    });
  }

  const fields = [
    "index",
    "commands",
    "state",
    "observation",
    "events",
  ] as const;
  for (let index = 0; index < expected.checkpoints.length; index += 1) {
    const expectedCheckpoint = expected.checkpoints[index]!;
    const actualCheckpoint = actual.checkpoints[index]!;

    for (const field of fields) {
      const difference = findDifference(
        expectedCheckpoint[field],
        actualCheckpoint[field],
        `checkpoints[${index}].${field}`,
      );
      if (difference !== undefined) {
        return Object.freeze({ equal: false, difference });
      }
    }

    if (expectedCheckpoint.checkpointHash !== actualCheckpoint.checkpointHash) {
      return Object.freeze({
        equal: false,
        difference: Object.freeze({
          path: `checkpoints[${index}].checkpointHash`,
          expected: expectedCheckpoint.checkpointHash,
          actual: actualCheckpoint.checkpointHash,
        }),
      });
    }
  }

  if (expected.traceHash !== actual.traceHash) {
    return Object.freeze({
      equal: false,
      difference: Object.freeze({
        path: "traceHash",
        expected: expected.traceHash,
        actual: actual.traceHash,
      }),
    });
  }

  return Object.freeze({ equal: true });
}
