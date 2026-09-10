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
  readonly metrics: Readonly<Record<string, number>>;
}

export interface SimulationRunner {
  run(request: SimulationRequest): RunResult;
  runBatch(
    requests: readonly SimulationRequest[],
  ): Promise<readonly RunResult[]>;
}
