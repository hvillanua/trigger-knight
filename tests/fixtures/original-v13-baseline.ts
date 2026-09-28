import { fingerprintCanonicalJson } from "../../src/application/canonical-json.js";
import type { RuleSetId } from "../../src/domain/contracts.js";
import {
  ORIGINAL_V13_CORPUS_SCHEMA_VERSION,
  ORIGINAL_V13_GAMEPLAY_TRACE_SCHEMA_VERSION,
  ORIGINAL_V13_RUN_RESULT_SCHEMA_VERSION,
  ORIGINAL_V13_RUN_STATE_SCHEMA_VERSION,
  originalV13CompatibilityRuns,
  originalV13CompatibilitySettlements,
  type CompatibilityRunFixture,
  type CompatibilitySettlementFixture,
} from "./original-v13-compatibility.js";

/**
 * Stable metadata for the retained original-v1.3 evidence. Update this record
 * only when intentionally creating a new compatibility baseline version.
 */
export const ORIGINAL_V13_BASELINE_SCHEMA_VERSION = 1 as const;

export interface OriginalV13CompatibilityBaseline {
  readonly schemaVersion: typeof ORIGINAL_V13_BASELINE_SCHEMA_VERSION;
  readonly ruleset: RuleSetId;
  readonly corpusSchemaVersion: 1;
  readonly runStateSchemaVersion: 17;
  readonly runResultSchemaVersion: 2;
  readonly gameplayTraceSchemaVersion: 2;
  readonly corpusFingerprint: string;
}

export const originalV13CompatibilityBaseline: OriginalV13CompatibilityBaseline =
  Object.freeze({
    schemaVersion: ORIGINAL_V13_BASELINE_SCHEMA_VERSION,
    ruleset: "original-v1.3",
    corpusSchemaVersion: 1,
    runStateSchemaVersion: 17,
    runResultSchemaVersion: 2,
    gameplayTraceSchemaVersion: 2,
    corpusFingerprint:
      "sha256-v1:174b7670e65bac50571d363df99aea465eb9df6adff77daa4a0b8f1b439b8c5e",
  });

function baselinePayload(
  runs: readonly CompatibilityRunFixture[],
  settlements: readonly CompatibilitySettlementFixture[],
) {
  return {
    baselineSchemaVersion: originalV13CompatibilityBaseline.schemaVersion,
    ruleset: originalV13CompatibilityBaseline.ruleset,
    corpusSchemaVersion: ORIGINAL_V13_CORPUS_SCHEMA_VERSION,
    runStateSchemaVersion: ORIGINAL_V13_RUN_STATE_SCHEMA_VERSION,
    runResultSchemaVersion: ORIGINAL_V13_RUN_RESULT_SCHEMA_VERSION,
    gameplayTraceSchemaVersion: ORIGINAL_V13_GAMEPLAY_TRACE_SCHEMA_VERSION,
    runs,
    settlements,
  };
}

export function originalV13CompatibilityBaselineFingerprint(
  runs: readonly CompatibilityRunFixture[] = originalV13CompatibilityRuns,
  settlements: readonly CompatibilitySettlementFixture[] = originalV13CompatibilitySettlements,
): string {
  return fingerprintCanonicalJson(baselinePayload(runs, settlements));
}

export function assertOriginalV13CompatibilityBaseline(
  runs: readonly CompatibilityRunFixture[] = originalV13CompatibilityRuns,
  settlements: readonly CompatibilitySettlementFixture[] = originalV13CompatibilitySettlements,
): void {
  const actual = originalV13CompatibilityBaselineFingerprint(runs, settlements);

  if (actual !== originalV13CompatibilityBaseline.corpusFingerprint) {
    throw new Error(
      "Original-v1.3 compatibility baseline mismatch: " +
        `expected ${originalV13CompatibilityBaseline.corpusFingerprint}, ` +
        `received ${actual}`,
    );
  }
}
