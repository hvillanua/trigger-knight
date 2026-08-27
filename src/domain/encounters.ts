import type {
  EncounterGenerationState,
  CurrentEncounter,
  EncounterQueueState,
  GameEvent,
  PlayerState,
  QueuedEncounter,
  RandomState,
  ShopEncounter,
  ShopId,
  RunState,
} from "./contracts.js";
import { nextRandomInteger } from "./random.js";

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
  readonly battleHandoffX: number;
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
    seenSinceBattle: createSeenSinceBattle(generation.seenSinceBattle),
  });
}

function createQueuedEncounter(
  encounter: Readonly<QueuedEncounter>,
): QueuedEncounter {
  return encounter.kind === "battle"
    ? Object.freeze({ kind: "battle" })
    : Object.freeze({ ...encounter });
}

function createCurrentEncounter(
  encounter: Readonly<CurrentEncounter> | null,
): CurrentEncounter | null {
  return encounter === null
    ? null
    : encounter.kind === "battle"
      ? Object.freeze({ kind: "battle", x: encounter.x })
      : Object.freeze({ ...encounter });
}

function positionEncounter(
  encounter: Readonly<QueuedEncounter>,
  x: number,
): CurrentEncounter {
  return encounter.kind === "battle"
    ? Object.freeze({ kind: "battle", x })
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
      return rules.prices.soulShrineInitial;
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
  rules: Readonly<EncounterGenerationRules>,
): ShopEncounter {
  return Object.freeze({
    kind: "shop",
    shop,
    cachedPrice: priceForShop(shop, player, rules),
  });
}

/** Generates one queue entry and returns every consumed hidden-state change. */
export function generateEncounter(
  random: Readonly<RandomState>,
  generation: Readonly<EncounterGenerationState>,
  day: number,
  player: Readonly<PlayerState>,
  rules: Readonly<EncounterGenerationRules>,
): GeneratedEncounter {
  if (generation.shopsUntilBattle <= 0) {
    const spacing = nextRandomInteger(
      random,
      rules.laterShopsUntilBattleUpperBound,
    );

    return Object.freeze({
      encounter: Object.freeze({ kind: "battle" }),
      generation: createGenerationState({
        shopsUntilBattle: rules.laterShopsUntilBattleBase + spacing.value,
        seenSinceBattle: {
          bladesmith: false,
          armorsmith: false,
          soulShrine: false,
        },
      }),
      random: spacing.state,
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
    encounter: createShopEncounter(shop, player, rules),
    generation: createGenerationState({
      shopsUntilBattle: generation.shopsUntilBattle - 1,
      seenSinceBattle: markShopSeen(shop, generation.seenSinceBattle),
    }),
    random: nextRandom,
  });
}

/** Creates the original three-entry lookahead without selecting battle enemies. */
export function initializeEncounterQueue(
  random: Readonly<RandomState>,
  day: number,
  player: Readonly<PlayerState>,
  rules: Readonly<EncounterGenerationRules>,
): InitializedEncounterQueue {
  const initialSpacing = nextRandomInteger(
    random,
    rules.initialShopsUntilBattleUpperBound,
  );
  let nextRandom = initialSpacing.state;
  let generation = createGenerationState({
    shopsUntilBattle: initialSpacing.value,
    seenSinceBattle: {
      bladesmith: false,
      armorsmith: false,
      soulShrine: false,
    },
  });
  const upcoming: QueuedEncounter[] = [];

  for (let index = 0; index < rules.queueLength; index += 1) {
    const generated = generateEncounter(
      nextRandom,
      generation,
      day,
      player,
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

  return Object.freeze({
    encounters: createEncounterQueueState({
      current: null,
      distanceUntilNext: rules.initialDistanceBase + initialDistance.value,
      upcoming,
      generation,
    }),
    random: initialDistance.state,
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
    } else if (current.kind === "battle" && current.x < rules.battleHandoffX) {
      const encounters = createEncounterQueueState({
        ...previous.encounters,
        current,
        distanceUntilNext,
      });

      events.push(Object.freeze({ type: "battle-handoff" }));

      return Object.freeze({
        state: Object.freeze({
          ...stepped,
          encounters,
          lifecycle: Object.freeze({
            ...stepped.lifecycle,
            phase: "battle-handoff",
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

  const generated = generateEncounter(
    stepped.random,
    previous.encounters.generation,
    stepped.day,
    stepped.player,
    rules,
  );
  const nextDistance = nextRandomInteger(
    generated.random,
    rules.laterDistanceUpperBound,
  );
  current = positionEncounter(promoted, rules.entryX);
  events.push(
    Object.freeze({ type: "encounter-promoted", encounter: current }),
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
