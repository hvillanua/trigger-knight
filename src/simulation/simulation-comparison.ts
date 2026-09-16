import type {
  RunMetricKey,
  RunResult,
  SimulationAggregateDifferences,
  SimulationComparisonInput,
  SimulationComparisonReport,
  SimulationComparison,
  SimulationManifest,
  SimulationPairDeltas,
  SimulationPairReport,
  SimulationPairSide,
  SimulationPolicyComparison,
  SimulationPolicyRegistry,
  SimulationRequestInput,
  SimulationResultRecord,
  SimulationRunner,
} from "../application/contracts.js";
import { SIMULATION_COMPARISON_SCHEMA_VERSION } from "../application/contracts.js";
import {
  fingerprintCanonicalJson,
  normalizeCanonicalJson,
} from "./canonical-json.js";
import {
  createSimulationExperiment,
  normalizeSimulationManifest,
  simulationRequestFingerprint,
} from "./simulation-experiment.js";
import {
  createSimulationReport,
  RUN_METRIC_KEYS,
  summarizeSimulationNumbers,
} from "./simulation-report.js";
import { simulationPolicyRegistry } from "./policy-registry.js";
import { assertExactKeys, record } from "./simulation-validation.js";

/** Normalizes and validates the two retained manifests used for comparison. */
export function normalizeSimulationComparisonInput(
  input: unknown,
): SimulationComparisonInput {
  const normalized = record(
    normalizeCanonicalJson(input),
    "Simulation comparison",
  );
  assertExactKeys(
    normalized,
    ["baseline", "candidate", "policyComparison", "schemaVersion"],
    "Simulation comparison",
  );

  if (normalized.schemaVersion !== SIMULATION_COMPARISON_SCHEMA_VERSION) {
    throw new RangeError(
      `Unsupported simulation comparison schemaVersion ${String(normalized.schemaVersion)}`,
    );
  }

  if (
    normalized.policyComparison !== "same-policy" &&
    normalized.policyComparison !== "allow-different"
  ) {
    throw new TypeError(
      "Simulation comparison policyComparison must be same-policy or allow-different",
    );
  }

  return Object.freeze({
    schemaVersion: SIMULATION_COMPARISON_SCHEMA_VERSION,
    baseline: normalizeSimulationManifest(normalized.baseline),
    candidate: normalizeSimulationManifest(normalized.candidate),
    policyComparison: normalized.policyComparison,
  });
}

function pairKey(
  request: SimulationRequestInput,
  policyComparison: SimulationPolicyComparison,
): string {
  const identity = {
    seed: request.config.seed,
    initialProfile: request.config.initialProfile,
    maxSteps: request.maxSteps,
    ...(policyComparison === "same-policy" ? { policy: request.policy } : {}),
  };
  return fingerprintCanonicalJson(identity);
}

interface IndexedRequest {
  readonly index: number;
  readonly fingerprint: string;
  readonly key: string;
  readonly request: SimulationRequestInput;
}

interface RequestPair {
  readonly key: string;
  readonly baseline: IndexedRequest;
  readonly candidate: IndexedRequest;
}

function indexedRequests(
  manifest: SimulationManifest,
  policyComparison: SimulationPolicyComparison,
): readonly IndexedRequest[] {
  return manifest.requests.map((request, index) => ({
    index,
    fingerprint: simulationRequestFingerprint(request),
    key: pairKey(request, policyComparison),
    request,
  }));
}

function pairRequests(
  baseline: SimulationManifest,
  candidate: SimulationManifest,
  policyComparison: SimulationPolicyComparison,
): readonly RequestPair[] {
  const baselineRequests = indexedRequests(baseline, policyComparison);
  const candidateRequests = indexedRequests(candidate, policyComparison);
  const candidatesByKey = new Map<string, IndexedRequest[]>();
  for (const request of candidateRequests) {
    const existing = candidatesByKey.get(request.key) ?? [];
    existing.push(request);
    candidatesByKey.set(request.key, existing);
  }

  const usedCandidateIndices = new Set<number>();
  const pairs: RequestPair[] = [];
  for (const baselineRequest of baselineRequests) {
    const matches = candidatesByKey.get(baselineRequest.key) ?? [];
    if (matches.length === 0) {
      throw new Error(
        `Missing candidate pair for baseline request ${baselineRequest.index}; ` +
          "seed, exact initial profile, policy, and maxSteps must match",
      );
    }
    if (matches.length > 1) {
      throw new Error(
        `Ambiguous candidate pair for baseline request ${baselineRequest.index}; ` +
          "pairing inputs must be unique",
      );
    }

    const candidateRequest = matches[0]!;
    if (usedCandidateIndices.has(candidateRequest.index)) {
      throw new Error(
        `Ambiguous baseline pair for candidate request ${candidateRequest.index}; ` +
          "pairing inputs must be unique",
      );
    }
    usedCandidateIndices.add(candidateRequest.index);
    pairs.push({
      key: baselineRequest.key,
      baseline: baselineRequest,
      candidate: candidateRequest,
    });
  }

  const unmatchedCandidate = candidateRequests.find(
    (request) => !usedCandidateIndices.has(request.index),
  );
  if (unmatchedCandidate !== undefined) {
    throw new Error(
      `Missing baseline pair for candidate request ${unmatchedCandidate.index}; ` +
        "seed, exact initial profile, policy, and maxSteps must match",
    );
  }

  return Object.freeze(
    pairs.sort((left, right) =>
      left.key < right.key ? -1 : left.key > right.key ? 1 : 0,
    ),
  );
}

function recordsByIndex(
  records: readonly SimulationResultRecord[],
): ReadonlyMap<number, SimulationResultRecord> {
  return new Map(records.map((record) => [record.requestIndex, record]));
}

function side(indexed: IndexedRequest, result: RunResult): SimulationPairSide {
  return Object.freeze({
    requestIndex: indexed.index,
    requestFingerprint: indexed.fingerprint,
    ruleset: result.ruleset,
    seed: result.seed,
    initialProfileFingerprint: result.initialProfileFingerprint,
    policy: result.policy,
    maxSteps: result.maxSteps,
    terminalReason: result.terminalReason,
    traceHash: result.traceHash,
  });
}

function normalizedDelta(value: number): number {
  if (!Number.isFinite(value)) {
    throw new TypeError("Simulation comparison deltas must be finite");
  }
  const rounded = Math.round(value * 1_000_000) / 1_000_000;
  return Object.is(rounded, -0) ? 0 : rounded;
}

function resultMetric(result: RunResult, key: RunMetricKey): number {
  return result.metrics[key] ?? 0;
}

function deltas(
  baseline: RunResult,
  candidate: RunResult,
): SimulationPairDeltas {
  const metrics = Object.fromEntries(
    RUN_METRIC_KEYS.map((key) => [
      key,
      normalizedDelta(
        resultMetric(candidate, key) - resultMetric(baseline, key),
      ),
    ]),
  ) as Record<RunMetricKey, number>;

  return Object.freeze({
    steps: normalizedDelta(candidate.steps - baseline.steps),
    activeTicks: normalizedDelta(candidate.activeTicks - baseline.activeTicks),
    score: normalizedDelta(candidate.score - baseline.score),
    day: normalizedDelta(candidate.day - baseline.day),
    distance: normalizedDelta(candidate.distance - baseline.distance),
    gold: normalizedDelta(candidate.gold - baseline.gold),
    metrics: Object.freeze(metrics),
  });
}

function hasNonZeroDelta(value: number): boolean {
  return value !== 0;
}

function behavioralDifference(
  baseline: RunResult,
  candidate: RunResult,
  difference: SimulationPairDeltas,
): boolean {
  if (baseline.terminalReason !== candidate.terminalReason) return true;
  return (
    hasNonZeroDelta(difference.steps) ||
    hasNonZeroDelta(difference.activeTicks) ||
    hasNonZeroDelta(difference.score) ||
    hasNonZeroDelta(difference.day) ||
    hasNonZeroDelta(difference.distance) ||
    hasNonZeroDelta(difference.gold) ||
    RUN_METRIC_KEYS.some((key) => hasNonZeroDelta(difference.metrics[key]))
  );
}

function aggregateDifferences(
  pairs: readonly SimulationPairReport[],
): SimulationAggregateDifferences {
  const metrics = Object.fromEntries(
    RUN_METRIC_KEYS.map((key) => [
      key,
      summarizeSimulationNumbers(pairs.map((pair) => pair.deltas.metrics[key])),
    ]),
  ) as Record<RunMetricKey, ReturnType<typeof summarizeSimulationNumbers>>;

  return Object.freeze({
    pairCount: pairs.length,
    behavioralDifferenceCount: pairs.filter((pair) => pair.behavioralDifference)
      .length,
    terminalReasonChangeCount: pairs.filter(
      (pair) => pair.baseline.terminalReason !== pair.candidate.terminalReason,
    ).length,
    steps: summarizeSimulationNumbers(pairs.map((pair) => pair.deltas.steps)),
    activeTicks: summarizeSimulationNumbers(
      pairs.map((pair) => pair.deltas.activeTicks),
    ),
    score: summarizeSimulationNumbers(pairs.map((pair) => pair.deltas.score)),
    day: summarizeSimulationNumbers(pairs.map((pair) => pair.deltas.day)),
    distance: summarizeSimulationNumbers(
      pairs.map((pair) => pair.deltas.distance),
    ),
    gold: summarizeSimulationNumbers(pairs.map((pair) => pair.deltas.gold)),
    metrics: Object.freeze(metrics),
  });
}

/** Executes two retained experiments and compares only observable outcomes. */
export function createSimulationComparison(
  runner: SimulationRunner,
  policies: SimulationPolicyRegistry = simulationPolicyRegistry,
): SimulationComparison {
  const experiment = createSimulationExperiment(runner, policies);

  return Object.freeze({
    async run(
      input: SimulationComparisonInput,
    ): Promise<SimulationComparisonReport> {
      const normalized = normalizeSimulationComparisonInput(input);
      const requestPairs = pairRequests(
        normalized.baseline,
        normalized.candidate,
        normalized.policyComparison,
      );
      const [baselineExport, candidateExport] = await Promise.all([
        experiment.run(normalized.baseline),
        experiment.run(normalized.candidate),
      ]);
      const baselineRecords = recordsByIndex(baselineExport.results);
      const candidateRecords = recordsByIndex(candidateExport.results);
      const pairReports = requestPairs.map((requestPair) => {
        const baselineRecord = baselineRecords.get(requestPair.baseline.index);
        const candidateRecord = candidateRecords.get(
          requestPair.candidate.index,
        );
        if (baselineRecord === undefined || candidateRecord === undefined) {
          throw new Error(
            `Missing simulation result for pair ${requestPair.key}`,
          );
        }

        const difference = deltas(
          baselineRecord.result,
          candidateRecord.result,
        );
        return Object.freeze({
          key: requestPair.key,
          seed: requestPair.baseline.request.config.seed,
          initialProfileFingerprint:
            baselineRecord.result.initialProfileFingerprint,
          maxSteps: requestPair.baseline.request.maxSteps,
          baseline: side(requestPair.baseline, baselineRecord.result),
          candidate: side(requestPair.candidate, candidateRecord.result),
          behavioralDifference: behavioralDifference(
            baselineRecord.result,
            candidateRecord.result,
            difference,
          ),
          deltas: difference,
        });
      });
      const pairs = Object.freeze(
        [...pairReports].sort((left, right) =>
          left.key < right.key ? -1 : left.key > right.key ? 1 : 0,
        ),
      );

      return Object.freeze({
        schemaVersion: SIMULATION_COMPARISON_SCHEMA_VERSION,
        policyComparison: normalized.policyComparison,
        baseline: Object.freeze({
          inputFingerprint: fingerprintCanonicalJson(baselineExport.manifest),
          report: createSimulationReport(baselineExport),
        }),
        candidate: Object.freeze({
          inputFingerprint: fingerprintCanonicalJson(candidateExport.manifest),
          report: createSimulationReport(candidateExport),
        }),
        pairs,
        aggregateDifferences: aggregateDifferences(pairs),
      });
    },
  });
}
