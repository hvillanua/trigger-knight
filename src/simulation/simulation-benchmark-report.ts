import { fingerprintCanonicalJson } from "./canonical-json.js";
import {
  SIMULATION_BENCHMARK_SCHEMA_VERSION,
  SIMULATION_BENCHMARK_STRATEGY,
} from "./simulation-benchmark-types.js";
import type {
  SimulationBenchmarkComparisonCase,
  SimulationBenchmarkComparisonCaseInput,
  SimulationBenchmarkDeterministicReport,
  SimulationBenchmarkReport,
  SimulationBenchmarkReportInput,
  SimulationBenchmarkResultCase,
  SimulationBenchmarkResultCaseInput,
} from "./simulation-benchmark-types.js";

function terminalCounts(
  results: SimulationBenchmarkResultCaseInput["execution"]["batchExport"]["results"],
): {
  readonly lifespan: number;
  readonly combat: number;
  readonly "step-limit": number;
  readonly progressingRunCount: number;
} {
  const counts = { lifespan: 0, combat: 0, "step-limit": 0 };
  let progressingRunCount = 0;
  for (const record of results) {
    counts[record.result.terminalReason] += 1;
    if (record.result.activeTicks > 0) progressingRunCount += 1;
  }
  return { ...counts, progressingRunCount };
}

/** Builds the deterministic summary for one measured result case. */
export function createSimulationBenchmarkResultCase(
  input: SimulationBenchmarkResultCaseInput,
): SimulationBenchmarkResultCase {
  const summary = terminalCounts(input.execution.batchExport.results);
  return Object.freeze({
    caseId: input.benchmarkCase.caseId,
    scenarioId: input.benchmarkCase.scenarioId,
    profileId: input.benchmarkCase.profileId,
    policy: input.benchmarkCase.policy,
    maxSteps: input.benchmarkCase.maxSteps,
    strategy: SIMULATION_BENCHMARK_STRATEGY,
    batchSize: input.batchSize,
    requestCount: input.benchmarkCase.manifest.requests.length,
    resultFingerprint: input.execution.resultFingerprint,
    stableAcrossRepetitions: input.stableAcrossRepetitions,
    terminalReasons: Object.freeze({
      lifespan: summary.lifespan,
      combat: summary.combat,
      "step-limit": summary["step-limit"],
    }),
    progressingRunCount: summary.progressingRunCount,
  });
}

/** Builds the deterministic summary for one comparison case. */
export function createSimulationBenchmarkComparisonCase(
  input: SimulationBenchmarkComparisonCaseInput,
): SimulationBenchmarkComparisonCase {
  return Object.freeze({
    caseId: input.benchmarkCase.caseId,
    strategy: SIMULATION_BENCHMARK_STRATEGY,
    batchSize: input.batchSize,
    comparisonFingerprint: fingerprintCanonicalJson(input.report),
    pairCount: input.pairCount,
    behavioralDifferenceCount: input.behavioralDifferenceCount,
    traceIdentityDifferenceCount: input.traceIdentityDifferenceCount,
    stable: input.stable,
  });
}

function deterministicReport(
  input: SimulationBenchmarkReportInput,
): SimulationBenchmarkDeterministicReport {
  const deterministicPayload = {
    schemaVersion: SIMULATION_BENCHMARK_SCHEMA_VERSION,
    inputFingerprint: input.inputFingerprint,
    resultCases: input.resultCases,
    comparisons: input.comparisons,
  };

  return Object.freeze({
    schemaVersion: SIMULATION_BENCHMARK_SCHEMA_VERSION,
    inputFingerprint: input.inputFingerprint,
    resultFingerprint: fingerprintCanonicalJson(deterministicPayload),
    stable: input.stable,
    resultCases: Object.freeze([...input.resultCases]),
    comparisons: Object.freeze([...input.comparisons]),
  });
}

function roundMeasurement(value: number): number {
  const rounded = Math.round(value * 1_000) / 1_000;
  return Object.is(rounded, -0) ? 0 : rounded;
}

/** Builds the final report from measurements and deterministic case summaries. */
export function createSimulationBenchmarkReport(
  input: SimulationBenchmarkReportInput,
): SimulationBenchmarkReport {
  const minimumMeasuredRunsPerSecond = Math.min(
    ...input.measurements.map((measurement) => measurement.runsPerSecond),
  );
  const targets = Object.freeze({
    ...input.config.targets,
    minimumMeasuredRunsPerSecond: roundMeasurement(
      minimumMeasuredRunsPerSecond,
    ),
    maximumMeasuredHeapDeltaBytes: input.maximumMeasuredHeapDeltaBytes,
    met:
      input.stable &&
      minimumMeasuredRunsPerSecond >=
        input.config.targets.minimumRunsPerSecond &&
      input.maximumMeasuredHeapDeltaBytes <=
        input.config.targets.maximumHeapDeltaBytes,
  });

  return Object.freeze({
    schemaVersion: SIMULATION_BENCHMARK_SCHEMA_VERSION,
    deterministic: deterministicReport(input),
    measurements: Object.freeze([...input.measurements]),
    targets,
    host: Object.freeze({ ...input.host }),
  });
}
