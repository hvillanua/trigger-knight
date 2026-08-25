import type { RuleSetId, RunState } from "./contracts.js";
import { createRandomState } from "./random.js";

export const RUN_STATE_SCHEMA_VERSION = 1 as const;

/** Creates a fresh minimal state value for one independent run. */
export function createRunState(ruleset: RuleSetId, seed: string): RunState {
  return Object.freeze({
    schemaVersion: RUN_STATE_SCHEMA_VERSION,
    ruleset,
    random: createRandomState(seed),
    steps: 0,
  });
}

/** Advances the ruleset-foundation run by one logical engine step. */
export function advanceRunState(state: Readonly<RunState>): RunState {
  return Object.freeze({
    schemaVersion: RUN_STATE_SCHEMA_VERSION,
    ruleset: state.ruleset,
    random: Object.freeze({ ...state.random }),
    steps: state.steps + 1,
  });
}
