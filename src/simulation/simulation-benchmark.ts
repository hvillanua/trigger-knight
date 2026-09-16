import type {
  SimulationComparisonInput,
  SimulationComparisonReport,
  SimulationManifest,
  SimulationPolicyRegistry,
  SimulationRunner,
} from "../application/contracts.js";
import { SIMULATION_COMPARISON_SCHEMA_VERSION } from "../application/contracts.js";
import { stringifyCanonicalJson } from "./canonical-json.js";
import { createSimulationComparison } from "./simulation-comparison.js";
import {
  benchmarkInputFingerprint,
  createSimulationBenchmarkCases,
  normalizeSimulationBenchmark,
} from "./simulation-benchmark-input.js";
import {
  createBatchSizedRunner,
  createSimulationBenchmarkHeapTracker,
  measureSimulationBenchmarkExecution,
} from "./simulation-benchmark-measurement.js";
import {
  createSimulationBenchmarkComparisonCase,
  createSimulationBenchmarkReport,
  createSimulationBenchmarkResultCase,
} from "./simulation-benchmark-report.js";
import { SIMULATION_BENCHMARK_STRATEGY } from "./simulation-benchmark-types.js";
import type {
  SimulationBenchmarkCase,
  SimulationBenchmarkComparisonCase,
  SimulationBenchmarkConfig,
  SimulationBenchmarkEnvironment,
  SimulationBenchmarkMeasurement,
  SimulationBenchmarkMeasuredExecution,
  SimulationBenchmarkReport,
  SimulationBenchmarkResultCase,
} from "./simulation-benchmark-types.js";
import { simulationPolicyRegistry } from "./policy-registry.js";

export {
  SIMULATION_BENCHMARK_SCHEMA_VERSION,
  SIMULATION_BENCHMARK_STRATEGIES,
} from "./simulation-benchmark-types.js";
export { normalizeSimulationBenchmark } from "./simulation-benchmark-input.js";
export type {
  SimulationBenchmarkComparisonCase,
  SimulationBenchmarkConfig,
  SimulationBenchmarkDeterministicReport,
  SimulationBenchmarkEnvironment,
  SimulationBenchmarkHost,
  SimulationBenchmarkMeasurement,
  SimulationBenchmarkProfile,
  SimulationBenchmarkReport,
  SimulationBenchmarkResultCase,
  SimulationBenchmarkScenario,
  SimulationBenchmarkStrategy,
  SimulationBenchmarkTargetReport,
  SimulationBenchmarkTargets,
} from "./simulation-benchmark-types.js";

function comparisonInput(
  manifest: SimulationManifest,
): SimulationComparisonInput {
  return {
    schemaVersion: SIMULATION_COMPARISON_SCHEMA_VERSION,
    baseline: manifest,
    candidate: manifest,
    policyComparison: "same-policy",
  };
}

interface BenchmarkCollections {
  readonly measurements: SimulationBenchmarkMeasurement[];
  readonly resultCases: SimulationBenchmarkResultCase[];
  readonly comparisons: SimulationBenchmarkComparisonCase[];
}

function createMeasurement(
  benchmarkCase: SimulationBenchmarkCase,
  batchSize: number,
  repetition: number,
  execution: SimulationBenchmarkMeasuredExecution,
): SimulationBenchmarkMeasurement {
  return Object.freeze({
    caseId: benchmarkCase.caseId,
    scenarioId: benchmarkCase.scenarioId,
    profileId: benchmarkCase.profileId,
    policy: benchmarkCase.policy,
    maxSteps: benchmarkCase.maxSteps,
    strategy: SIMULATION_BENCHMARK_STRATEGY,
    batchSize,
    repetition,
    runCount: benchmarkCase.manifest.requests.length,
    elapsedMilliseconds: execution.elapsedMilliseconds,
    runsPerSecond: execution.runsPerSecond,
    heapUsedBeforeBytes: execution.heapUsedBeforeBytes,
    peakHeapUsedBytes: execution.peakHeapUsedBytes,
    heapDeltaBytes: execution.heapDeltaBytes,
  });
}

/** Executes a reproducible host benchmark without retaining per-step traces. */
export function createSimulationBenchmark(
  runner: SimulationRunner,
  policies: SimulationPolicyRegistry = simulationPolicyRegistry,
  environment: SimulationBenchmarkEnvironment,
): { run(input: unknown): Promise<SimulationBenchmarkReport> } {
  return Object.freeze({
    async run(input: unknown): Promise<SimulationBenchmarkReport> {
      const config: SimulationBenchmarkConfig =
        normalizeSimulationBenchmark(input);
      const cases = createSimulationBenchmarkCases(config);
      const inputFingerprint = benchmarkInputFingerprint(config, cases);
      const collections: BenchmarkCollections = {
        measurements: [],
        resultCases: [],
        comparisons: [],
      };
      const resultCanonicalByCase = new Map<string, string>();
      const comparisonCanonicalByCase = new Map<string, string>();
      const heapTracker = createSimulationBenchmarkHeapTracker(
        environment.readHeapUsedBytes,
        environment.collectGarbage,
      );
      let stable = true;

      for (const benchmarkCase of cases) {
        const scenario = config.scenarios.find(
          (candidate) => candidate.id === benchmarkCase.scenarioId,
        );
        if (scenario === undefined) {
          throw new Error(
            `Missing benchmark scenario ${benchmarkCase.scenarioId}`,
          );
        }

        for (const batchSize of scenario.batchSizes) {
          const measure = () =>
            measureSimulationBenchmarkExecution({
              runner,
              policies,
              manifest: benchmarkCase.manifest,
              batchSize,
              environment,
              heapTracker,
            });

          for (
            let repetition = 0;
            repetition < config.warmupRepetitions;
            repetition += 1
          ) {
            await measure();
          }

          let firstExecution: SimulationBenchmarkMeasuredExecution | undefined;
          let stableAcrossRepetitions = true;
          for (
            let repetition = 0;
            repetition < config.repetitions;
            repetition += 1
          ) {
            const execution = await measure();
            firstExecution ??= execution;
            if (execution.canonicalResult !== firstExecution.canonicalResult) {
              stableAcrossRepetitions = false;
              stable = false;
            }
            collections.measurements.push(
              createMeasurement(
                benchmarkCase,
                batchSize,
                repetition,
                execution,
              ),
            );
            if (
              resultCanonicalByCase.has(benchmarkCase.caseId) &&
              resultCanonicalByCase.get(benchmarkCase.caseId) !==
                execution.canonicalResult
            ) {
              stable = false;
            }
            resultCanonicalByCase.set(
              benchmarkCase.caseId,
              execution.canonicalResult,
            );
          }

          if (firstExecution === undefined) {
            throw new Error("Simulation benchmark produced no measurement");
          }
          collections.resultCases.push(
            createSimulationBenchmarkResultCase({
              benchmarkCase,
              batchSize,
              execution: firstExecution,
              stableAcrossRepetitions,
            }),
          );

          const comparison = createSimulationComparison(
            createBatchSizedRunner(runner, batchSize, () =>
              heapTracker.sample(),
            ),
            policies,
          );
          let firstComparison: string | undefined;
          let firstComparisonReport: SimulationComparisonReport | undefined;
          let stableComparison = true;
          let pairCount = 0;
          let behavioralDifferenceCount = 0;
          let traceDifferences = 0;
          for (
            let repetition = 0;
            repetition < config.repetitions;
            repetition += 1
          ) {
            const comparisonReport = await comparison.run(
              comparisonInput(benchmarkCase.manifest),
            );
            const serialized = stringifyCanonicalJson(comparisonReport);
            firstComparison ??= serialized;
            firstComparisonReport ??= comparisonReport;
            if (serialized !== firstComparison) {
              stableComparison = false;
              stable = false;
            }
            if (
              behavioralDifferenceCount === 0 &&
              comparisonReport.aggregateDifferences.behavioralDifferenceCount >
                0
            ) {
              behavioralDifferenceCount =
                comparisonReport.aggregateDifferences.behavioralDifferenceCount;
            }
            if (
              comparisonReport.aggregateDifferences.behavioralDifferenceCount >
              0
            ) {
              stable = false;
            }
            traceDifferences = Math.max(
              traceDifferences,
              comparisonReport.pairs.filter(
                (pair) => pair.baseline.traceHash !== pair.candidate.traceHash,
              ).length,
            );
            if (traceDifferences > 0) stable = false;
            pairCount = comparisonReport.aggregateDifferences.pairCount;
            heapTracker.collectAndSample();
          }
          if (
            firstComparison === undefined ||
            firstComparisonReport === undefined
          ) {
            throw new Error("Simulation benchmark produced no comparison");
          }
          if (
            comparisonCanonicalByCase.has(benchmarkCase.caseId) &&
            comparisonCanonicalByCase.get(benchmarkCase.caseId) !==
              firstComparison
          ) {
            stable = false;
          }
          comparisonCanonicalByCase.set(benchmarkCase.caseId, firstComparison);
          collections.comparisons.push(
            createSimulationBenchmarkComparisonCase({
              benchmarkCase,
              batchSize,
              report: firstComparisonReport,
              stable: stableComparison,
              pairCount,
              behavioralDifferenceCount,
              traceIdentityDifferenceCount: traceDifferences,
            }),
          );
        }
      }

      return createSimulationBenchmarkReport({
        config,
        inputFingerprint,
        measurements: collections.measurements,
        resultCases: collections.resultCases,
        comparisons: collections.comparisons,
        stable,
        maximumMeasuredHeapDeltaBytes: heapTracker.delta(),
        host: environment.host,
      });
    },
  });
}
