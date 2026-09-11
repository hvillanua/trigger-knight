import { normalizeProfile } from "../domain/profile.js";
import type { ProfileInput } from "../domain/contracts.js";
import type {
  PolicyDescriptor,
  RuleSetId,
  RunResult,
  SimulationBatchExport,
  SimulationComparisonInput,
  SimulationManifest,
  SimulationPolicyRegistry,
  SimulationRequestInput,
  SimulationResultRecord,
  SimulationRunner,
  SimulationComparisonReport,
} from "../application/contracts.js";
import {
  SIMULATION_BATCH_EXPORT_SCHEMA_VERSION,
  SIMULATION_COMPARISON_SCHEMA_VERSION,
  SIMULATION_MANIFEST_SCHEMA_VERSION,
} from "../application/contracts.js";
import {
  fingerprintCanonicalJson,
  normalizeCanonicalJson,
  stringifyCanonicalJson,
} from "./canonical-json.js";
import { createSimulationComparison } from "./simulation-comparison.js";
import {
  normalizeSimulationBatchExport,
  normalizeSimulationManifest,
  resolveSimulationRequest,
  simulationRequestFingerprint,
  stringifySimulationBatchExport,
} from "./simulation-experiment.js";
import { simulationPolicyRegistry } from "./policy-registry.js";
import { normalizePolicyDescriptor } from "./policy-descriptor.js";

export const SIMULATION_BENCHMARK_SCHEMA_VERSION = 1 as const;

export const SIMULATION_BENCHMARK_STRATEGIES = Object.freeze([
  "sequential",
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
  readonly comparisonFingerprint: string;
  readonly pairCount: number;
  readonly behavioralDifferenceCount: number;
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

type NormalizedRecord = Readonly<Record<string, unknown>>;

interface BenchmarkCase {
  readonly caseId: string;
  readonly scenarioId: string;
  readonly profileId: string;
  readonly policy: PolicyDescriptor;
  readonly maxSteps: number;
  readonly manifest: SimulationManifest;
}

interface BatchExecution {
  readonly batchExport: SimulationBatchExport;
  readonly canonicalResult: string;
  readonly resultFingerprint: string;
  readonly peakHeapUsedBytes: number;
}

interface MeasuredExecution extends BatchExecution {
  readonly elapsedMilliseconds: number;
  readonly heapUsedBeforeBytes: number;
  readonly heapDeltaBytes: number;
  readonly runsPerSecond: number;
}

function record(value: unknown, label: string): NormalizedRecord {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${label} must be a plain record`);
  }

  return value as NormalizedRecord;
}

function assertKeys(
  value: NormalizedRecord,
  expected: readonly string[],
  label: string,
): void {
  const actual = Object.keys(value).sort();
  const sortedExpected = [...expected].sort();
  if (
    actual.length !== sortedExpected.length ||
    actual.some((key, index) => key !== sortedExpected[index])
  ) {
    throw new TypeError(`${label} contains unsupported fields`);
  }
}

function nonEmptyString(input: unknown, label: string): string {
  if (typeof input !== "string" || input.length === 0) {
    throw new TypeError(`${label} must be a non-empty string`);
  }
  return input;
}

function positiveInteger(input: unknown, label: string): number {
  if (typeof input !== "number" || !Number.isSafeInteger(input) || input <= 0) {
    throw new RangeError(`${label} must be a positive safe integer`);
  }
  return input;
}

function nonNegativeInteger(input: unknown, label: string): number {
  if (typeof input !== "number" || !Number.isSafeInteger(input) || input < 0) {
    throw new RangeError(`${label} must be a non-negative safe integer`);
  }
  return input;
}

function positiveFiniteNumber(input: unknown, label: string): number {
  if (typeof input !== "number" || !Number.isFinite(input) || input <= 0) {
    throw new RangeError(`${label} must be a positive finite number`);
  }
  return input;
}

function unique<T>(values: readonly T[], label: string): readonly T[] {
  if (new Set(values).size !== values.length) {
    throw new Error(`${label} must not contain duplicates`);
  }
  return values;
}

function normalizeProfileInput(input: unknown): ProfileInput {
  const normalized = normalizeCanonicalJson(input);
  normalizeProfile(normalized);
  return normalized as unknown as ProfileInput;
}

function normalizeBenchmarkProfile(
  input: unknown,
  scenarioId: string,
): SimulationBenchmarkProfile {
  const value = record(
    normalizeCanonicalJson(input),
    `Benchmark scenario ${scenarioId} profile`,
  );
  assertKeys(value, ["id", "initialProfile"], "Benchmark profile");

  return Object.freeze({
    id: nonEmptyString(value.id, "Benchmark profile id"),
    initialProfile: normalizeProfileInput(value.initialProfile),
  });
}

function normalizePolicyList(
  input: unknown,
  scenarioId: string,
): readonly PolicyDescriptor[] {
  if (!Array.isArray(input) || input.length === 0) {
    throw new TypeError(
      `Benchmark scenario ${scenarioId} policies must be a non-empty array`,
    );
  }

  const policies = input.map((policy) => normalizePolicyDescriptor(policy));
  const identities = policies.map((policy) => stringifyCanonicalJson(policy));
  unique(identities, `Benchmark scenario ${scenarioId} policies`);
  return Object.freeze(policies);
}

function normalizeIntegerList(
  input: unknown,
  label: string,
): readonly number[] {
  if (!Array.isArray(input) || input.length === 0) {
    throw new TypeError(`${label} must be a non-empty array`);
  }
  const values = input.map((value) => positiveInteger(value, label));
  unique(values, label);
  return Object.freeze(values);
}

function normalizeScenario(input: unknown): SimulationBenchmarkScenario {
  const value = record(
    normalizeCanonicalJson(input),
    "Simulation benchmark scenario",
  );
  assertKeys(
    value,
    [
      "batchSizes",
      "id",
      "policies",
      "profiles",
      "ruleset",
      "seeds",
      "stepLimits",
    ],
    "Simulation benchmark scenario",
  );
  const id = nonEmptyString(value.id, "Benchmark scenario id");
  const ruleset = nonEmptyString(
    value.ruleset,
    `Benchmark scenario ${id} ruleset`,
  );
  if (!Array.isArray(value.seeds) || value.seeds.length === 0) {
    throw new TypeError(`Benchmark scenario ${id} seeds must be non-empty`);
  }
  const seeds = value.seeds.map((seed) =>
    nonEmptyString(seed, `Benchmark scenario ${id} seed`),
  );
  unique(seeds, `Benchmark scenario ${id} seeds`);

  if (!Array.isArray(value.profiles) || value.profiles.length === 0) {
    throw new TypeError(`Benchmark scenario ${id} profiles must be non-empty`);
  }
  const profiles = value.profiles.map((profile) =>
    normalizeBenchmarkProfile(profile, id),
  );
  unique(
    profiles.map((profile) => profile.id),
    `Benchmark scenario ${id} profile ids`,
  );

  return Object.freeze({
    id,
    ruleset,
    seeds: Object.freeze(seeds),
    profiles: Object.freeze(profiles),
    policies: normalizePolicyList(value.policies, id),
    batchSizes: normalizeIntegerList(
      value.batchSizes,
      `Benchmark scenario ${id} batchSizes`,
    ),
    stepLimits: normalizeIntegerList(
      value.stepLimits,
      `Benchmark scenario ${id} stepLimits`,
    ),
  });
}

function normalizeTargets(input: unknown): SimulationBenchmarkTargets {
  const value = record(
    normalizeCanonicalJson(input),
    "Simulation benchmark targets",
  );
  assertKeys(
    value,
    ["basis", "maximumHeapDeltaBytes", "minimumRunsPerSecond"],
    "Simulation benchmark targets",
  );

  return Object.freeze({
    minimumRunsPerSecond: positiveFiniteNumber(
      value.minimumRunsPerSecond,
      "Simulation benchmark minimumRunsPerSecond",
    ),
    maximumHeapDeltaBytes: positiveInteger(
      value.maximumHeapDeltaBytes,
      "Simulation benchmark maximumHeapDeltaBytes",
    ),
    basis: nonEmptyString(value.basis, "Simulation benchmark target basis"),
  });
}

/** Normalizes a versioned host benchmark configuration. */
export function normalizeSimulationBenchmark(
  input: unknown,
): SimulationBenchmarkConfig {
  const value = record(normalizeCanonicalJson(input), "Simulation benchmark");
  assertKeys(
    value,
    [
      "repetitions",
      "scenarios",
      "schemaVersion",
      "strategies",
      "targets",
      "warmupRepetitions",
    ],
    "Simulation benchmark",
  );
  if (value.schemaVersion !== SIMULATION_BENCHMARK_SCHEMA_VERSION) {
    throw new RangeError(
      `Unsupported simulation benchmark schemaVersion ${String(value.schemaVersion)}`,
    );
  }
  if (!Array.isArray(value.strategies) || value.strategies.length === 0) {
    throw new TypeError("Simulation benchmark strategies must be non-empty");
  }
  const strategies = value.strategies.map((strategy) => {
    if (
      typeof strategy !== "string" ||
      !SIMULATION_BENCHMARK_STRATEGIES.includes(
        strategy as SimulationBenchmarkStrategy,
      )
    ) {
      throw new RangeError(
        `Unsupported simulation benchmark strategy ${String(strategy)}`,
      );
    }
    return strategy as SimulationBenchmarkStrategy;
  });
  unique(strategies, "Simulation benchmark strategies");
  if (!Array.isArray(value.scenarios) || value.scenarios.length === 0) {
    throw new TypeError("Simulation benchmark scenarios must be non-empty");
  }
  const scenarios = value.scenarios.map(normalizeScenario);
  unique(
    scenarios.map((scenario) => scenario.id),
    "Simulation benchmark scenario ids",
  );

  return Object.freeze({
    schemaVersion: SIMULATION_BENCHMARK_SCHEMA_VERSION,
    strategies: Object.freeze(strategies),
    warmupRepetitions: nonNegativeInteger(
      value.warmupRepetitions,
      "Simulation benchmark warmupRepetitions",
    ),
    repetitions: positiveInteger(
      value.repetitions,
      "Simulation benchmark repetitions",
    ),
    targets: normalizeTargets(value.targets),
    scenarios: Object.freeze(scenarios),
  });
}

function createCaseId(
  scenarioId: string,
  profileId: string,
  policy: PolicyDescriptor,
  maxSteps: number,
): string {
  return `${scenarioId}/${profileId}/${policy.id}@${policy.version}/${maxSteps}/${fingerprintCanonicalJson(policy.config)}`;
}

function createManifest(
  scenario: SimulationBenchmarkScenario,
  profile: SimulationBenchmarkProfile,
  policy: PolicyDescriptor,
  maxSteps: number,
): SimulationManifest {
  const requests: SimulationRequestInput[] = scenario.seeds.map((seed) => ({
    config: {
      ruleset: scenario.ruleset,
      seed,
      initialProfile: profile.initialProfile,
    },
    policy,
    maxSteps,
  }));

  return normalizeSimulationManifest({
    schemaVersion: SIMULATION_MANIFEST_SCHEMA_VERSION,
    requests,
  });
}

function createCases(
  config: SimulationBenchmarkConfig,
): readonly BenchmarkCase[] {
  const cases: BenchmarkCase[] = [];
  for (const scenario of config.scenarios) {
    for (const profile of scenario.profiles) {
      for (const policy of scenario.policies) {
        for (const maxSteps of scenario.stepLimits) {
          cases.push({
            caseId: createCaseId(scenario.id, profile.id, policy, maxSteps),
            scenarioId: scenario.id,
            profileId: profile.id,
            policy,
            maxSteps,
            manifest: createManifest(scenario, profile, policy, maxSteps),
          });
        }
      }
    }
  }

  return Object.freeze(
    cases.sort((left, right) =>
      left.caseId < right.caseId ? -1 : left.caseId > right.caseId ? 1 : 0,
    ),
  );
}

function benchmarkInputFingerprint(
  config: SimulationBenchmarkConfig,
  cases: readonly BenchmarkCase[],
): string {
  return fingerprintCanonicalJson({
    schemaVersion: SIMULATION_BENCHMARK_SCHEMA_VERSION,
    strategies: config.strategies,
    scenarios: config.scenarios.map((scenario) => ({
      id: scenario.id,
      batchSizes: scenario.batchSizes,
    })),
    cases: cases.map((benchmarkCase) => ({
      caseId: benchmarkCase.caseId,
      manifest: benchmarkCase.manifest,
    })),
  });
}

function checkHeapValue(value: number, label: string): number {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${label} must be a non-negative safe integer`);
  }
  return value;
}

function checkClockValue(value: number, label: string): number {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${label} must be a non-negative finite number`);
  }
  return value;
}

function roundMeasurement(value: number): number {
  const rounded = Math.round(value * 1_000) / 1_000;
  return Object.is(rounded, -0) ? 0 : rounded;
}

function terminalCounts(results: readonly SimulationResultRecord[]): {
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

function normalizedBatchExport(
  manifest: SimulationManifest,
  results: readonly RunResult[],
): SimulationBatchExport {
  if (results.length !== manifest.requests.length) {
    throw new Error(
      `Simulation benchmark runner returned ${results.length} results for ${manifest.requests.length} requests`,
    );
  }

  const records = results.map((result, requestIndex) => ({
    requestIndex,
    requestFingerprint: simulationRequestFingerprint(
      manifest.requests[requestIndex]!,
    ),
    result,
  }));
  records.sort((left, right) =>
    left.requestFingerprint < right.requestFingerprint
      ? -1
      : left.requestFingerprint > right.requestFingerprint
        ? 1
        : left.requestIndex - right.requestIndex,
  );
  return normalizeSimulationBatchExport({
    schemaVersion: SIMULATION_BATCH_EXPORT_SCHEMA_VERSION,
    manifest,
    results: records,
  });
}

async function runSequential(
  runner: SimulationRunner,
  policies: SimulationPolicyRegistry,
  manifest: SimulationManifest,
  batchSize: number,
  readHeapUsedBytes: () => number,
): Promise<BatchExecution> {
  const requests = manifest.requests.map((request) =>
    resolveSimulationRequest(request, policies),
  );
  const results: Array<RunResult | undefined> = Array<RunResult | undefined>(
    requests.length,
  ).fill(undefined);
  let peakHeapUsedBytes = 0;

  for (let start = 0; start < requests.length; start += batchSize) {
    const end = Math.min(start + batchSize, requests.length);
    const batchResults = await runner.runBatch(requests.slice(start, end));
    if (batchResults.length !== end - start) {
      throw new Error(
        `Simulation benchmark runner returned ${batchResults.length} results for batch size ${end - start}`,
      );
    }
    for (let index = 0; index < batchResults.length; index += 1) {
      results[start + index] = batchResults[index];
    }
    peakHeapUsedBytes = Math.max(
      peakHeapUsedBytes,
      checkHeapValue(readHeapUsedBytes(), "Heap usage"),
    );
  }

  const completeResults = results.map((result, index) => {
    if (result === undefined) {
      throw new Error(`Simulation benchmark missing result ${index}`);
    }
    return result;
  });
  const batchExport = normalizedBatchExport(manifest, completeResults);
  const canonicalResult = stringifySimulationBatchExport(batchExport);

  return Object.freeze({
    batchExport,
    canonicalResult,
    resultFingerprint: fingerprintCanonicalJson(batchExport),
    peakHeapUsedBytes,
  });
}

async function execute(
  strategy: SimulationBenchmarkStrategy,
  runner: SimulationRunner,
  policies: SimulationPolicyRegistry,
  manifest: SimulationManifest,
  batchSize: number,
  environment: SimulationBenchmarkEnvironment,
): Promise<MeasuredExecution> {
  const heapUsedBeforeBytes = checkHeapValue(
    environment.readHeapUsedBytes(),
    "Heap usage",
  );
  const start = checkClockValue(environment.now(), "Benchmark clock");
  const result = await runSequential(
    runner,
    policies,
    manifest,
    batchSize,
    environment.readHeapUsedBytes,
  );
  const end = checkClockValue(environment.now(), "Benchmark clock");
  const elapsedMilliseconds = end - start;
  if (elapsedMilliseconds <= 0) {
    throw new RangeError("Benchmark clock must advance during an execution");
  }
  const peakHeapUsedBytes = Math.max(
    result.peakHeapUsedBytes,
    checkHeapValue(environment.readHeapUsedBytes(), "Heap usage"),
    heapUsedBeforeBytes,
  );
  const heapDeltaBytes = peakHeapUsedBytes - heapUsedBeforeBytes;
  const runsPerSecond =
    (manifest.requests.length * 1_000) / elapsedMilliseconds;

  return Object.freeze({
    ...result,
    elapsedMilliseconds: roundMeasurement(elapsedMilliseconds),
    heapUsedBeforeBytes,
    heapDeltaBytes,
    runsPerSecond: roundMeasurement(runsPerSecond),
    peakHeapUsedBytes,
  });
}

function comparisonFingerprint(report: SimulationComparisonReport): string {
  return fingerprintCanonicalJson(report);
}

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

/** Executes a reproducible host benchmark without retaining per-step traces. */
export function createSimulationBenchmark(
  runner: SimulationRunner,
  policies: SimulationPolicyRegistry = simulationPolicyRegistry,
  environment: SimulationBenchmarkEnvironment,
) {
  return Object.freeze({
    async run(input: unknown): Promise<SimulationBenchmarkReport> {
      const config = normalizeSimulationBenchmark(input);
      const cases = createCases(config);
      const inputFingerprint = benchmarkInputFingerprint(config, cases);
      const measurements: SimulationBenchmarkMeasurement[] = [];
      const resultCases: SimulationBenchmarkResultCase[] = [];
      const comparisons: SimulationBenchmarkComparisonCase[] = [];
      const resultCanonicalByCase = new Map<string, string>();
      let stable = true;
      const comparison = createSimulationComparison(runner, policies);

      for (const benchmarkCase of cases) {
        const scenario = config.scenarios.find(
          (candidate) => candidate.id === benchmarkCase.scenarioId,
        );
        if (scenario === undefined) {
          throw new Error(
            `Missing benchmark scenario ${benchmarkCase.scenarioId}`,
          );
        }

        for (const strategy of config.strategies) {
          for (const batchSize of scenario.batchSizes) {
            for (
              let repetition = 0;
              repetition < config.warmupRepetitions;
              repetition += 1
            ) {
              await execute(
                strategy,
                runner,
                policies,
                benchmarkCase.manifest,
                batchSize,
                environment,
              );
            }

            let firstExecution: MeasuredExecution | undefined;
            let stableAcrossRepetitions = true;
            for (
              let repetition = 0;
              repetition < config.repetitions;
              repetition += 1
            ) {
              const execution = await execute(
                strategy,
                runner,
                policies,
                benchmarkCase.manifest,
                batchSize,
                environment,
              );
              firstExecution ??= execution;
              if (
                execution.canonicalResult !== firstExecution.canonicalResult
              ) {
                stableAcrossRepetitions = false;
                stable = false;
              }
              measurements.push(
                Object.freeze({
                  caseId: benchmarkCase.caseId,
                  scenarioId: benchmarkCase.scenarioId,
                  profileId: benchmarkCase.profileId,
                  policy: benchmarkCase.policy,
                  maxSteps: benchmarkCase.maxSteps,
                  strategy,
                  batchSize,
                  repetition,
                  runCount: benchmarkCase.manifest.requests.length,
                  elapsedMilliseconds: execution.elapsedMilliseconds,
                  runsPerSecond: execution.runsPerSecond,
                  heapUsedBeforeBytes: execution.heapUsedBeforeBytes,
                  peakHeapUsedBytes: execution.peakHeapUsedBytes,
                  heapDeltaBytes: execution.heapDeltaBytes,
                }),
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
            const summary = terminalCounts(firstExecution.batchExport.results);
            resultCases.push(
              Object.freeze({
                caseId: benchmarkCase.caseId,
                scenarioId: benchmarkCase.scenarioId,
                profileId: benchmarkCase.profileId,
                policy: benchmarkCase.policy,
                maxSteps: benchmarkCase.maxSteps,
                strategy,
                batchSize,
                requestCount: benchmarkCase.manifest.requests.length,
                resultFingerprint: firstExecution.resultFingerprint,
                stableAcrossRepetitions,
                terminalReasons: Object.freeze({
                  lifespan: summary.lifespan,
                  combat: summary.combat,
                  "step-limit": summary["step-limit"],
                }),
                progressingRunCount: summary.progressingRunCount,
              }),
            );
          }

          let firstComparison: string | undefined;
          let firstComparisonReport: SimulationComparisonReport | undefined;
          let stableComparison = true;
          let pairCount = 0;
          let behavioralDifferenceCount = 0;
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
            pairCount = comparisonReport.aggregateDifferences.pairCount;
            behavioralDifferenceCount =
              comparisonReport.aggregateDifferences.behavioralDifferenceCount;
          }
          if (
            firstComparison === undefined ||
            firstComparisonReport === undefined
          ) {
            throw new Error("Simulation benchmark produced no comparison");
          }
          comparisons.push(
            Object.freeze({
              caseId: benchmarkCase.caseId,
              strategy,
              comparisonFingerprint: comparisonFingerprint(
                firstComparisonReport,
              ),
              pairCount,
              behavioralDifferenceCount,
              stable: stableComparison,
            }),
          );
        }
      }

      const deterministicPayload = {
        schemaVersion: SIMULATION_BENCHMARK_SCHEMA_VERSION,
        inputFingerprint,
        resultCases,
        comparisons,
      };
      const deterministic = Object.freeze({
        schemaVersion: SIMULATION_BENCHMARK_SCHEMA_VERSION,
        inputFingerprint,
        resultFingerprint: fingerprintCanonicalJson(deterministicPayload),
        stable,
        resultCases: Object.freeze(resultCases),
        comparisons: Object.freeze(comparisons),
      });
      const minimumMeasuredRunsPerSecond = Math.min(
        ...measurements.map((measurement) => measurement.runsPerSecond),
      );
      const maximumMeasuredHeapDeltaBytes = Math.max(
        ...measurements.map((measurement) => measurement.heapDeltaBytes),
      );
      const targets = Object.freeze({
        ...config.targets,
        minimumMeasuredRunsPerSecond: roundMeasurement(
          minimumMeasuredRunsPerSecond,
        ),
        maximumMeasuredHeapDeltaBytes,
        met:
          stable &&
          minimumMeasuredRunsPerSecond >= config.targets.minimumRunsPerSecond &&
          maximumMeasuredHeapDeltaBytes <= config.targets.maximumHeapDeltaBytes,
      });

      return Object.freeze({
        schemaVersion: SIMULATION_BENCHMARK_SCHEMA_VERSION,
        deterministic,
        measurements: Object.freeze(measurements),
        targets,
        host: Object.freeze({ ...environment.host }),
      });
    },
  });
}
