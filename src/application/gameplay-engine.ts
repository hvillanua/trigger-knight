import type {
  GameCommand,
  GameEvent,
  GameObservation,
  GameView,
  ProfileState,
  RuleSetId,
  RunState,
} from "../domain/contracts.js";

export interface RunConfig {
  readonly ruleset: RuleSetId;
  readonly seed: string;
  readonly initialProfile: ProfileState;
}

export interface StepResult {
  readonly state: RunState;
  readonly events: readonly GameEvent[];
}

/** Shared gameplay API used by browser and headless consumers. */
export interface GameplayEngine {
  createRun(config: RunConfig): RunState;
  step(state: Readonly<RunState>, commands: readonly GameCommand[]): StepResult;
  observe(state: Readonly<RunState>): GameObservation;
  view(state: Readonly<RunState>): GameView;
}
