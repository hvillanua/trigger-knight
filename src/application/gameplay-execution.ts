import type {
  GameCommand,
  GameEvent,
  GameObservation,
  RunState,
} from "../domain/contracts.js";
import {
  copyAndFreezeJson,
  fingerprintCanonicalJson,
  normalizeCanonicalJson,
} from "./canonical-json.js";
import type { GameplayEngine, RunConfig } from "./gameplay-engine.js";

const GAMEPLAY_TRACE_SCHEMA_VERSION = 2 as const;
const MISSING_TRACE_VALUE = Object.freeze({ kind: "missing" as const });

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

export type GameplayDivergenceKind =
  | "command"
  | "state"
  | "random"
  | "observation"
  | "event"
  | "termination"
  | "input";

export interface GameplayTraceDivergence {
  readonly step: number;
  readonly kind: GameplayDivergenceKind;
  readonly path: string;
  readonly expected: unknown;
  readonly actual: unknown;
}

export interface GameplayTraceIdentityDifference {
  readonly path: string;
  readonly expected: unknown;
  readonly actual: unknown;
}

/** Prefix-aware host diagnostics for comparing two complete executions. */
export interface GameplayTraceDivergenceComparison {
  readonly identityDifferences: readonly GameplayTraceIdentityDifference[];
  readonly incompatibleDifference: GameplayTraceDivergence | null;
  readonly behavioralDifference: GameplayTraceDivergence | null;
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
  /** Reads the complete host trace; throws unless diagnostics were retained. */
  readDiagnostics(): GameplayTrace;
}

export interface GameplayExecutionOptions {
  /** Retain the full host diagnostic trace for this execution. Defaults to false. */
  readonly retainDiagnostics?: boolean;
}

interface CheckpointPayload {
  readonly index: number;
  readonly commands: readonly GameCommand[];
  readonly state: Readonly<RunState>;
  readonly observation: Readonly<GameObservation>;
  readonly events: readonly GameEvent[];
}

function snapshotAs<T>(value: T): T {
  return copyAndFreezeJson(value) as unknown as T;
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

/** Owns one serializable engine execution and its host-neutral diagnostics. */
export function createGameplayExecution(
  engine: GameplayEngine,
  config: RunConfig,
  options: GameplayExecutionOptions = {},
): GameplayExecution {
  const normalizedConfig = normalizeCanonicalJson(
    config,
  ) as unknown as RunConfig;
  const retainDiagnostics = options.retainDiagnostics ?? false;
  let state = snapshotAs(engine.createRun(normalizedConfig));
  let observation = snapshotAs(engine.observe(state));
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
      const normalizedCommands = snapshotAs(commands);
      const result = engine.step(state, normalizedCommands);
      state = snapshotAs(result.state);
      observation = snapshotAs(engine.observe(state));
      const checkpoint = createCheckpoint({
        index: currentCheckpoint.index + 1,
        commands: normalizedCommands,
        state,
        observation,
        events: snapshotAs(result.events),
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

/** Finds a difference while treating ruleset labels as execution identity. */
function findDifferenceIgnoringRuleset(
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
      const difference = findDifferenceIgnoringRuleset(
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
    ]
      .filter((key) => key !== "ruleset")
      .sort();

    for (const key of keys) {
      const difference = findDifferenceIgnoringRuleset(
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

function divergence(
  step: number,
  kind: GameplayDivergenceKind,
  difference: GameplayTraceDifference,
): GameplayTraceDivergence {
  return Object.freeze({
    step,
    kind,
    path: difference.path,
    expected:
      difference.expected === undefined
        ? MISSING_TRACE_VALUE
        : difference.expected,
    actual:
      difference.actual === undefined ? MISSING_TRACE_VALUE : difference.actual,
  });
}

function checkpointDivergence(
  expected: GameplayCheckpoint,
  actual: GameplayCheckpoint,
  checkpointIndex: number,
): GameplayTraceDivergence | undefined {
  const step = Math.min(expected.index, actual.index);
  if (expected.index !== actual.index) {
    return divergence(step, "state", {
      path: `checkpoints[${checkpointIndex}].index`,
      expected: expected.index,
      actual: actual.index,
    });
  }

  const commandDifference = findDifference(
    expected.commands,
    actual.commands,
    `checkpoints[${checkpointIndex}].commands`,
  );
  if (commandDifference !== undefined) {
    return divergence(step, "command", commandDifference);
  }

  const stateDifference = findDifferenceIgnoringRuleset(
    expected.state,
    actual.state,
    `checkpoints[${checkpointIndex}].state`,
  );
  if (stateDifference !== undefined) {
    return divergence(
      step,
      stateDifference.path.includes(".random") ? "random" : "state",
      stateDifference,
    );
  }

  const observationDifference = findDifferenceIgnoringRuleset(
    expected.observation,
    actual.observation,
    `checkpoints[${checkpointIndex}].observation`,
  );
  if (observationDifference !== undefined) {
    return divergence(step, "observation", observationDifference);
  }

  const eventDifference = findDifference(
    expected.events,
    actual.events,
    `checkpoints[${checkpointIndex}].events`,
  );
  if (eventDifference !== undefined) {
    return divergence(step, "event", eventDifference);
  }

  return undefined;
}

function traceIdentityDifference(
  expected: GameplayTrace,
  actual: GameplayTrace,
): GameplayTraceIdentityDifference[] {
  if (expected.config.ruleset === actual.config.ruleset) {
    return [];
  }

  return [
    Object.freeze({
      path: "config.ruleset",
      expected: expected.config.ruleset,
      actual: actual.config.ruleset,
    }),
  ];
}

/**
 * Compares executions in chronological order while separating ruleset labels
 * from gameplay behavior and retaining full state diagnostics for the host.
 */
export function compareGameplayTracesForDivergence(
  expected: GameplayTrace,
  actual: GameplayTrace,
): GameplayTraceDivergenceComparison {
  const identityDifferences = traceIdentityDifference(expected, actual);

  if (expected.schemaVersion !== actual.schemaVersion) {
    return Object.freeze({
      identityDifferences: Object.freeze(identityDifferences),
      incompatibleDifference: divergence(0, "input", {
        path: "schemaVersion",
        expected: expected.schemaVersion,
        actual: actual.schemaVersion,
      }),
      behavioralDifference: null,
    });
  }

  const inputDifference = findDifferenceIgnoringRuleset(
    expected.config,
    actual.config,
    "config",
  );
  if (inputDifference !== undefined) {
    return Object.freeze({
      identityDifferences: Object.freeze(identityDifferences),
      incompatibleDifference: divergence(0, "input", inputDifference),
      behavioralDifference: null,
    });
  }

  const sharedLength = Math.min(
    expected.checkpoints.length,
    actual.checkpoints.length,
  );
  for (let index = 0; index < sharedLength; index += 1) {
    const difference = checkpointDivergence(
      expected.checkpoints[index]!,
      actual.checkpoints[index]!,
      index,
    );
    if (difference !== undefined) {
      return Object.freeze({
        identityDifferences: Object.freeze(identityDifferences),
        incompatibleDifference: null,
        behavioralDifference: difference,
      });
    }
  }

  if (expected.checkpoints.length !== actual.checkpoints.length) {
    return Object.freeze({
      identityDifferences: Object.freeze(identityDifferences),
      incompatibleDifference: null,
      behavioralDifference: divergence(sharedLength, "termination", {
        path: "checkpoints.length",
        expected: expected.checkpoints.length,
        actual: actual.checkpoints.length,
      }),
    });
  }

  if (
    expected.traceHash !== actual.traceHash &&
    identityDifferences.length === 0
  ) {
    return Object.freeze({
      identityDifferences: Object.freeze(identityDifferences),
      incompatibleDifference: null,
      behavioralDifference: divergence(Math.max(0, sharedLength - 1), "state", {
        path: "traceHash",
        expected: expected.traceHash,
        actual: actual.traceHash,
      }),
    });
  }

  return Object.freeze({
    identityDifferences: Object.freeze(identityDifferences),
    incompatibleDifference: null,
    behavioralDifference: null,
  });
}

/** Returns the first host-independent execution field that differs. */
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
