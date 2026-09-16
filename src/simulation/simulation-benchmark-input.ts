import type {
  PolicyDescriptor,
  SimulationManifest,
  SimulationRequestInput,
} from "../application/contracts.js";
import { SIMULATION_MANIFEST_SCHEMA_VERSION } from "../application/contracts.js";
import {
  fingerprintCanonicalJson,
  normalizeCanonicalJson,
  stringifyCanonicalJson,
} from "./canonical-json.js";
import { normalizeSimulationManifest } from "./simulation-experiment.js";
import { normalizePolicyDescriptor } from "./policy-descriptor.js";
import {
  assertExactKeys,
  normalizeProfileInput,
  positiveSafeInteger,
  record,
} from "./simulation-validation.js";
import type {
  SimulationBenchmarkCase,
  SimulationBenchmarkConfig,
  SimulationBenchmarkProfile,
  SimulationBenchmarkScenario,
  SimulationBenchmarkStrategy,
  SimulationBenchmarkTargets,
} from "./simulation-benchmark-types.js";
import {
  SIMULATION_BENCHMARK_SCHEMA_VERSION,
  SIMULATION_BENCHMARK_STRATEGIES,
} from "./simulation-benchmark-types.js";

function nonEmptyString(input: unknown, label: string): string {
  if (typeof input !== "string" || input.length === 0) {
    throw new TypeError(`${label} must be a non-empty string`);
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

function normalizeBenchmarkProfile(
  input: unknown,
  scenarioId: string,
): SimulationBenchmarkProfile {
  const value = record(
    normalizeCanonicalJson(input),
    `Benchmark scenario ${scenarioId} profile`,
  );
  assertExactKeys(value, ["id", "initialProfile"], "Benchmark profile");

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
  const values = input.map((value) => positiveSafeInteger(value, label));
  unique(values, label);
  return Object.freeze(values);
}

function normalizeScenario(input: unknown): SimulationBenchmarkScenario {
  const value = record(
    normalizeCanonicalJson(input),
    "Simulation benchmark scenario",
  );
  assertExactKeys(
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
  assertExactKeys(
    value,
    ["basis", "maximumHeapDeltaBytes", "minimumRunsPerSecond"],
    "Simulation benchmark targets",
  );

  return Object.freeze({
    minimumRunsPerSecond: positiveFiniteNumber(
      value.minimumRunsPerSecond,
      "Simulation benchmark minimumRunsPerSecond",
    ),
    maximumHeapDeltaBytes: positiveSafeInteger(
      value.maximumHeapDeltaBytes,
      "Simulation benchmark maximumHeapDeltaBytes",
    ),
    basis: nonEmptyString(value.basis, "Simulation benchmark target basis"),
  });
}

function normalizeStrategies(
  input: unknown,
): readonly SimulationBenchmarkStrategy[] {
  if (!Array.isArray(input) || input.length === 0) {
    throw new TypeError("Simulation benchmark strategies must be non-empty");
  }
  const strategies = input.map((strategy) => {
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
  return Object.freeze(strategies);
}

/** Normalizes a versioned host benchmark configuration. */
export function normalizeSimulationBenchmark(
  input: unknown,
): SimulationBenchmarkConfig {
  const value = record(normalizeCanonicalJson(input), "Simulation benchmark");
  assertExactKeys(
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
  const strategies = normalizeStrategies(value.strategies);
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
    strategies,
    warmupRepetitions: nonNegativeInteger(
      value.warmupRepetitions,
      "Simulation benchmark warmupRepetitions",
    ),
    repetitions: positiveSafeInteger(
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

/** Expands scenario combinations into stable, independently measurable cases. */
export function createSimulationBenchmarkCases(
  config: SimulationBenchmarkConfig,
): readonly SimulationBenchmarkCase[] {
  const cases: SimulationBenchmarkCase[] = [];
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

/** Creates the deterministic identity of a normalized benchmark input. */
export function benchmarkInputFingerprint(
  config: SimulationBenchmarkConfig,
  cases: readonly SimulationBenchmarkCase[],
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
