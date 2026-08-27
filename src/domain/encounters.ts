import type {
  EncounterGenerationState,
  EncounterQueueState,
  PlayerState,
  QueuedEncounter,
  RandomState,
  ShopEncounter,
  ShopId,
} from "./contracts.js";
import { nextRandomInteger } from "./random.js";

export interface EncounterGenerationRules {
  readonly queueLength: number;
  readonly initialShopsUntilBattleUpperBound: number;
  readonly laterShopsUntilBattleUpperBound: number;
  readonly laterShopsUntilBattleBase: number;
  readonly voucherFirstDay: number;
  readonly shopRollUpperBound: number;
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

/** Copies authoritative encounter values into deeply frozen state. */
export function createEncounterQueueState(
  encounters: Readonly<EncounterQueueState>,
): EncounterQueueState {
  return Object.freeze({
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

  return Object.freeze({
    encounters: createEncounterQueueState({ upcoming, generation }),
    random: nextRandom,
  });
}
