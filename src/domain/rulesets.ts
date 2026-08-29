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
import {
  advanceEncounterLifecycle,
  initializeEncounterQueue,
  type EncounterGenerationRules,
} from "./encounters.js";
import { advanceLifespan } from "./lifespan.js";
import { createPlayerState } from "./player-state.js";
import {
  attemptPurchase,
  purchaseRejectionReason,
  type PurchaseRules,
} from "./purchases.js";
import { createRandomState, RANDOM_ALGORITHM } from "./random.js";
import { advanceRunningProgression } from "./running-progression.js";
import {
  applyLifecycleCommand,
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
  readonly encounters: EncounterGenerationRules;
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
  readonly encounterInitializationDrawOrder: "queue-then-distance";
  readonly encounterPromotionDrawOrder: "replacement-then-distance";
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
  encounters: Object.freeze({
    queueLength: 3,
    initialShopsUntilBattleUpperBound: 3,
    laterShopsUntilBattleUpperBound: 3,
    laterShopsUntilBattleBase: 1,
    voucherFirstDay: 4,
    shopRollUpperBound: 100,
    initialDistanceBase: 1_000,
    initialDistanceUpperBound: 1_000,
    laterDistanceBase: 1_500,
    laterDistanceUpperBound: 300,
    entryX: 600,
    shopSpeedFactor: 0.5,
    shopActionMinimumX: 0,
    shopActionMaximumX: 420,
    shopDepartureX: -100,
    battleSpeedFactor: 1,
    battleHandoffX: 420,
    rollMinimums: Object.freeze({
      bladesmith: 66,
      armorsmith: 31,
      soulShrine: 26,
      pharmacy: 11,
      grimsShop: 6,
    }),
    prices: Object.freeze({
      bladesmithBase: 200,
      bladesmithPerCurrentTier: 36,
      armorsmithBase: 150,
      armorsmithPerCurrentTier: 54,
      soulShrineInitial: 50,
      pharmacy: 150,
      grimsShop: 200,
      voucherStore: 500,
    }),
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
    encounterInitializationDrawOrder: "queue-then-distance",
    encounterPromotionDrawOrder: "replacement-then-distance",
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

const originalV13PurchaseRules: PurchaseRules = Object.freeze({
  actionMinimumX: originalV13Constants.encounters.shopActionMinimumX,
  actionMaximumX: originalV13Constants.encounters.shopActionMaximumX,
  itemByShop: Object.freeze({
    pharmacy: "elixir",
    "grims-shop": "divine-edge",
    "voucher-store": "gold-voucher",
  }),
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
    const player = createOriginalV13InitialPlayerState();
    const initializedEncounters = initializeEncounterQueue(
      createRandomState(seed),
      1,
      player,
      originalV13Constants.encounters,
    );

    return createRunState(
      ORIGINAL_V13_RULESET_ID,
      initializedEncounters.random,
      originalV13Constants.pregameDelaySteps,
      initialProfile.scoreMultiplier,
      originalV13Constants.movement.initialSpeed,
      Object.freeze({
        whole: originalV13Constants.lifespan.initialWhole,
        fraction: originalV13Constants.lifespan.initialFraction,
      }),
      player,
      initializedEncounters.encounters,
    );
  },

  step(
    state: Readonly<RunState>,
    commands: readonly GameCommand[],
  ): RuleSetStepResult {
    let commandedState = state;
    const commandEvents: GameEvent[] = [];

    for (const command of commands) {
      const commandResult =
        command.type === "purchase-current-encounter"
          ? attemptPurchase(commandedState, originalV13PurchaseRules)
          : applyLifecycleCommand(commandedState, command);
      commandedState = commandResult.state;
      commandEvents.push(...commandResult.events);
    }

    const result = advanceRunState(commandedState);
    const progressed = advanceRunningProgression(
      commandedState,
      result.state,
      originalV13RunningProgressionRules,
    );
    const encounters = advanceEncounterLifecycle(
      commandedState,
      progressed,
      originalV13Constants.encounters,
    );
    const lifespan = advanceLifespan(
      commandedState,
      encounters.state,
      originalV13LifespanRules,
    );

    return Object.freeze({
      state: lifespan.state,
      events: Object.freeze([
        ...commandEvents,
        ...result.events,
        ...encounters.events,
        ...lifespan.events,
      ]),
    });
  },

  observe(state: Readonly<RunState>): GameObservation {
    const lifecycle = Object.freeze({
      ...state.lifecycle,
      activeGameplay: isActiveGameplay(state.lifecycle),
    });
    const canAcceptLifecycleCommands = state.lifecycle.phase !== "ended";
    const currentEncounter = state.encounters.current;

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
      encounters: Object.freeze({
        current:
          currentEncounter === null
            ? null
            : Object.freeze({ ...currentEncounter }),
        upcoming: Object.freeze(
          state.encounters.upcoming.map((encounter) =>
            Object.freeze({ ...encounter }),
          ),
        ),
      }),
      lifecycle,
      actions: Object.freeze({
        canTogglePause: canAcceptLifecycleCommands,
        canDismissTutorial:
          canAcceptLifecycleCommands && state.lifecycle.tutorialPage !== null,
        canPurchaseCurrentEncounter:
          purchaseRejectionReason(state, originalV13PurchaseRules) === null,
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
