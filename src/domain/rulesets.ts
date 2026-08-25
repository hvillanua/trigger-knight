import type {
  GameCommand,
  GameEvent,
  GameObservation,
  ProfileState,
  RuleSetId,
  RunState,
} from "./contracts.js";
import { RANDOM_ALGORITHM } from "./random.js";
import { advanceRunState, createRunState } from "./run-state.js";

export const ORIGINAL_V13_RULESET_ID = "original-v1.3" as const;

export interface RuleSetConstants {
  readonly logicalTicksPerSecond: number;
  readonly movement: {
    readonly initialSpeed: number;
    readonly accelerationPerActiveTick: number;
    readonly maximumSpeed: number;
    readonly distancePerSpeedUnit: number;
    readonly distancePerDay: number;
  };
  readonly runningScorePerSpeedUnit: number;
  readonly lifespan: {
    readonly initialWhole: number;
    readonly initialFraction: number;
    readonly drainPerActiveTick: number;
    readonly fractionReset: number;
    readonly deathBelowWhole: number;
  };
  readonly world: {
    readonly originalStageUnitsPerWorldUnit: number;
    readonly initialCameraWidth: number;
    readonly initialCameraHeight: number;
  };
}

export interface RuleSetCompatibilityDecisions {
  readonly randomSequence: typeof RANDOM_ALGORITHM;
  readonly randomCompatibilityTarget: "confirmed-ranges-probabilities-draw-order";
  readonly coordinateModel: "original-stage-units-as-world-units";
}

export interface RuleSetStepResult {
  readonly state: RunState;
  readonly events: readonly GameEvent[];
}

/** Pure gameplay implementation selected by one stable ruleset identity. */
export interface RuleSetImplementation {
  readonly id: RuleSetId;
  readonly constants: RuleSetConstants;
  readonly compatibilityDecisions: RuleSetCompatibilityDecisions;
  createRun(seed: string, initialProfile: Readonly<ProfileState>): RunState;
  step(
    state: Readonly<RunState>,
    commands: readonly GameCommand[],
  ): RuleSetStepResult;
  observe(state: Readonly<RunState>): GameObservation;
}

export interface RuleSetRegistry {
  readonly supportedIds: readonly RuleSetId[];
  resolve(id: RuleSetId): RuleSetImplementation;
}

const originalV13Constants: RuleSetConstants = Object.freeze({
  logicalTicksPerSecond: 30,
  movement: Object.freeze({
    initialSpeed: 0,
    accelerationPerActiveTick: 1,
    maximumSpeed: 15,
    distancePerSpeedUnit: 1,
    distancePerDay: 7_000,
  }),
  runningScorePerSpeedUnit: 10,
  lifespan: Object.freeze({
    initialWhole: 99,
    initialFraction: 99,
    drainPerActiveTick: 4,
    fractionReset: 99,
    deathBelowWhole: 0,
  }),
  world: Object.freeze({
    originalStageUnitsPerWorldUnit: 1,
    initialCameraWidth: 480,
    initialCameraHeight: 320,
  }),
});

const originalV13CompatibilityDecisions: RuleSetCompatibilityDecisions =
  Object.freeze({
    randomSequence: RANDOM_ALGORITHM,
    randomCompatibilityTarget: "confirmed-ranges-probabilities-draw-order",
    coordinateModel: "original-stage-units-as-world-units",
  });

export const originalV13RuleSet: RuleSetImplementation = Object.freeze({
  id: ORIGINAL_V13_RULESET_ID,
  constants: originalV13Constants,
  compatibilityDecisions: originalV13CompatibilityDecisions,

  createRun(seed: string): RunState {
    return createRunState(ORIGINAL_V13_RULESET_ID, seed);
  },

  step(state: Readonly<RunState>): RuleSetStepResult {
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

/** Builds an immutable lookup boundary for independently versioned rulesets. */
export function createRuleSetRegistry(
  implementations: readonly RuleSetImplementation[],
): RuleSetRegistry {
  const byId = new Map<RuleSetId, RuleSetImplementation>();

  for (const implementation of implementations) {
    if (byId.has(implementation.id)) {
      throw new RangeError(`Duplicate ruleset "${implementation.id}"`);
    }

    byId.set(implementation.id, implementation);
  }

  const supportedIds = Object.freeze([...byId.keys()]);

  return Object.freeze({
    supportedIds,
    resolve(id: RuleSetId): RuleSetImplementation {
      const implementation = byId.get(id);

      if (implementation === undefined) {
        throw new RangeError(`Unsupported ruleset "${id}"`);
      }

      return implementation;
    },
  });
}

export const ruleSetRegistry = createRuleSetRegistry([originalV13RuleSet]);
