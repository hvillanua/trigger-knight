import type { GameEvent } from "./contracts.js";
import {
  achievementIdForSlot,
  PROFILE_EQUIPMENT_TIER_COUNT,
} from "./profile.js";

export interface AchievementUnlockResult {
  readonly achievementSlots: readonly boolean[];
  readonly events: readonly GameEvent[];
}

/** Sets one defined achievement once and emits only the earned public outcome. */
export function unlockAchievement(
  achievementSlots: readonly boolean[],
  slot: number,
): AchievementUnlockResult {
  if (achievementSlots[slot] === true) {
    return Object.freeze({
      achievementSlots,
      events: Object.freeze([]),
    });
  }

  const nextSlots = [...achievementSlots];
  nextSlots[slot] = true;
  return Object.freeze({
    achievementSlots: Object.freeze(nextSlots),
    events: Object.freeze([
      Object.freeze({
        type: "achievement-unlocked" as const,
        achievement: achievementIdForSlot(slot),
      }),
    ]),
  });
}

export function allEquipmentDiscovered(
  weaponDiscoveries: readonly boolean[],
  armorDiscoveries: readonly boolean[],
): boolean {
  return (
    weaponDiscoveries.length === PROFILE_EQUIPMENT_TIER_COUNT &&
    armorDiscoveries.length === PROFILE_EQUIPMENT_TIER_COUNT &&
    weaponDiscoveries.every(Boolean) &&
    armorDiscoveries.every(Boolean)
  );
}
