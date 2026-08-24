import type {
  GameCommand,
  GameEvent,
  GameObservation,
  ProfileState,
  RuleSetId,
  RunState,
} from "../domain/contracts.js";
import { advanceRunState, createRunState } from "../domain/run-state.js";

export const WALKING_SKELETON_RULESET_ID = "walking-skeleton-v1" as const;

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
}

/** Stateless gameplay implementation shared by every future host adapter. */
export const gameplayEngine: GameplayEngine = Object.freeze({
  createRun(config: RunConfig): RunState {
    if (config.ruleset !== WALKING_SKELETON_RULESET_ID) {
      throw new RangeError(`Unsupported ruleset "${config.ruleset}"`);
    }

    return createRunState(config.ruleset, config.seed);
  },

  step(state: Readonly<RunState>): StepResult {
    const nextState = advanceRunState(state);
    const event: GameEvent = Object.freeze({
      type: "step-advanced",
      step: nextState.steps,
    });

    return Object.freeze({
      state: nextState,
      events: Object.freeze([event]),
    });
  },

  observe(state: Readonly<RunState>): GameObservation {
    return Object.freeze({
      ruleset: state.ruleset,
      steps: state.steps,
    });
  },
});
