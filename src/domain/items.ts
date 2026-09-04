import type {
  GameEvent,
  InventoryItemId,
  ItemUseRejectionReason,
  RunState,
} from "./contracts.js";
import { createBattleState } from "./battle.js";
import { isActiveGameplay } from "./run-state.js";
import { createPlayerState } from "./player-state.js";

export interface ItemUseRules {
  readonly divineEdgeAttackFactor: number;
  readonly goldVoucherMultiplier: number;
}

export interface ItemUseStepResult {
  readonly state: RunState;
  readonly events: readonly GameEvent[];
}

/** Returns the public reason a carried item cannot currently be used. */
export function itemUseRejectionReason(
  state: Readonly<RunState>,
): ItemUseRejectionReason | null {
  if (!isActiveGameplay(state.lifecycle)) {
    return "lifecycle-gated";
  }

  if (state.lifecycle.phase !== "battling" || state.battle === null) {
    return "no-current-battle";
  }

  if (state.player.inventory.item === null) {
    return "no-item";
  }

  return null;
}

function useItem(
  state: Readonly<RunState>,
  item: InventoryItemId,
  rules: Readonly<ItemUseRules>,
): RunState {
  const battle = state.battle;
  if (battle === null) {
    throw new Error("Item use requires an active battle");
  }

  const player = {
    ...state.player,
    inventory: { item: null },
  };

  switch (item) {
    case "elixir":
      return Object.freeze({
        ...state,
        player: createPlayerState({
          ...player,
          hp: {
            ...state.player.hp,
            current: state.player.hp.maximum,
          },
        }),
        battle: createBattleState(battle),
      });
    case "divine-edge":
      return Object.freeze({
        ...state,
        player: createPlayerState(player),
        battle: createBattleState({
          ...battle,
          hero: {
            ...battle.hero,
            attackFactor: rules.divineEdgeAttackFactor,
          },
        }),
      });
    case "gold-voucher":
      return Object.freeze({
        ...state,
        player: createPlayerState(player),
        battle: createBattleState({
          ...battle,
          enemyGoldMultiplier:
            battle.enemyGoldMultiplier * rules.goldVoucherMultiplier,
        }),
      });
  }
}

/** Applies one valid carried-item use or reports a public rejection. */
export function attemptUseCarriedItem(
  state: Readonly<RunState>,
  rules: Readonly<ItemUseRules>,
): ItemUseStepResult {
  const rejectionReason = itemUseRejectionReason(state);
  if (rejectionReason !== null) {
    return Object.freeze({
      state,
      events: Object.freeze([
        Object.freeze({
          type: "item-use-rejected",
          reason: rejectionReason,
        }),
      ]),
    });
  }

  const item = state.player.inventory.item;
  if (item === null) {
    throw new Error("Item-use validation accepted an empty inventory");
  }

  return Object.freeze({
    state: useItem(state, item, rules),
    events: Object.freeze([
      Object.freeze({
        type: "item-used",
        item,
      }),
    ]),
  });
}
