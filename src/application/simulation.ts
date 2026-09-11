import type {
  GameCommand,
  GameEvent,
  GameObservation,
  RuleSetId,
  RunTerminalReason,
} from "../domain/contracts.js";
import type { RunConfig } from "./gameplay-engine.js";

type PolicyConfigValue =
  | boolean
  | number
  | string
  | null
  | readonly PolicyConfigValue[]
  | { readonly [key: string]: PolicyConfigValue };

/** Normalized serializable configuration that can affect policy decisions. */
export type PolicyConfig = Readonly<Record<string, PolicyConfigValue>>;

export interface PolicyDescriptor {
  readonly id: string;
  readonly version: string;
  readonly config: PolicyConfig;
}

/** @playerVisible Ordinary automated-player input and command boundary. */
export interface PlayerAgent {
  decide(
    observation: Readonly<GameObservation>,
    events: readonly GameEvent[],
  ): readonly GameCommand[];
}

export interface PlayerPolicy {
  readonly descriptor: PolicyDescriptor;
  createAgent(): PlayerAgent;
}

/** Version for the serializable experiment input envelope. */
export const SIMULATION_MANIFEST_SCHEMA_VERSION = 1 as const;

/** Version for the normalized batch export envelope. */
export const SIMULATION_BATCH_EXPORT_SCHEMA_VERSION = 1 as const;

/** Version for normalized run results after metrics became populated. */
export const SIMULATION_RUN_RESULT_SCHEMA_VERSION = 3 as const;

/** Version for aggregate simulation reports. */
export const SIMULATION_REPORT_SCHEMA_VERSION = 1 as const;

/** Version for paired simulation comparison inputs and reports. */
export const SIMULATION_COMPARISON_SCHEMA_VERSION = 1 as const;

export type RunMetricKey =
  | "combat.battles-started"
  | "combat.critical-hits"
  | "combat.damage"
  | "combat.hits"
  | "combat.lethal-hits"
  | "combat.reward-gold"
  | "combat.reward-profile-exp"
  | "combat.reward-score"
  | "combat.rewards"
  | "encounters.battles"
  | "encounters.promoted"
  | "encounters.shop-departures"
  | "encounters.shops"
  | "progression.achievements-unlocked"
  | "progression.dragon-kills"
  | "progression.equipment-discoveries"
  | "progression.profile-exp-earned"
  | "purchases.completed"
  | "purchases.gold-spent";

/** Compact event and authoritative-state measurements for one run. */
export type RunMetrics = Readonly<Record<RunMetricKey, number>>;

/** Deterministic summary of one numeric outcome field. */
export interface SimulationNumericSummary {
  readonly count: number;
  readonly sum: number;
  readonly mean: number;
  readonly minimum: number | null;
  readonly maximum: number | null;
}

export interface SimulationTerminalCounts {
  readonly lifespan: number;
  readonly combat: number;
  readonly "step-limit": number;
}

export interface SimulationAggregateStatistics {
  readonly steps: SimulationNumericSummary;
  readonly activeTicks: SimulationNumericSummary;
  readonly score: SimulationNumericSummary;
  readonly day: SimulationNumericSummary;
  readonly distance: SimulationNumericSummary;
  readonly gold: SimulationNumericSummary;
  readonly encounters: Readonly<{
    readonly promoted: SimulationNumericSummary;
    readonly shops: SimulationNumericSummary;
    readonly battles: SimulationNumericSummary;
  }>;
  /** Progression statistics include gameplay-death runs only, never step limits. */
  readonly progression: Readonly<{
    readonly profileExpEarned: SimulationNumericSummary;
  }>;
  readonly metrics: Readonly<Record<RunMetricKey, SimulationNumericSummary>>;
}

export interface SimulationReportGroup extends SimulationAggregateStatistics {
  readonly key: string;
  readonly runCount: number;
  readonly completedRunCount: number;
  readonly truncatedRunCount: number;
  readonly terminalReasons: SimulationTerminalCounts;
  readonly ruleset: RuleSetId;
  readonly initialProfileFingerprint: string;
  readonly policy: PolicyDescriptor;
  readonly maxSteps: number;
}

export interface SimulationReport {
  readonly schemaVersion: typeof SIMULATION_REPORT_SCHEMA_VERSION;
  readonly inputFingerprint: string;
  readonly runCount: number;
  readonly completedRunCount: number;
  readonly truncatedRunCount: number;
  readonly terminalReasons: SimulationTerminalCounts;
  readonly truncation: Readonly<{
    readonly count: number;
    readonly frequency: number;
    readonly excludedProgressionRunCount: number;
    readonly progressionStatistics: "completed-runs-only";
  }>;
  readonly overall: SimulationAggregateStatistics;
  readonly groups: readonly SimulationReportGroup[];
}

export type SimulationPolicyComparison = "same-policy" | "allow-different";

export interface SimulationComparisonInput {
  readonly schemaVersion: typeof SIMULATION_COMPARISON_SCHEMA_VERSION;
  readonly baseline: SimulationManifest;
  readonly candidate: SimulationManifest;
  readonly policyComparison: SimulationPolicyComparison;
}

export interface SimulationPairSide {
  readonly requestIndex: number;
  readonly requestFingerprint: string;
  readonly ruleset: RuleSetId;
  readonly seed: string;
  readonly initialProfileFingerprint: string;
  readonly policy: PolicyDescriptor;
  readonly maxSteps: number;
  readonly terminalReason: RunResult["terminalReason"];
  readonly traceHash: string;
}

export type RunMetricDeltas = Readonly<Record<RunMetricKey, number>>;

export interface SimulationPairDeltas {
  readonly steps: number;
  readonly activeTicks: number;
  readonly score: number;
  readonly day: number;
  readonly distance: number;
  readonly gold: number;
  readonly metrics: RunMetricDeltas;
}

export interface SimulationPairReport {
  readonly key: string;
  readonly seed: string;
  readonly initialProfileFingerprint: string;
  readonly maxSteps: number;
  readonly baseline: SimulationPairSide;
  readonly candidate: SimulationPairSide;
  readonly behavioralDifference: boolean;
  readonly deltas: SimulationPairDeltas;
}

export interface SimulationAggregateDifferences {
  readonly pairCount: number;
  readonly behavioralDifferenceCount: number;
  readonly terminalReasonChangeCount: number;
  readonly steps: SimulationNumericSummary;
  readonly activeTicks: SimulationNumericSummary;
  readonly score: SimulationNumericSummary;
  readonly day: SimulationNumericSummary;
  readonly distance: SimulationNumericSummary;
  readonly gold: SimulationNumericSummary;
  readonly metrics: Readonly<Record<RunMetricKey, SimulationNumericSummary>>;
}

export interface SimulationComparisonReport {
  readonly schemaVersion: typeof SIMULATION_COMPARISON_SCHEMA_VERSION;
  readonly policyComparison: SimulationPolicyComparison;
  readonly baseline: Readonly<{
    readonly inputFingerprint: string;
    readonly report: SimulationReport;
  }>;
  readonly candidate: Readonly<{
    readonly inputFingerprint: string;
    readonly report: SimulationReport;
  }>;
  readonly pairs: readonly SimulationPairReport[];
  readonly aggregateDifferences: SimulationAggregateDifferences;
}

/** Application service for paired retained-experiment comparisons. */
export interface SimulationComparison {
  run(input: SimulationComparisonInput): Promise<SimulationComparisonReport>;
}

/** Serializable request input with no live policy or agent object. */
export interface SimulationRequestInput {
  readonly config: RunConfig;
  readonly policy: PolicyDescriptor;
  readonly maxSteps: number;
}

/** Versioned, JSON-compatible collection of retained simulation inputs. */
export interface SimulationManifest {
  readonly schemaVersion: typeof SIMULATION_MANIFEST_SCHEMA_VERSION;
  readonly requests: readonly SimulationRequestInput[];
}

/** One result linked back to the retained request that produced it. */
export interface SimulationResultRecord {
  readonly requestIndex: number;
  readonly requestFingerprint: string;
  readonly result: RunResult;
}

/** Canonical batch output containing all inputs needed for later reproduction. */
export interface SimulationBatchExport {
  readonly schemaVersion: typeof SIMULATION_BATCH_EXPORT_SCHEMA_VERSION;
  readonly manifest: SimulationManifest;
  readonly results: readonly SimulationResultRecord[];
}

/** Lookup boundary for versioned, serializable policy descriptors. */
export interface SimulationPolicyRegistry {
  readonly supported: readonly PolicyDescriptor[];
  resolve(descriptor: PolicyDescriptor): PlayerPolicy;
}

/** Application service for executing retained simulation inputs. */
export interface SimulationExperiment {
  run(manifest: SimulationManifest): Promise<SimulationBatchExport>;
}

export interface SimulationRequest {
  readonly config: RunConfig;
  readonly policy: PlayerPolicy;
  readonly maxSteps: number;
}

export interface RunResult {
  readonly schemaVersion: number;
  readonly ruleset: RuleSetId;
  readonly seed: string;
  readonly initialProfileFingerprint: string;
  readonly policy: PolicyDescriptor;
  readonly maxSteps: number;
  readonly steps: number;
  readonly activeTicks: number;
  readonly terminalReason: RunTerminalReason | "step-limit";
  readonly score: number;
  readonly day: number;
  readonly distance: number;
  readonly gold: number;
  readonly traceHash: string;
  readonly metrics: RunMetrics;
}

export interface SimulationRunner {
  run(request: SimulationRequest): RunResult;
  runBatch(
    requests: readonly SimulationRequest[],
  ): Promise<readonly RunResult[]>;
}
