import type { PlayerState } from "./contracts.js";

/** Resolves the one-based equipment tier or rejects an invalid ruleset table. */
export function equipmentNameAtTier<Name extends string>(
  names: readonly Name[],
  tier: number,
): Name {
  const name = names[tier - 1];
  if (name === undefined) {
    throw new RangeError(`No equipment name for tier ${tier}`);
  }

  return name;
}

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
