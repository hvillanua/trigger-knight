import type {
  PolicyDescriptor,
  ProfileInput,
  RuleSetId,
  SimulationBatchExport,
  SimulationComparisonReport,
  SimulationManifest,
  SimulationPolicyRegistry,
  SimulationRunner,
} from "../application/contracts.js";

export const SIMULATION_BENCHMARK_SCHEMA_VERSION = 1 as const;

/** The version-1 benchmark envelope remains sequential for compatibility. */
export const SIMULATION_BENCHMARK_STRATEGY = "sequential" as const;
export const SIMULATION_BENCHMARK_STRATEGIES = Object.freeze([
  SIMULATION_BENCHMARK_STRATEGY,
] as const);

export type SimulationBenchmarkStrategy =
  (typeof SIMULATION_BENCHMARK_STRATEGIES)[number];

export interface SimulationBenchmarkProfile {
  readonly id: string;
  readonly initialProfile: ProfileInput;
}

export interface SimulationBenchmarkScenario {
  readonly id: string;
  readonly ruleset: RuleSetId;
  readonly seeds: readonly string[];
  readonly profiles: readonly SimulationBenchmarkProfile[];
  readonly policies: readonly PolicyDescriptor[];
  readonly batchSizes: readonly number[];
  readonly stepLimits: readonly number[];
}

export interface SimulationBenchmarkTargets {
  readonly minimumRunsPerSecond: number;
  readonly maximumHeapDeltaBytes: number;
  readonly basis: string;
}

export interface SimulationBenchmarkConfig {
  readonly schemaVersion: typeof SIMULATION_BENCHMARK_SCHEMA_VERSION;
  /** Retained in the serialized v1 input; execution is always sequential. */
  readonly strategies: readonly SimulationBenchmarkStrategy[];
  readonly warmupRepetitions: number;
  readonly repetitions: number;
  readonly targets: SimulationBenchmarkTargets;
  readonly scenarios: readonly SimulationBenchmarkScenario[];
}

export interface SimulationBenchmarkHost {
  readonly nodeVersion: string;
  readonly platform: string;
  readonly architecture: string;
  readonly cpuCount: number;
}

export interface SimulationBenchmarkEnvironment {
  readonly host: SimulationBenchmarkHost;
  readonly now: () => number;
  readonly readHeapUsedBytes: () => number;
  readonly collectGarbage?: () => void;
}

export interface SimulationBenchmarkMeasurement {
  readonly caseId: string;
  readonly scenarioId: string;
  readonly profileId: string;
  readonly policy: PolicyDescriptor;
  readonly maxSteps: number;
  readonly strategy: SimulationBenchmarkStrategy;
  readonly batchSize: number;
  readonly repetition: number;
  readonly runCount: number;
  readonly elapsedMilliseconds: number;
  readonly runsPerSecond: number;
  readonly heapUsedBeforeBytes: number;
  readonly peakHeapUsedBytes: number;
  readonly heapDeltaBytes: number;
}

export interface SimulationBenchmarkResultCase {
  readonly caseId: string;
  readonly scenarioId: string;
  readonly profileId: string;
  readonly policy: PolicyDescriptor;
  readonly maxSteps: number;
  readonly strategy: SimulationBenchmarkStrategy;
  readonly batchSize: number;
  readonly requestCount: number;
  readonly resultFingerprint: string;
  readonly stableAcrossRepetitions: boolean;
  readonly terminalReasons: Readonly<{
    readonly lifespan: number;
    readonly combat: number;
    readonly "step-limit": number;
  }>;
  readonly progressingRunCount: number;
}

export interface SimulationBenchmarkComparisonCase {
  readonly caseId: string;
  readonly strategy: SimulationBenchmarkStrategy;
  readonly batchSize: number;
  readonly comparisonFingerprint: string;
  readonly pairCount: number;
  readonly behavioralDifferenceCount: number;
  readonly traceIdentityDifferenceCount: number;
  readonly stable: boolean;
}

export interface SimulationBenchmarkDeterministicReport {
  readonly schemaVersion: typeof SIMULATION_BENCHMARK_SCHEMA_VERSION;
  readonly inputFingerprint: string;
  readonly resultFingerprint: string;
  readonly stable: boolean;
  readonly resultCases: readonly SimulationBenchmarkResultCase[];
  readonly comparisons: readonly SimulationBenchmarkComparisonCase[];
}

export interface SimulationBenchmarkTargetReport extends SimulationBenchmarkTargets {
  readonly minimumMeasuredRunsPerSecond: number;
  readonly maximumMeasuredHeapDeltaBytes: number;
  readonly met: boolean;
}

export interface SimulationBenchmarkReport {
  readonly schemaVersion: typeof SIMULATION_BENCHMARK_SCHEMA_VERSION;
  readonly deterministic: SimulationBenchmarkDeterministicReport;
  readonly measurements: readonly SimulationBenchmarkMeasurement[];
  readonly targets: SimulationBenchmarkTargetReport;
  readonly host: SimulationBenchmarkHost;
}

export interface SimulationBenchmarkCase {
  readonly caseId: string;
  readonly scenarioId: string;
  readonly profileId: string;
  readonly policy: PolicyDescriptor;
  readonly maxSteps: number;
  readonly manifest: SimulationManifest;
}

export interface SimulationBenchmarkExecution {
  readonly batchExport: SimulationBatchExport;
  readonly canonicalResult: string;
  readonly resultFingerprint: string;
  readonly peakHeapUsedBytes: number;
}

export interface SimulationBenchmarkMeasuredExecution extends SimulationBenchmarkExecution {
  readonly elapsedMilliseconds: number;
  readonly heapUsedBeforeBytes: number;
  readonly heapDeltaBytes: number;
  readonly runsPerSecond: number;
}

export interface SimulationBenchmarkReportInput {
  readonly config: SimulationBenchmarkConfig;
  readonly inputFingerprint: string;
  readonly measurements: readonly SimulationBenchmarkMeasurement[];
  readonly resultCases: readonly SimulationBenchmarkResultCase[];
  readonly comparisons: readonly SimulationBenchmarkComparisonCase[];
  readonly stable: boolean;
  readonly maximumMeasuredHeapDeltaBytes: number;
  readonly host: SimulationBenchmarkHost;
}

export interface SimulationBenchmarkMeasurementInput {
  readonly runner: SimulationRunner;
  readonly policies: SimulationPolicyRegistry;
  readonly manifest: SimulationManifest;
  readonly batchSize: number;
  readonly environment: SimulationBenchmarkEnvironment;
  readonly heapTracker: SimulationBenchmarkHeapTracker;
}

export interface SimulationBenchmarkHeapTracker {
  sample(): number;
  collectAndSample(): number;
  delta(): number;
}

export interface SimulationBenchmarkResultCaseInput {
  readonly benchmarkCase: SimulationBenchmarkCase;
  readonly execution: SimulationBenchmarkExecution;
  readonly batchSize: number;
  readonly stableAcrossRepetitions: boolean;
}

export interface SimulationBenchmarkComparisonCaseInput {
  readonly benchmarkCase: SimulationBenchmarkCase;
  readonly batchSize: number;
  readonly report: SimulationComparisonReport;
  readonly stable: boolean;
  readonly pairCount: number;
  readonly behavioralDifferenceCount: number;
  readonly traceIdentityDifferenceCount: number;
}
