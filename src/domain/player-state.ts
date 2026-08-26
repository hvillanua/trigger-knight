import type { PlayerState } from "./contracts.js";

/** Copies authoritative player values into deeply frozen serializable state. */
export function createPlayerState(player: Readonly<PlayerState>): PlayerState {
  return Object.freeze({
    gold: player.gold,
    weapon: Object.freeze({ ...player.weapon }),
    armor: Object.freeze({ ...player.armor }),
    hp: Object.freeze({ ...player.hp }),
    inventory: Object.freeze({ ...player.inventory }),
  });
}
