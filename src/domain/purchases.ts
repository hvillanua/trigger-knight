import type {
  ArmorName,
  GameEvent,
  InventoryItemId,
  PlayerState,
  PurchaseRejectionReason,
  RunState,
  ShopId,
  WeaponName,
} from "./contracts.js";
import { createEncounterQueueState } from "./encounters.js";
import { createPlayerState, equipmentNameAtTier } from "./player-state.js";
import { isActiveGameplay } from "./run-state.js";

export interface PurchaseRules {
  readonly actionMinimumX: number;
  readonly actionMaximumX: number;
  readonly itemByShop: Readonly<Partial<Record<ShopId, InventoryItemId>>>;
  readonly equipment: {
    readonly weapon: {
      readonly maximumTier: number;
      readonly names: readonly WeaponName[];
      readonly baseAttack: number;
      readonly attackPerTier: number;
    };
    readonly armor: {
      readonly maximumTier: number;
      readonly names: readonly ArmorName[];
      readonly baseMaximumHp: number;
      readonly maximumHpPerTier: number;
    };
  };
}

export interface PurchaseStepResult {
  readonly state: RunState;
  readonly events: readonly GameEvent[];
}

/** Returns the public reason a purchase command cannot currently succeed. */
export function purchaseRejectionReason(
  state: Readonly<RunState>,
  rules: Readonly<PurchaseRules>,
): PurchaseRejectionReason | null {
  if (
    state.lifecycle.phase !== "running" ||
    !isActiveGameplay(state.lifecycle)
  ) {
    return "lifecycle-gated";
  }

  const encounter = state.encounters.current;
  if (encounter?.kind !== "shop") {
    return "no-current-shop";
  }
  if (encounter.used) {
    return "already-used";
  }
  if (
    encounter.x <= rules.actionMinimumX ||
    encounter.x >= rules.actionMaximumX
  ) {
    return "out-of-range";
  }
  if (
    (encounter.shop === "bladesmith" &&
      state.player.weapon.tier >= rules.equipment.weapon.maximumTier) ||
    (encounter.shop === "armorsmith" &&
      state.player.armor.tier >= rules.equipment.armor.maximumTier)
  ) {
    return "maximum-tier";
  }
  if (
    rules.itemByShop[encounter.shop] === undefined &&
    encounter.shop !== "bladesmith" &&
    encounter.shop !== "armorsmith"
  ) {
    return "shop-effect-unavailable";
  }
  if (state.player.gold < encounter.cachedPrice) {
    return "insufficient-gold";
  }

  return null;
}

function completePurchase(
  state: Readonly<RunState>,
  player: Readonly<PlayerState>,
): PurchaseStepResult {
  const encounter = state.encounters.current;
  if (encounter?.kind !== "shop") {
    throw new Error("Purchase completion requires a current shop");
  }

  return Object.freeze({
    state: Object.freeze({
      ...state,
      player: createPlayerState({
        ...player,
        gold: player.gold - encounter.cachedPrice,
      }),
      encounters: createEncounterQueueState({
        ...state.encounters,
        current: { ...encounter, used: true },
      }),
    }),
    events: Object.freeze([
      Object.freeze({
        type: "shop-purchased",
        shop: encounter.shop,
        price: encounter.cachedPrice,
      }),
    ]),
  });
}

/** Attempts one purchase without consulting presentation or device input. */
export function attemptPurchase(
  state: Readonly<RunState>,
  rules: Readonly<PurchaseRules>,
): PurchaseStepResult {
  const rejectionReason = purchaseRejectionReason(state, rules);
  if (rejectionReason !== null) {
    return Object.freeze({
      state,
      events: Object.freeze([
        Object.freeze({
          type: "purchase-rejected",
          reason: rejectionReason,
        }),
      ]),
    });
  }

  const encounter = state.encounters.current;
  if (encounter?.kind !== "shop") {
    throw new Error("Purchase validation accepted a non-shop encounter");
  }
  const item = rules.itemByShop[encounter.shop];
  if (item !== undefined) {
    return completePurchase(state, {
      ...state.player,
      inventory: { item },
    });
  }

  if (encounter.shop === "bladesmith") {
    const currentTier = state.player.weapon.tier;
    const tier = currentTier + 1;
    return completePurchase(state, {
      ...state.player,
      weapon: {
        tier,
        name: equipmentNameAtTier(rules.equipment.weapon.names, tier),
        attack:
          rules.equipment.weapon.baseAttack +
          rules.equipment.weapon.attackPerTier * tier,
      },
    });
  }

  if (encounter.shop === "armorsmith") {
    const currentTier = state.player.armor.tier;
    const tier = currentTier + 1;
    const maximumHp =
      rules.equipment.armor.baseMaximumHp +
      rules.equipment.armor.maximumHpPerTier * tier;
    return completePurchase(state, {
      ...state.player,
      armor: {
        tier,
        name: equipmentNameAtTier(rules.equipment.armor.names, tier),
      },
      hp: { current: maximumHp, maximum: maximumHp },
    });
  }

  throw new Error("Purchase validation accepted a shop without an effect");
}
