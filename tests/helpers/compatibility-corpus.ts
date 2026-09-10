import type {
  GameplayCheckpoint,
  GameplayTrace,
  GameplayTraceComparison,
} from "../../src/application/contracts.js";
import { compareGameplayTraces } from "../../src/application/gameplay-execution.js";

export const COMPATIBILITY_CHECKPOINT_BLOCK_SIZE = 250 as const;

export interface GameplayTraceBlock {
  readonly schemaVersion: GameplayTrace["schemaVersion"];
  readonly config: GameplayTrace["config"];
  readonly checkpoints: readonly GameplayCheckpoint[];
}

/** Compares one checkpoint block without letting the final hash mask a field difference. */
export function compareGameplayTraceBlock(
  expected: GameplayTrace,
  actual: GameplayTraceBlock,
  start: number,
): GameplayTraceComparison {
  const end = start + COMPATIBILITY_CHECKPOINT_BLOCK_SIZE;
  const deferredTraceHash = "trace-hash-deferred";

  return compareGameplayTraces(
    {
      schemaVersion: expected.schemaVersion,
      config: expected.config,
      checkpoints: expected.checkpoints.slice(start, end),
      traceHash: deferredTraceHash,
    },
    {
      schemaVersion: actual.schemaVersion,
      config: actual.config,
      checkpoints: actual.checkpoints,
      traceHash: deferredTraceHash,
    },
  );
}
