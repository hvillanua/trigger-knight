import type {
  GameEvent,
  RunResult,
  RunState,
  RunMetricKey,
  RunMetrics,
  SimulationAggregateStatistics,
  SimulationBatchExport,
  SimulationNumericSummary,
  SimulationReport,
  SimulationReportGroup,
  SimulationTerminalCounts,
} from "../application/contracts.js";
import { SIMULATION_REPORT_SCHEMA_VERSION } from "../application/contracts.js";
import { fingerprintCanonicalJson } from "../application/canonical-json.js";
import {
  normalizePolicyDescriptor,
  stringifyPolicyDescriptor,
} from "./policy-descriptor.js";

/** Stable metric order used by results, reports, and comparison deltas. */
export const RUN_METRIC_KEYS = Object.freeze([
  "combat.battles-started",
  "combat.critical-hits",
  "combat.damage",
  "combat.hits",
  "combat.lethal-hits",
  "combat.reward-gold",
  "combat.reward-profile-exp",
  "combat.reward-score",
  "combat.rewards",
  "encounters.battles",
  "encounters.promoted",
  "encounters.shop-departures",
  "encounters.shops",
  "progression.achievements-unlocked",
  "progression.dragon-kills",
  "progression.equipment-discoveries",
  "progression.profile-exp-earned",
  "purchases.completed",
  "purchases.gold-spent",
] as const satisfies readonly RunMetricKey[]);

const REPORT_DECIMAL_PLACES = 6;
const REPORT_DECIMAL_FACTOR = 10 ** REPORT_DECIMAL_PLACES;

function normalizeReportNumber(value: number): number {
  if (!Number.isFinite(value)) {
    throw new TypeError("Simulation report numbers must be finite");
  }

  const rounded =
    Math.round(value * REPORT_DECIMAL_FACTOR) / REPORT_DECIMAL_FACTOR;
  return Object.is(rounded, -0) ? 0 : rounded;
}

function emptyMetricValues(): Record<RunMetricKey, number> {
  return Object.fromEntries(RUN_METRIC_KEYS.map((key) => [key, 0])) as Record<
    RunMetricKey,
    number
  >;
}

function addMetric(
  values: Record<RunMetricKey, number>,
  key: RunMetricKey,
  amount = 1,
): void {
  values[key] = normalizeReportNumber(values[key] + amount);
}

function addEventMetrics(
  values: Record<RunMetricKey, number>,
  event: GameEvent,
): void {
  switch (event.type) {
    case "encounter-promoted":
      addMetric(values, "encounters.promoted");
      addMetric(
        values,
        event.encounter.kind === "shop"
          ? "encounters.shops"
          : "encounters.battles",
      );
      break;
    case "shop-departed":
      addMetric(values, "encounters.shop-departures");
      break;
    case "shop-purchased":
      addMetric(values, "purchases.completed");
      addMetric(values, "purchases.gold-spent", event.price);
      break;
    case "battle-started":
      addMetric(values, "combat.battles-started");
      break;
    case "combat-hit":
      addMetric(values, "combat.hits");
      addMetric(values, "combat.damage", event.damage);
      if (event.critical) addMetric(values, "combat.critical-hits");
      break;
    case "combat-lethal-hit":
      addMetric(values, "combat.lethal-hits");
      break;
    case "battle-reward":
      addMetric(values, "combat.rewards");
      addMetric(values, "combat.reward-gold", event.gold);
      addMetric(values, "combat.reward-profile-exp", event.profileExp);
      addMetric(values, "combat.reward-score", event.score);
      break;
    case "equipment-discovered":
      addMetric(values, "progression.equipment-discoveries");
      break;
    case "achievement-unlocked":
      addMetric(values, "progression.achievements-unlocked");
      break;
  }
}

export interface RunMetricsAccumulator {
  add(events: readonly GameEvent[]): void;
  finish(state: Readonly<RunState>): RunMetrics;
}

/** Accumulates compact metrics without retaining a run's diagnostic history. */
export function createRunMetricsAccumulator(): RunMetricsAccumulator {
  const values = emptyMetricValues();

  return Object.freeze({
    add(events: readonly GameEvent[]): void {
      for (const event of events) addEventMetrics(values, event);
    },
    finish(state: Readonly<RunState>): RunMetrics {
      values["progression.profile-exp-earned"] = normalizeReportNumber(
        state.profileExpEarned,
      );
      values["progression.dragon-kills"] = normalizeReportNumber(
        state.dragonKills,
      );

      return Object.freeze(
        Object.fromEntries(RUN_METRIC_KEYS.map((key) => [key, values[key]])),
      ) as RunMetrics;
    },
  });
}

/** Derives compact metrics from public outcomes and authoritative terminal state. */
export function collectRunMetrics(
  events: readonly GameEvent[],
  state: Readonly<RunState>,
): RunMetrics {
  const accumulator = createRunMetricsAccumulator();
  accumulator.add(events);
  return accumulator.finish(state);
}

function createNumericSummary(
  values: readonly number[],
): SimulationNumericSummary {
  if (values.length === 0) {
    return Object.freeze({
      count: 0,
      sum: 0,
      mean: 0,
      minimum: null,
      maximum: null,
    });
  }

  const sum = values.reduce((total, value) => total + value, 0);
  return Object.freeze({
    count: values.length,
    sum: normalizeReportNumber(sum),
    mean: normalizeReportNumber(sum / values.length),
    minimum: normalizeReportNumber(Math.min(...values)),
    maximum: normalizeReportNumber(Math.max(...values)),
  });
}

function metricValue(result: RunResult, key: RunMetricKey): number {
  const value = result.metrics[key];
  if (value === undefined) return 0;
  return normalizeReportNumber(value);
}

function terminalCounts(
  results: readonly RunResult[],
): SimulationTerminalCounts {
  const counts = { lifespan: 0, combat: 0, "step-limit": 0 };
  for (const result of results) counts[result.terminalReason] += 1;
  return Object.freeze(counts);
}

function isCompleted(result: RunResult): boolean {
  return result.terminalReason !== "step-limit";
}

function createAggregateStatistics(
  results: readonly RunResult[],
  completedResults: readonly RunResult[],
): SimulationAggregateStatistics {
  const metricSummary = Object.fromEntries(
    RUN_METRIC_KEYS.map((key) => [
      key,
      createNumericSummary(results.map((result) => metricValue(result, key))),
    ]),
  ) as Record<RunMetricKey, SimulationNumericSummary>;

  return Object.freeze({
    steps: createNumericSummary(results.map((result) => result.steps)),
    activeTicks: createNumericSummary(
      results.map((result) => result.activeTicks),
    ),
    score: createNumericSummary(results.map((result) => result.score)),
    day: createNumericSummary(results.map((result) => result.day)),
    distance: createNumericSummary(results.map((result) => result.distance)),
    gold: createNumericSummary(results.map((result) => result.gold)),
    encounters: Object.freeze({
      promoted: metricSummary["encounters.promoted"],
      shops: metricSummary["encounters.shops"],
      battles: metricSummary["encounters.battles"],
    }),
    progression: Object.freeze({
      profileExpEarned: createNumericSummary(
        completedResults.map((result) =>
          metricValue(result, "progression.profile-exp-earned"),
        ),
      ),
    }),
    metrics: Object.freeze(metricSummary),
  });
}

interface ReportRun {
  readonly requestIndex: number;
  readonly requestFingerprint: string;
  readonly request: SimulationBatchExport["manifest"]["requests"][number];
  readonly result: RunResult;
}

function reportRuns(input: SimulationBatchExport): ReportRun[] {
  const seen = new Set<number>();
  return input.results.map((record) => {
    if (
      !Number.isSafeInteger(record.requestIndex) ||
      record.requestIndex < 0 ||
      record.requestIndex >= input.manifest.requests.length ||
      seen.has(record.requestIndex)
    ) {
      throw new Error(
        `Invalid or duplicate simulation result requestIndex ${record.requestIndex}`,
      );
    }
    seen.add(record.requestIndex);
    const request = input.manifest.requests[record.requestIndex]!;
    if (record.requestFingerprint !== fingerprintCanonicalJson(request)) {
      throw new Error(
        `Simulation result ${record.requestIndex} has a mismatched request fingerprint`,
      );
    }
    if (
      record.result.ruleset !== request.config.ruleset ||
      record.result.seed !== request.config.seed ||
      record.result.maxSteps !== request.maxSteps ||
      record.result.initialProfileFingerprint !==
        fingerprintCanonicalJson(request.config.initialProfile) ||
      stringifyPolicyDescriptor(record.result.policy) !==
        stringifyPolicyDescriptor(request.policy)
    ) {
      throw new Error(
        `Simulation result ${record.requestIndex} does not match its retained request`,
      );
    }
    return Object.freeze({
      requestIndex: record.requestIndex,
      requestFingerprint: record.requestFingerprint,
      request,
      result: record.result,
    });
  });
}

function groupIdentity(run: ReportRun): {
  readonly key: string;
  readonly ruleset: string;
  readonly initialProfileFingerprint: string;
  readonly policy: ReturnType<typeof normalizePolicyDescriptor>;
  readonly maxSteps: number;
} {
  const policy = normalizePolicyDescriptor(run.request.policy);
  const initialProfileFingerprint = fingerprintCanonicalJson(
    run.request.config.initialProfile,
  );
  const identity = {
    ruleset: run.request.config.ruleset,
    initialProfileFingerprint,
    policy,
    maxSteps: run.request.maxSteps,
  };
  return Object.freeze({
    key: fingerprintCanonicalJson(identity),
    ruleset: identity.ruleset,
    initialProfileFingerprint,
    policy,
    maxSteps: identity.maxSteps,
  });
}

function createGroup(runs: readonly ReportRun[]): SimulationReportGroup {
  const first = runs[0]!;
  const identity = groupIdentity(first);
  const results = runs.map((run) => run.result);
  const completedResults = results.filter(isCompleted);
  const terminalReasons = terminalCounts(results);

  return Object.freeze({
    key: identity.key,
    runCount: results.length,
    completedRunCount: completedResults.length,
    truncatedRunCount: results.length - completedResults.length,
    terminalReasons,
    ruleset: identity.ruleset,
    initialProfileFingerprint: identity.initialProfileFingerprint,
    policy: identity.policy,
    maxSteps: identity.maxSteps,
    ...createAggregateStatistics(results, completedResults),
  });
}

/** Creates a deterministic report without retaining diagnostic traces. */
export function createSimulationReport(
  input: SimulationBatchExport,
): SimulationReport {
  const runs = reportRuns(input);
  if (runs.length !== input.manifest.requests.length) {
    throw new Error(
      `Simulation export contains ${runs.length} results for ${input.manifest.requests.length} requests`,
    );
  }

  const results = runs.map((run) => run.result);
  const completedResults = results.filter(isCompleted);
  const groups = new Map<string, ReportRun[]>();
  for (const run of runs) {
    const key = groupIdentity(run).key;
    const group = groups.get(key) ?? [];
    group.push(run);
    groups.set(key, group);
  }
  const sortedGroups = [...groups.entries()]
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
    .map(([, group]) => createGroup(group));
  const truncatedRunCount = results.length - completedResults.length;

  return Object.freeze({
    schemaVersion: SIMULATION_REPORT_SCHEMA_VERSION,
    inputFingerprint: fingerprintCanonicalJson(input.manifest),
    runCount: results.length,
    completedRunCount: completedResults.length,
    truncatedRunCount,
    terminalReasons: terminalCounts(results),
    truncation: Object.freeze({
      count: truncatedRunCount,
      frequency: normalizeReportNumber(
        results.length === 0 ? 0 : truncatedRunCount / results.length,
      ),
      excludedProgressionRunCount: truncatedRunCount,
      progressionStatistics: "completed-runs-only" as const,
    }),
    overall: createAggregateStatistics(results, completedResults),
    groups: Object.freeze(sortedGroups),
  });
}

export { createNumericSummary as summarizeSimulationNumbers };
