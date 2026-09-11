import type {
  AchievementId,
  ArmorName,
  ProfileInput,
  WeaponName,
} from "../domain/contracts.js";
import {
  ORIGINAL_V13_ARMOR_NAMES,
  ORIGINAL_V13_WEAPON_NAMES,
} from "../domain/equipment.js";
import {
  ACHIEVEMENT_IDS,
  calculateProfileProgress,
  normalizeProfile,
  PROFILE_EQUIPMENT_TIER_COUNT,
} from "../domain/profile.js";

/** @playerVisible One discoverable equipment entry shown in a collection. */
export interface ProfileEquipmentView {
  readonly tier: number;
  readonly name: WeaponName | ArmorName;
  readonly discovered: boolean;
}

/** @playerVisible Equipment collection values selected for profile screens. */
export interface ProfileCollectionsView {
  readonly weapons: readonly ProfileEquipmentView[];
  readonly armor: readonly ProfileEquipmentView[];
  readonly weaponCount: number;
  readonly armorCount: number;
  readonly totalDiscovered: number;
  readonly total: number;
}

/** @playerVisible One defined achievement and its committed unlock state. */
export interface ProfileAchievementView {
  readonly id: AchievementId;
  readonly unlocked: boolean;
}

/** @playerVisible Committed profile data needed by browser menu screens. */
export interface ProfileOverviewView {
  readonly level: number;
  readonly xp: number;
  readonly scoreMultiplier: number;
  readonly highScore: number;
  readonly collections: ProfileCollectionsView;
  readonly achievements: readonly ProfileAchievementView[];
  readonly progress: Readonly<{
    readonly collectionPoints: number;
    readonly achievementPoints: number;
    readonly totalPoints: number;
  }>;
}

function equipmentView<Name extends WeaponName | ArmorName>(
  names: readonly Name[],
  discoveries: readonly boolean[],
): readonly ProfileEquipmentView[] {
  return Object.freeze(
    names.map((name, index) =>
      Object.freeze({
        tier: index + 1,
        name,
        discovered: discoveries[index] === true,
      }),
    ),
  );
}

/**
 * Projects a committed profile into explicit menu data without exposing its
 * storage schema, tutorial preference, or authoritative unlock arrays.
 */
export function createProfileOverviewView(
  input: ProfileInput,
): ProfileOverviewView {
  const profile = normalizeProfile(input);
  const progress = calculateProfileProgress(profile);
  const collections = Object.freeze({
    weapons: equipmentView(
      ORIGINAL_V13_WEAPON_NAMES,
      profile.weaponDiscoveries,
    ),
    armor: equipmentView(ORIGINAL_V13_ARMOR_NAMES, profile.armorDiscoveries),
    weaponCount: progress.weaponCount,
    armorCount: progress.armorCount,
    totalDiscovered: progress.weaponCount + progress.armorCount,
    total: PROFILE_EQUIPMENT_TIER_COUNT * 2,
  });
  const achievements = Object.freeze(
    ACHIEVEMENT_IDS.map((id, index) =>
      Object.freeze({ id, unlocked: profile.achievementSlots[index] === true }),
    ),
  );

  return Object.freeze({
    level: profile.level,
    xp: profile.xp,
    scoreMultiplier: profile.scoreMultiplier,
    highScore: profile.highScore,
    collections,
    achievements,
    progress: Object.freeze({
      collectionPoints: progress.collectionProgress,
      achievementPoints: progress.achievementProgress,
      totalPoints: progress.totalProgress,
    }),
  });
}
