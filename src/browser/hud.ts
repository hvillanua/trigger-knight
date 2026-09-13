import type {
  EnemyId,
  GameEvent,
  GameObservation,
  InventoryItemId,
  ShopId,
} from "../application/contracts.js";

export interface HudPlayerView {
  readonly hp: string;
  readonly lifespan: string;
  readonly gold: string;
  readonly weapon: string;
  readonly armor: string;
  readonly item: string;
  readonly score: string;
  readonly day: string;
}

export interface HudEncounterView {
  readonly label: string;
  readonly detail: string;
}

export interface HudContextView {
  readonly title: string;
  readonly description: string;
  readonly price: string | null;
  readonly warning: string | null;
  readonly actionEnabled: boolean;
}

export interface HudBattleView {
  readonly enemy: string;
  readonly hp: string;
  readonly hpPercent: number;
}

export interface HudView {
  readonly player: HudPlayerView;
  readonly currentEncounter: HudEncounterView;
  readonly upcomingEncounters: readonly HudEncounterView[];
  readonly context: HudContextView;
  readonly battle: HudBattleView | null;
}

const SHOP_NAMES: Readonly<Record<ShopId, string>> = Object.freeze({
  bladesmith: "Bladesmith",
  armorsmith: "Armorsmith",
  "soul-shrine": "Soul Shrine",
  pharmacy: "Pharmacy",
  "grims-shop": "Grim's Shop",
  "voucher-store": "Voucher Store",
});

const SHOP_DESCRIPTIONS: Readonly<Record<ShopId, string>> = Object.freeze({
  bladesmith: "Upgrade your weapon.",
  armorsmith: "Upgrade your armor and restore HP.",
  "soul-shrine": "Restore your lifespan.",
  pharmacy: "Replace your carried item with an Elixir.",
  "grims-shop": "Replace your carried item with Divine Edge.",
  "voucher-store": "Replace your carried item with Gold Voucher.",
});

const ITEM_NAMES: Readonly<Record<InventoryItemId, string>> = Object.freeze({
  elixir: "Elixir",
  "divine-edge": "Divine Edge",
  "gold-voucher": "Gold Voucher",
});

const ITEM_DESCRIPTIONS: Readonly<Record<InventoryItemId, string>> =
  Object.freeze({
    elixir: "Full HP Recovery. Usable during battle.",
    "divine-edge": "10000% Damage. Usable during battle.",
    "gold-voucher": "1000% Gold. Usable during battle.",
  });

const ENEMY_NAMES: Readonly<Record<EnemyId, string>> = Object.freeze({
  goblin: "Goblin",
  golem: "Golem",
  wolf: "Wolf",
  dragon: "Dragon",
});

function numberLabel(value: number): string {
  return value.toLocaleString("en-US");
}

export function shopName(shop: ShopId): string {
  return SHOP_NAMES[shop];
}

export function shopDescription(shop: ShopId): string {
  return SHOP_DESCRIPTIONS[shop];
}

export function itemName(item: InventoryItemId): string {
  return ITEM_NAMES[item];
}

export function itemDescription(item: InventoryItemId): string {
  return ITEM_DESCRIPTIONS[item];
}

export function enemyName(enemy: EnemyId): string {
  return ENEMY_NAMES[enemy];
}

export function formatLifespan(
  lifespan: Readonly<{ whole: number; fraction: number }>,
): string {
  return `${lifespan.whole}.${String(lifespan.fraction).padStart(2, "0")}%`;
}

function maxTierWarning(observation: Readonly<GameObservation>): string | null {
  const current = observation.encounters.current;
  if (current?.kind !== "shop") return null;
  if (current.shop === "bladesmith" && observation.player.weapon.tier >= 10) {
    return "Unavailable: maximum tier reached (weapon).";
  }
  if (current.shop === "armorsmith" && observation.player.armor.tier >= 10) {
    return "Unavailable: maximum tier reached (armor).";
  }
  return null;
}

function purchaseWarning(
  observation: Readonly<GameObservation>,
): string | null {
  const current = observation.encounters.current;
  if (current?.kind !== "shop") return null;
  if (current.used) return "Already used.";
  const tierWarning = maxTierWarning(observation);
  if (tierWarning !== null) return tierWarning;
  if (current.x <= 0 || current.x >= 420) return "Out of range.";
  if (observation.player.gold < current.cachedPrice) {
    return `Need ${numberLabel(current.cachedPrice - observation.player.gold)} more gold.`;
  }
  if (!observation.actions.canPurchaseCurrentEncounter) {
    return "Unavailable right now.";
  }
  return null;
}

function currentEncounterView(
  observation: Readonly<GameObservation>,
): HudEncounterView {
  const current = observation.encounters.current;
  if (current === null) {
    return Object.freeze({
      label: "No current encounter",
      detail: "The next encounter is ahead.",
    });
  }
  if (current.kind === "battle") {
    return Object.freeze({
      label: `Battle: ${enemyName(current.enemy.id)}`,
      detail: `Enemy HP ${numberLabel(current.enemy.maximumHp)} maximum.`,
    });
  }
  return Object.freeze({
    label: shopName(current.shop),
    detail: `${numberLabel(current.cachedPrice)} gold cached price.`,
  });
}

function upcomingEncounterView(
  encounter: Readonly<GameObservation["encounters"]["upcoming"][number]>,
): HudEncounterView {
  if (encounter.kind === "battle") {
    return Object.freeze({
      label: "Battle",
      detail: "Enemy identity is shown when battle begins.",
    });
  }
  return Object.freeze({
    label: shopName(encounter.shop),
    detail: `${numberLabel(encounter.cachedPrice)} gold cached price.`,
  });
}

function contextView(observation: Readonly<GameObservation>): HudContextView {
  const current = observation.encounters.current;
  if (current?.kind === "shop") {
    return Object.freeze({
      title: shopName(current.shop),
      description: shopDescription(current.shop),
      price: `${numberLabel(current.cachedPrice)} gold`,
      warning: purchaseWarning(observation),
      actionEnabled: observation.actions.canPurchaseCurrentEncounter,
    });
  }

  const item = observation.player.inventory.item;
  if (observation.battle !== null && item !== null) {
    return Object.freeze({
      title: itemName(item),
      description: itemDescription(item),
      price: null,
      warning: observation.actions.canUseCarriedItem
        ? null
        : "Item use is unavailable right now.",
      actionEnabled: observation.actions.canUseCarriedItem,
    });
  }
  if (observation.battle !== null) {
    return Object.freeze({
      title: `Battle: ${enemyName(observation.battle.enemy.id)}`,
      description: "Combat is automatic. A carried item can be used here.",
      price: null,
      warning: null,
      actionEnabled: false,
    });
  }
  return Object.freeze({
    title: "No action available",
    description: "Keep moving. The next encounter will appear in the queue.",
    price: null,
    warning: null,
    actionEnabled: false,
  });
}

/** Projects only current public observation values into readable HUD strings. */
export function createHudView(observation: Readonly<GameObservation>): HudView {
  const hp = observation.player.hp;
  const battle = observation.battle;
  const battleView =
    battle === null
      ? null
      : Object.freeze({
          enemy: enemyName(battle.enemy.id),
          hp: `${numberLabel(battle.enemy.currentHp)}/${numberLabel(battle.enemy.maximumHp)}`,
          hpPercent:
            battle.enemy.maximumHp <= 0
              ? 0
              : Math.max(
                  0,
                  Math.min(
                    100,
                    (battle.enemy.currentHp / battle.enemy.maximumHp) * 100,
                  ),
                ),
        });

  return Object.freeze({
    player: Object.freeze({
      hp: `${numberLabel(hp.current)}/${numberLabel(hp.maximum)}`,
      lifespan: formatLifespan(observation.lifespan),
      gold: numberLabel(observation.player.gold),
      weapon: `${observation.player.weapon.name} · ATK ${numberLabel(observation.player.weapon.attack)}`,
      armor: observation.player.armor.name,
      item:
        observation.player.inventory.item === null
          ? "None"
          : itemName(observation.player.inventory.item),
      score: numberLabel(observation.score),
      day: numberLabel(observation.day),
    }),
    currentEncounter: currentEncounterView(observation),
    upcomingEncounters: Object.freeze(
      observation.encounters.upcoming.map(upcomingEncounterView),
    ),
    context: contextView(observation),
    battle: battleView,
  });
}

const REJECTION_MESSAGES: Readonly<Record<string, string>> = Object.freeze({
  "already-used": "That shop has already been used.",
  "insufficient-gold": "You do not have enough gold.",
  "lifecycle-gated": "That action is unavailable right now.",
  "maximum-tier": "That equipment is already at maximum tier.",
  "no-current-shop": "There is no shop in range.",
  "out-of-range": "That shop is out of range.",
  "shop-effect-unavailable": "That shop has no available effect.",
});

const ITEM_REJECTION_MESSAGES: Readonly<Record<string, string>> = Object.freeze(
  {
    "lifecycle-gated": "Item use is unavailable right now.",
    "no-current-battle": "Items can only be used during battle.",
    "no-item": "There is no carried item to use.",
  },
);

const REPEATED_GAMEPLAY_EVENTS: ReadonlySet<GameEvent["type"]> = new Set([
  "combat-phase-changed",
  "combat-hit",
  "combat-lethal-hit",
  "lifespan-death",
  "step-advanced",
]);

/** Converts public events into short announcements for the accessible HUD. */
export function describeGameEvent(event: GameEvent): string {
  switch (event.type) {
    case "achievement-unlocked":
      return `Achievement unlocked: ${event.achievement}.`;
    case "battle-started":
      return `Battle started: ${enemyName(event.enemy.id)}.`;
    case "battle-reward":
      return `Defeated ${enemyName(event.enemy)}. Earned ${numberLabel(event.gold)} gold and ${numberLabel(event.profileExp)} XP.`;
    case "combat-phase-changed":
      return `${event.actor === "hero" ? "Hero" : "Enemy"} is ${event.phase}.`;
    case "combat-hit":
      return `${event.attacker === "hero" ? "Hero" : "Enemy"} hit for ${numberLabel(event.damage)}${event.critical ? " critical damage" : " damage"}.`;
    case "combat-lethal-hit":
      return `${event.attacker === "hero" ? "Hero" : "Enemy"} landed a lethal hit.`;
    case "equipment-discovered":
      return `Discovered ${event.equipment} tier ${event.tier}.`;
    case "encounter-promoted":
      return event.encounter.kind === "battle"
        ? "A battle is now in range."
        : `${shopName(event.encounter.shop)} is now in range.`;
    case "lifespan-death":
      return "The run ended when lifespan reached zero.";
    case "pause-toggled":
      return event.paused ? "Run paused." : "Run resumed.";
    case "purchase-rejected":
      return REJECTION_MESSAGES[event.reason] ?? "Purchase rejected.";
    case "item-used":
      return `Used ${itemName(event.item)}.`;
    case "item-use-rejected":
      return ITEM_REJECTION_MESSAGES[event.reason] ?? "Item use rejected.";
    case "step-advanced":
      return "";
    case "shop-departed":
      return `${shopName(event.shop)} passed out of range.`;
    case "shop-purchased":
      return `Purchased ${shopName(event.shop)} for ${numberLabel(event.price)} gold.`;
    case "tutorial-dismissed":
      return `Tutorial page ${event.page + 1} dismissed.`;
    case "run-ended":
      return `Run ended by ${event.reason}.`;
  }
}

/** Omits per-tick combat noise and duplicate terminal announcements. */
export function describeAccessibleGameEvent(event: GameEvent): string {
  return REPEATED_GAMEPLAY_EVENTS.has(event.type)
    ? ""
    : describeGameEvent(event);
}
