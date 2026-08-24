import type {
  GameCommand,
  GameEvent,
  GameObservation,
  RuleSetId,
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
  readonly terminalReason: "lifespan" | "combat" | "step-limit";
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
