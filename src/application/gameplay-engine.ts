import type {
  GameCommand,
  GameEvent,
  GameObservation,
  RunState,
} from "../domain/contracts.js";
import type { RuleSetRegistry } from "../domain/rulesets.js";
import { normalizeProfile } from "../domain/profile.js";
import { normalizeRunConfig, type RunConfig } from "./run-config.js";

export type { RunConfig } from "./run-config.js";

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
      const normalizedConfig = normalizeRunConfig(config);
      const options =
        normalizedConfig.startImmediately === undefined
          ? undefined
          : { startImmediately: normalizedConfig.startImmediately };
      return registry
        .resolve(normalizedConfig.ruleset)
        .createRun(
          normalizedConfig.seed,
          normalizeProfile(normalizedConfig.initialProfile),
          options,
        );
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
