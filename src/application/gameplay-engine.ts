import type {
  GameCommand,
  GameEvent,
  GameObservation,
  ProfileState,
  RuleSetId,
  RunState,
} from "../domain/contracts.js";
import type { RuleSetRegistry } from "../domain/rulesets.js";

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

/** Creates the shared application API over a ruleset lookup boundary. */
export function createGameplayEngine(
  registry: RuleSetRegistry,
): GameplayEngine {
  return Object.freeze({
    createRun(config: RunConfig): RunState {
      return registry
        .resolve(config.ruleset)
        .createRun(config.seed, config.initialProfile);
    },

    step(
      state: Readonly<RunState>,
      commands: readonly GameCommand[],
    ): StepResult {
      return registry.resolve(state.ruleset).step(state, commands);
    },

    observe(state: Readonly<RunState>): GameObservation {
      return registry.resolve(state.ruleset).observe(state);
    },
  });
}
