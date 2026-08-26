import type {
  GameCommand,
  GameEvent,
  GameObservation,
  InventoryItemId,
  PlayerState,
  ProfileState,
  RuleSetId,
  RunState,
  WorldCamera,
} from "./contracts.js";
import { advanceLifespan } from "./lifespan.js";
import { createPlayerState } from "./player-state.js";
import { RANDOM_ALGORITHM } from "./random.js";
import { advanceRunningProgression } from "./running-progression.js";
import {
  advanceRunState,
  createRunState,
  isActiveGameplay,
} from "./run-state.js";

export const ORIGINAL_V13_RULESET_ID = "original-v1.3" as const;

export interface RuleSetConstants {
  readonly logicalTicksPerSecond: number;
  readonly pregameDelaySteps: number;
  readonly movement: {
    readonly initialSpeed: number;
    readonly accelerationPerActiveTick: number;
    readonly maximumSpeed: number;
    readonly distancePerSpeedUnit: number;
    readonly distancePerDay: number;
  };
  readonly runningScorePerSpeedUnit: number;
  readonly economy: {
    readonly initialGold: number;
  };
  readonly loadout: {
    readonly weapon: {
      readonly initialTier: number;
      readonly baseAttack: number;
      readonly attackPerTier: number;
    };
    readonly armor: {
      readonly initialTier: number;
      readonly baseMaximumHp: number;
      readonly maximumHpPerTier: number;
    };
    readonly initialInventoryItem: InventoryItemId;
  };
  readonly lifespan: {
    readonly initialWhole: number;
    readonly initialFraction: number;
    readonly drainPerActiveTick: number;
    readonly fractionReset: number;
    readonly deathBelowWhole: number;
  };
  readonly world: {
    readonly originalStageUnitsPerWorldUnit: number;
    readonly initialCamera: WorldCamera;
  };
}

export interface RuleSetCompatibilityDecisions {
  readonly randomSequence: typeof RANDOM_ALGORITHM;
  readonly randomCompatibilityTarget: "confirmed-ranges-probabilities-draw-order";
  readonly coordinateModel: "original-stage-units-as-world-units";
  readonly pregameDelayProgression: "after-commands-while-other-gates-open";
  readonly pregameDelayCountsAsActiveGameplay: false;
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
  pregameDelaySteps: 60,
  movement: Object.freeze({
    initialSpeed: 0,
    accelerationPerActiveTick: 1,
    maximumSpeed: 15,
    distancePerSpeedUnit: 1,
    distancePerDay: 7_000,
  }),
  runningScorePerSpeedUnit: 10,
  economy: Object.freeze({
    initialGold: 300,
  }),
  loadout: Object.freeze({
    weapon: Object.freeze({
      initialTier: 1,
      baseAttack: 129,
      attackPerTier: 87,
    }),
    armor: Object.freeze({
      initialTier: 1,
      baseMaximumHp: 1_009,
      maximumHpPerTier: 899,
    }),
    initialInventoryItem: "elixir",
  }),
  lifespan: Object.freeze({
    initialWhole: 99,
    initialFraction: 99,
    drainPerActiveTick: 4,
    fractionReset: 99,
    deathBelowWhole: 0,
  }),
  world: Object.freeze({
    originalStageUnitsPerWorldUnit: 1,
    initialCamera: Object.freeze({
      x: 0,
      y: 0,
      width: 480,
      height: 320,
    }),
  }),
});

const originalV13CompatibilityDecisions: RuleSetCompatibilityDecisions =
  Object.freeze({
    randomSequence: RANDOM_ALGORITHM,
    randomCompatibilityTarget: "confirmed-ranges-probabilities-draw-order",
    coordinateModel: "original-stage-units-as-world-units",
    pregameDelayProgression: "after-commands-while-other-gates-open",
    pregameDelayCountsAsActiveGameplay: false,
  });

const originalV13RunningProgressionRules = Object.freeze({
  accelerationPerActiveTick:
    originalV13Constants.movement.accelerationPerActiveTick,
  maximumSpeed: originalV13Constants.movement.maximumSpeed,
  distancePerSpeedUnit: originalV13Constants.movement.distancePerSpeedUnit,
  distancePerDay: originalV13Constants.movement.distancePerDay,
  scorePerSpeedUnit: originalV13Constants.runningScorePerSpeedUnit,
});

const originalV13LifespanRules = Object.freeze({
  drainPerActiveTick: originalV13Constants.lifespan.drainPerActiveTick,
  fractionReset: originalV13Constants.lifespan.fractionReset,
  deathBelowWhole: originalV13Constants.lifespan.deathBelowWhole,
});

function createOriginalV13InitialPlayerState(): PlayerState {
  const weaponTier = originalV13Constants.loadout.weapon.initialTier;
  const armorTier = originalV13Constants.loadout.armor.initialTier;
  const weaponAttack =
    originalV13Constants.loadout.weapon.baseAttack +
    originalV13Constants.loadout.weapon.attackPerTier * weaponTier;
  const maximumHp =
    originalV13Constants.loadout.armor.baseMaximumHp +
    originalV13Constants.loadout.armor.maximumHpPerTier * armorTier;

  return createPlayerState({
    gold: originalV13Constants.economy.initialGold,
    weapon: { tier: weaponTier, attack: weaponAttack },
    armor: { tier: armorTier },
    hp: { current: maximumHp, maximum: maximumHp },
    inventory: { item: originalV13Constants.loadout.initialInventoryItem },
  });
}

export const originalV13RuleSet: RuleSetImplementation = Object.freeze({
  id: ORIGINAL_V13_RULESET_ID,
  constants: originalV13Constants,
  compatibilityDecisions: originalV13CompatibilityDecisions,

  createRun(seed: string, initialProfile: Readonly<ProfileState>): RunState {
    return createRunState(
      ORIGINAL_V13_RULESET_ID,
      seed,
      originalV13Constants.pregameDelaySteps,
      initialProfile.scoreMultiplier,
      originalV13Constants.movement.initialSpeed,
      Object.freeze({
        whole: originalV13Constants.lifespan.initialWhole,
        fraction: originalV13Constants.lifespan.initialFraction,
      }),
      createOriginalV13InitialPlayerState(),
    );
  },

  step(
    state: Readonly<RunState>,
    commands: readonly GameCommand[],
  ): RuleSetStepResult {
    const result = advanceRunState(state, commands);
    const progressed = advanceRunningProgression(
      state,
      result.state,
      originalV13RunningProgressionRules,
    );
    const lifespan = advanceLifespan(
      state,
      progressed,
      originalV13LifespanRules,
    );

    return Object.freeze({
      state: lifespan.state,
      events: Object.freeze([...result.events, ...lifespan.events]),
    });
  },

  observe(state: Readonly<RunState>): GameObservation {
    const lifecycle = Object.freeze({
      ...state.lifecycle,
      activeGameplay: isActiveGameplay(state.lifecycle),
    });
    const canAcceptLifecycleCommands = state.lifecycle.phase === "running";

    return Object.freeze({
      ruleset: state.ruleset,
      camera: originalV13Constants.world.initialCamera,
      steps: state.steps,
      activeTicks: state.activeTicks,
      movementSpeed: state.movementSpeed,
      distance: state.distance,
      day: state.day,
      score: state.score,
      lifespan: Object.freeze({ ...state.lifespan }),
      player: createPlayerState(state.player),
      lifecycle,
      actions: Object.freeze({
        canTogglePause: canAcceptLifecycleCommands,
        canDismissTutorial:
          canAcceptLifecycleCommands && state.lifecycle.tutorialPage !== null,
      }),
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
