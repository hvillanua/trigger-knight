import type {
  EncounterGenerationState,
  CurrentEncounter,
  EnemyId,
  EnemySnapshot,
  EncounterQueueState,
  GameEvent,
  LifespanState,
  ObservedCurrentEncounter,
  ObservedQueuedEncounter,
  PlayerState,
  QueuedEncounter,
  RandomState,
  ShopEncounter,
  ShopId,
  RunState,
} from "./contracts.js";
import { nextRandomInteger } from "./random.js";

export interface EnemyScalingRules {
  readonly maximumHpBase: number;
  readonly maximumHpPerDay: number;
  readonly attackBase: number;
  readonly attackPerDay: number;
  readonly goldRewardBase: number;
  readonly goldRewardPerDay: number;
  readonly profileExpBase: number;
  readonly profileExpPerDay: number;
}

export interface EnemyGenerationRules {
  readonly ordinaryIds: readonly ["goblin", "golem", "wolf"];
  readonly ordinaryRollUpperBound: number;
  readonly dragonRollFirstDay: number;
  readonly dragonChanceDayOffset: number;
  readonly dragonChancePerDay: number;
  readonly dragonRollUpperBound: number;
  readonly scaling: Readonly<Record<EnemyId, EnemyScalingRules>>;
}

export interface EncounterGenerationRules {
  readonly queueLength: number;
  readonly initialShopsUntilBattleUpperBound: number;
  readonly laterShopsUntilBattleUpperBound: number;
  readonly laterShopsUntilBattleBase: number;
  readonly voucherFirstDay: number;
  readonly shopRollUpperBound: number;
  readonly initialDistanceBase: number;
  readonly initialDistanceUpperBound: number;
  readonly laterDistanceBase: number;
  readonly laterDistanceUpperBound: number;
  readonly entryX: number;
  readonly shopSpeedFactor: number;
  readonly shopActionMinimumX: number;
  readonly shopActionMaximumX: number;
  readonly shopDepartureX: number;
  readonly battleSpeedFactor: number;
  readonly battleStartX: number;
  readonly emergencyThresholdBase: number;
  readonly emergencyThresholdUpperBound: number;
  readonly enemySelection: EnemyGenerationRules;
  readonly rollMinimums: {
    readonly bladesmith: number;
    readonly armorsmith: number;
    readonly soulShrine: number;
    readonly pharmacy: number;
    readonly grimsShop: number;
  };
  readonly prices: {
    readonly bladesmithBase: number;
    readonly bladesmithPerCurrentTier: number;
    readonly armorsmithBase: number;
    readonly armorsmithPerCurrentTier: number;
    readonly soulShrineInitial: number;
    readonly soulShrinePerExtension: number;
    readonly pharmacy: number;
    readonly grimsShop: number;
    readonly voucherStore: number;
  };
}

export interface GeneratedEncounter {
  readonly encounter: QueuedEncounter;
  readonly generation: EncounterGenerationState;
  readonly random: RandomState;
}

export interface InitializedEncounterQueue {
  readonly encounters: EncounterQueueState;
  readonly random: RandomState;
}

export interface EncounterLifecycleStepResult {
  readonly state: RunState;
  readonly events: readonly GameEvent[];
}

function createSeenSinceBattle(
  seen: Readonly<EncounterGenerationState["seenSinceBattle"]>,
): EncounterGenerationState["seenSinceBattle"] {
  return Object.freeze({ ...seen });
}

function createGenerationState(
  generation: Readonly<EncounterGenerationState>,
): EncounterGenerationState {
  return Object.freeze({
    shopsUntilBattle: generation.shopsUntilBattle,
    dragonSpawned: generation.dragonSpawned,
    seenSinceBattle: createSeenSinceBattle(generation.seenSinceBattle),
    soulShrine: Object.freeze({ ...generation.soulShrine }),
  });
}

function createEnemySnapshot(enemy: Readonly<EnemySnapshot>): EnemySnapshot {
  return Object.freeze({ ...enemy });
}

function createQueuedEncounter(
  encounter: Readonly<QueuedEncounter>,
): QueuedEncounter {
  return encounter.kind === "battle"
    ? Object.freeze({
        kind: "battle",
        enemy: createEnemySnapshot(encounter.enemy),
      })
    : Object.freeze({ ...encounter });
}

function createCurrentEncounter(
  encounter: Readonly<CurrentEncounter> | null,
): CurrentEncounter | null {
  return encounter === null
    ? null
    : encounter.kind === "battle"
      ? Object.freeze({
          kind: "battle",
          enemy: createEnemySnapshot(encounter.enemy),
          x: encounter.x,
        })
      : Object.freeze({ ...encounter });
}

/** Projects an authoritative queued encounter into the shared player-facing model. */
export function observeQueuedEncounter(
  encounter: Readonly<QueuedEncounter>,
): ObservedQueuedEncounter {
  return encounter.kind === "battle"
    ? Object.freeze({ kind: "battle" as const })
    : Object.freeze({
        kind: "shop" as const,
        shop: encounter.shop,
        cachedPrice: encounter.cachedPrice,
      });
}

/** Projects authoritative encounter state into the shared player-facing model. */
export function observeCurrentEncounter(
  encounter: Readonly<CurrentEncounter>,
): ObservedCurrentEncounter;
export function observeCurrentEncounter(encounter: null): null;
export function observeCurrentEncounter(
  encounter: Readonly<CurrentEncounter> | null,
): ObservedCurrentEncounter | null;
export function observeCurrentEncounter(
  encounter: Readonly<CurrentEncounter> | null,
): ObservedCurrentEncounter | null {
  return encounter === null
    ? null
    : encounter.kind === "battle"
      ? Object.freeze({
          kind: "battle",
          enemy: Object.freeze({
            id: encounter.enemy.id,
            maximumHp: encounter.enemy.maximumHp,
          }),
          x: encounter.x,
        })
      : Object.freeze({
          kind: "shop" as const,
          shop: encounter.shop,
          cachedPrice: encounter.cachedPrice,
          x: encounter.x,
          used: encounter.used,
        });
}

function positionEncounter(
  encounter: Readonly<QueuedEncounter>,
  x: number,
): CurrentEncounter {
  return encounter.kind === "battle"
    ? Object.freeze({
        kind: "battle",
        enemy: createEnemySnapshot(encounter.enemy),
        x,
      })
    : Object.freeze({ ...encounter, x, used: false });
}

function moveCurrentEncounter(
  encounter: Readonly<CurrentEncounter>,
  movementSpeed: number,
  rules: Readonly<EncounterGenerationRules>,
): CurrentEncounter {
  const speedFactor =
    encounter.kind === "shop" ? rules.shopSpeedFactor : rules.battleSpeedFactor;

  return Object.freeze({
    ...encounter,
    x: encounter.x - movementSpeed * speedFactor,
  });
}

/** Copies authoritative encounter values into deeply frozen state. */
export function createEncounterQueueState(
  encounters: Readonly<EncounterQueueState>,
): EncounterQueueState {
  return Object.freeze({
    current: createCurrentEncounter(encounters.current),
    distanceUntilNext: encounters.distanceUntilNext,
    upcoming: Object.freeze(encounters.upcoming.map(createQueuedEncounter)),
    generation: createGenerationState(encounters.generation),
  });
}

function shopForRoll(
  roll: number,
  rules: Readonly<EncounterGenerationRules>,
): ShopId {
  if (roll >= rules.rollMinimums.bladesmith) {
    return "bladesmith";
  }
  if (roll >= rules.rollMinimums.armorsmith) {
    return "armorsmith";
  }
  if (roll >= rules.rollMinimums.soulShrine) {
    return "soul-shrine";
  }
  if (roll >= rules.rollMinimums.pharmacy) {
    return "pharmacy";
  }
  if (roll >= rules.rollMinimums.grimsShop) {
    return "grims-shop";
  }
  return "voucher-store";
}

function isRejectedShop(
  shop: ShopId,
  day: number,
  generation: Readonly<EncounterGenerationState>,
  rules: Readonly<EncounterGenerationRules>,
): boolean {
  if (shop === "voucher-store") {
    return day < rules.voucherFirstDay;
  }

  if (shop === "bladesmith") {
    return generation.seenSinceBattle.bladesmith;
  }
  if (shop === "armorsmith") {
    return generation.seenSinceBattle.armorsmith;
  }
  if (shop === "soul-shrine") {
    return generation.seenSinceBattle.soulShrine;
  }

  return false;
}

function markShopSeen(
  shop: ShopId,
  seen: Readonly<EncounterGenerationState["seenSinceBattle"]>,
): EncounterGenerationState["seenSinceBattle"] {
  return Object.freeze({
    bladesmith: seen.bladesmith || shop === "bladesmith",
    armorsmith: seen.armorsmith || shop === "armorsmith",
    soulShrine: seen.soulShrine || shop === "soul-shrine",
  });
}

function priceForShop(
  shop: ShopId,
  player: Readonly<PlayerState>,
  generation: Readonly<EncounterGenerationState>,
  rules: Readonly<EncounterGenerationRules>,
): number {
  switch (shop) {
    case "bladesmith":
      return (
        rules.prices.bladesmithBase +
        rules.prices.bladesmithPerCurrentTier * player.weapon.tier
      );
    case "armorsmith":
      return (
        rules.prices.armorsmithBase +
        rules.prices.armorsmithPerCurrentTier * player.armor.tier
      );
    case "soul-shrine":
      return (
        rules.prices.soulShrineInitial +
        rules.prices.soulShrinePerExtension * generation.soulShrine.extensions
      );
    case "pharmacy":
      return rules.prices.pharmacy;
    case "grims-shop":
      return rules.prices.grimsShop;
    case "voucher-store":
      return rules.prices.voucherStore;
  }
}

function createShopEncounter(
  shop: ShopId,
  player: Readonly<PlayerState>,
  generation: Readonly<EncounterGenerationState>,
  rules: Readonly<EncounterGenerationRules>,
): ShopEncounter {
  return Object.freeze({
    kind: "shop",
    shop,
    cachedPrice: priceForShop(shop, player, generation, rules),
  });
}

function shouldForceSoulShrine(
  generation: Readonly<EncounterGenerationState>,
  lifespan: Readonly<LifespanState>,
): boolean {
  return (
    lifespan.whole < generation.soulShrine.emergencyThreshold &&
    !generation.soulShrine.emergencyChanceGiven &&
    !generation.seenSinceBattle.soulShrine
  );
}

function scaleEnemy(
  id: EnemyId,
  day: number,
  rules: Readonly<EncounterGenerationRules>,
): EnemySnapshot {
  const scaling = rules.enemySelection.scaling[id];

  return Object.freeze({
    id,
    maximumHp: scaling.maximumHpBase + scaling.maximumHpPerDay * day,
    attack: scaling.attackBase + scaling.attackPerDay * day,
    goldReward: scaling.goldRewardBase + scaling.goldRewardPerDay * day,
    profileExp: scaling.profileExpBase + scaling.profileExpPerDay * day,
  });
}

function generateBattle(
  random: Readonly<RandomState>,
  generation: Readonly<EncounterGenerationState>,
  day: number,
  rules: Readonly<EncounterGenerationRules>,
): Readonly<{
  enemy: EnemySnapshot;
  dragonSpawned: boolean;
  random: RandomState;
}> {
  let nextRandom = random;

  if (
    day >= rules.enemySelection.dragonRollFirstDay &&
    !generation.dragonSpawned
  ) {
    const dragonRoll = nextRandomInteger(
      nextRandom,
      rules.enemySelection.dragonRollUpperBound,
    );
    nextRandom = dragonRoll.state;
    const dragonThreshold =
      rules.enemySelection.dragonChancePerDay *
      (day - rules.enemySelection.dragonChanceDayOffset);

    if (dragonRoll.value < dragonThreshold) {
      return Object.freeze({
        enemy: scaleEnemy("dragon", day, rules),
        dragonSpawned: true,
        random: nextRandom,
      });
    }
  }

  const ordinaryRoll = nextRandomInteger(
    nextRandom,
    rules.enemySelection.ordinaryRollUpperBound,
  );
  const ordinaryId = rules.enemySelection.ordinaryIds[ordinaryRoll.value];
  if (ordinaryId === undefined) {
    throw new RangeError("Ordinary enemy roll is outside the configured list");
  }

  return Object.freeze({
    enemy: scaleEnemy(ordinaryId, day, rules),
    dragonSpawned: generation.dragonSpawned,
    random: ordinaryRoll.state,
  });
}

/** Generates one queue entry and returns every consumed hidden-state change. */
export function generateEncounter(
  random: Readonly<RandomState>,
  generation: Readonly<EncounterGenerationState>,
  day: number,
  player: Readonly<PlayerState>,
  lifespan: Readonly<LifespanState>,
  rules: Readonly<EncounterGenerationRules>,
): GeneratedEncounter {
  if (generation.shopsUntilBattle <= 0) {
    const spacing = nextRandomInteger(
      random,
      rules.laterShopsUntilBattleUpperBound,
    );

    const battle = generateBattle(spacing.state, generation, day, rules);

    return Object.freeze({
      encounter: Object.freeze({
        kind: "battle",
        enemy: battle.enemy,
      }),
      generation: createGenerationState({
        shopsUntilBattle: rules.laterShopsUntilBattleBase + spacing.value,
        dragonSpawned: battle.dragonSpawned,
        seenSinceBattle: {
          bladesmith: false,
          armorsmith: false,
          soulShrine: false,
        },
        soulShrine: generation.soulShrine,
      }),
      random: battle.random,
    });
  }

  if (shouldForceSoulShrine(generation, lifespan)) {
    const threshold = nextRandomInteger(
      random,
      rules.emergencyThresholdUpperBound,
    );
    const shop = "soul-shrine";

    return Object.freeze({
      encounter: createShopEncounter(shop, player, generation, rules),
      generation: createGenerationState({
        shopsUntilBattle: generation.shopsUntilBattle - 1,
        dragonSpawned: generation.dragonSpawned,
        seenSinceBattle: generation.seenSinceBattle,
        soulShrine: {
          ...generation.soulShrine,
          emergencyThreshold: rules.emergencyThresholdBase + threshold.value,
          emergencyChanceGiven: true,
        },
      }),
      random: threshold.state,
    });
  }

  let nextRandom = random;
  let shop: ShopId;
  do {
    const roll = nextRandomInteger(nextRandom, rules.shopRollUpperBound);
    nextRandom = roll.state;
    shop = shopForRoll(roll.value, rules);
  } while (isRejectedShop(shop, day, generation, rules));

  return Object.freeze({
    encounter: createShopEncounter(shop, player, generation, rules),
    generation: createGenerationState({
      shopsUntilBattle: generation.shopsUntilBattle - 1,
      dragonSpawned: generation.dragonSpawned,
      seenSinceBattle: markShopSeen(shop, generation.seenSinceBattle),
      soulShrine: generation.soulShrine,
    }),
    random: nextRandom,
  });
}

/** Creates the original three-entry lookahead with queue-time enemy selection. */
export function initializeEncounterQueue(
  random: Readonly<RandomState>,
  day: number,
  player: Readonly<PlayerState>,
  lifespan: Readonly<LifespanState>,
  rules: Readonly<EncounterGenerationRules>,
): InitializedEncounterQueue {
  const initialSpacing = nextRandomInteger(
    random,
    rules.initialShopsUntilBattleUpperBound,
  );
  let nextRandom = initialSpacing.state;
  let generation = createGenerationState({
    shopsUntilBattle: initialSpacing.value,
    dragonSpawned: false,
    seenSinceBattle: {
      bladesmith: false,
      armorsmith: false,
      soulShrine: false,
    },
    soulShrine: {
      extensions: 0,
      emergencyThreshold: rules.emergencyThresholdBase,
      emergencyChanceGiven: false,
    },
  });
  const upcoming: QueuedEncounter[] = [];

  for (let index = 0; index < rules.queueLength; index += 1) {
    const generated = generateEncounter(
      nextRandom,
      generation,
      day,
      player,
      lifespan,
      rules,
    );
    upcoming.push(generated.encounter);
    generation = generated.generation;
    nextRandom = generated.random;
  }

  const initialDistance = nextRandomInteger(
    nextRandom,
    rules.initialDistanceUpperBound,
  );
  const initialEmergencyThreshold = nextRandomInteger(
    initialDistance.state,
    rules.emergencyThresholdUpperBound,
  );

  return Object.freeze({
    encounters: createEncounterQueueState({
      current: null,
      distanceUntilNext: rules.initialDistanceBase + initialDistance.value,
      upcoming,
      generation: {
        ...generation,
        soulShrine: {
          ...generation.soulShrine,
          emergencyThreshold:
            rules.emergencyThresholdBase + initialEmergencyThreshold.value,
        },
      },
    }),
    random: initialEmergencyThreshold.state,
  });
}

/** Advances countdowns and mechanic-bearing positions for one running tick. */
export function advanceEncounterLifecycle(
  previous: Readonly<RunState>,
  stepped: Readonly<RunState>,
  rules: Readonly<EncounterGenerationRules>,
): EncounterLifecycleStepResult {
  if (
    stepped.activeTicks === previous.activeTicks ||
    previous.lifecycle.phase !== "running" ||
    stepped.lifecycle.phase !== "running"
  ) {
    return Object.freeze({ state: stepped, events: Object.freeze([]) });
  }

  const events: GameEvent[] = [];
  const distanceUntilNext =
    previous.encounters.distanceUntilNext - stepped.movementSpeed;
  let current = previous.encounters.current;

  if (current !== null) {
    current = moveCurrentEncounter(current, stepped.movementSpeed, rules);

    if (current.kind === "shop" && current.x < rules.shopDepartureX) {
      events.push(Object.freeze({ type: "shop-departed", shop: current.shop }));
      current = null;
    } else if (current.kind === "battle" && current.x < rules.battleStartX) {
      const encounters = createEncounterQueueState({
        ...previous.encounters,
        current,
        distanceUntilNext,
      });

      return Object.freeze({
        state: Object.freeze({
          ...stepped,
          encounters,
          lifecycle: Object.freeze({
            ...stepped.lifecycle,
            phase: "battling",
          }),
        }),
        events: Object.freeze(events),
      });
    }
  }

  if (current !== null || distanceUntilNext > 0) {
    return Object.freeze({
      state: Object.freeze({
        ...stepped,
        encounters: createEncounterQueueState({
          ...previous.encounters,
          current,
          distanceUntilNext,
        }),
      }),
      events: Object.freeze(events),
    });
  }

  const [promoted, ...remaining] = previous.encounters.upcoming;
  if (promoted === undefined) {
    throw new RangeError("Encounter queue must contain a promotable entry");
  }

  const generationBeforeReplacement =
    promoted.kind === "battle" && promoted.enemy.id !== "dragon"
      ? createGenerationState({
          ...previous.encounters.generation,
          dragonSpawned: false,
        })
      : previous.encounters.generation;
  const generated = generateEncounter(
    stepped.random,
    generationBeforeReplacement,
    stepped.day,
    stepped.player,
    stepped.lifespan,
    rules,
  );
  const nextDistance = nextRandomInteger(
    generated.random,
    rules.laterDistanceUpperBound,
  );
  current = positionEncounter(promoted, rules.entryX);
  events.push(
    Object.freeze({
      type: "encounter-promoted",
      encounter: observeCurrentEncounter(current),
    }),
  );

  return Object.freeze({
    state: Object.freeze({
      ...stepped,
      random: nextDistance.state,
      encounters: createEncounterQueueState({
        current,
        distanceUntilNext: rules.laterDistanceBase + nextDistance.value,
        upcoming: [...remaining, generated.encounter],
        generation: generated.generation,
      }),
    }),
    events: Object.freeze(events),
  });
}
