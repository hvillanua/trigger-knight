import type {
  GameCommand,
  GameEvent,
  InventoryItemId,
  PurchaseRejectionReason,
  RunState,
  ShopId,
} from "./contracts.js";
import { createEncounterQueueState } from "./encounters.js";
import { createPlayerState } from "./player-state.js";
import { isActiveGameplay } from "./run-state.js";

export interface PurchaseRules {
  readonly actionMinimumX: number;
  readonly actionMaximumX: number;
  readonly itemByShop: Readonly<Partial<Record<ShopId, InventoryItemId>>>;
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
  if (rules.itemByShop[encounter.shop] === undefined) {
    return "shop-effect-unavailable";
  }
  if (state.player.gold < encounter.cachedPrice) {
    return "insufficient-gold";
  }

  return null;
}

/** Applies purchase commands without consulting presentation or device input. */
export function advancePurchases(
  state: Readonly<RunState>,
  commands: readonly GameCommand[],
  rules: Readonly<PurchaseRules>,
): PurchaseStepResult {
  let currentState = state;
  const events: GameEvent[] = [];

  for (const command of commands) {
    if (command.type !== "purchase-current-encounter") {
      continue;
    }

    const rejectionReason = purchaseRejectionReason(currentState, rules);
    if (rejectionReason !== null) {
      events.push(
        Object.freeze({
          type: "purchase-rejected",
          reason: rejectionReason,
        }),
      );
      continue;
    }

    const encounter = currentState.encounters.current;
    if (encounter?.kind !== "shop") {
      throw new Error("Purchase validation accepted a non-shop encounter");
    }
    const item = rules.itemByShop[encounter.shop];
    if (item === undefined) {
      throw new Error("Purchase validation accepted a shop without an effect");
    }

    currentState = Object.freeze({
      ...currentState,
      player: createPlayerState({
        ...currentState.player,
        gold: currentState.player.gold - encounter.cachedPrice,
        inventory: { item },
      }),
      encounters: createEncounterQueueState({
        ...currentState.encounters,
        current: { ...encounter, used: true },
      }),
    });
    events.push(
      Object.freeze({
        type: "shop-purchased",
        shop: encounter.shop,
        price: encounter.cachedPrice,
      }),
    );
  }

  return Object.freeze({
    state: currentState,
    events: Object.freeze(events),
  });
}
