import type {
  AchievementId,
  CompletedRunSettlementInput,
  ProfileInput,
  ProfileState,
  ProfileUnlockState,
} from "./contracts.js";

export const PROFILE_SCHEMA_VERSION = 2 as const;
export const PROFILE_EQUIPMENT_TIER_COUNT = 10 as const;
export const PROFILE_ACHIEVEMENT_SLOT_COUNT = 6 as const;
export const PROFILE_DEFINED_ACHIEVEMENT_COUNT = 5 as const;

export const ACHIEVEMENT_IDS = Object.freeze([
  "slay-a-dragon",
  "stashed-3000-gold",
  "reach-day-10",
  "get-all-collection",
  "perform-70000-damage",
] as const satisfies readonly AchievementId[]);

const PROFILE_COLLECTION_POINTS_PER_DISCOVERY = 3.5;
const PROFILE_ACHIEVEMENT_POINTS_PER_UNLOCK = 6;

const PROFILE_EXP_PER_TRANSFER = 3;
const PROFILE_LEVEL_THRESHOLD_BASE = 100;
const PROFILE_LEVEL_THRESHOLD_PER_LEVEL = 30;

export interface ProfileExperienceView {
  readonly level: number;
  readonly xp: number;
  readonly threshold: number;
  readonly scoreMultiplier: number;
}

export interface ProfileProgress {
  readonly weaponCount: number;
  readonly armorCount: number;
  readonly collectionProgress: number;
  readonly achievementsUnlocked: number;
  readonly achievementProgress: number;
  readonly totalProgress: number;
}

/** Returns the committed EXP ceiling shown for a profile level. */
export function profileExperienceThreshold(level: number): number {
  if (!Number.isSafeInteger(level) || level < 1) {
    throw new RangeError("Profile level must be a safe integer >= 1");
  }
  return (
    PROFILE_LEVEL_THRESHOLD_BASE + level * PROFILE_LEVEL_THRESHOLD_PER_LEVEL
  );
}

interface AdvancedProfileExperience {
  readonly level: number;
  readonly xp: number;
  readonly scoreMultiplier: number;
}

function advanceProfileExperience(
  level: number,
  xp: number,
  scoreMultiplier: number,
  earned: number,
): AdvancedProfileExperience {
  let currentLevel = level;
  let currentXp = xp;
  let currentMultiplier = scoreMultiplier;
  let remainingExperience = earned;

  while (remainingExperience > 0) {
    const transferred = Math.min(PROFILE_EXP_PER_TRANSFER, remainingExperience);
    currentXp += transferred;
    remainingExperience -= transferred;

    const threshold = profileExperienceThreshold(currentLevel);
    if (currentXp > threshold) {
      currentLevel += 1;
      currentXp = 0;
      currentMultiplier = 1 + currentLevel / 10;
    }
  }

  return Object.freeze({
    level: currentLevel,
    xp: currentXp,
    scoreMultiplier: currentMultiplier,
  });
}

/** Projects the public profile EXP display at a deterministic animation point. */
export function profileExperienceAtProgress(
  level: number,
  xp: number,
  scoreMultiplier: number,
  earned: number,
  progress: number,
): ProfileExperienceView {
  if (
    !Number.isSafeInteger(level) ||
    level < 1 ||
    !Number.isSafeInteger(xp) ||
    xp < 0 ||
    !Number.isFinite(scoreMultiplier) ||
    scoreMultiplier < 0 ||
    !Number.isSafeInteger(earned) ||
    earned < 0 ||
    !Number.isFinite(progress)
  ) {
    throw new TypeError("Invalid profile EXP animation input");
  }

  const normalizedProgress = Math.min(1, Math.max(0, progress));
  const visibleEarned = Math.floor(earned * normalizedProgress);
  const advanced = advanceProfileExperience(
    level,
    xp,
    scoreMultiplier,
    visibleEarned,
  );
  return Object.freeze({
    ...advanced,
    threshold: profileExperienceThreshold(advanced.level),
  });
}

/** Creates independent defaults without inferring any past gameplay. */
export function createFreshProfile(): ProfileState {
  return Object.freeze({
    schemaVersion: PROFILE_SCHEMA_VERSION,
    level: 1,
    xp: 0,
    scoreMultiplier: 1,
    highScore: 0,
    tutorialPreference: "enabled",
    weaponDiscoveries: Object.freeze([true, ...Array<boolean>(9).fill(false)]),
    armorDiscoveries: Object.freeze([true, ...Array<boolean>(9).fill(false)]),
    achievementSlots: Object.freeze(Array<boolean>(6).fill(false)),
  });
}

function nonnegativeNumber(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new TypeError(`Profile ${field} must be a finite nonnegative number`);
  }
  return value === 0 ? 0 : value;
}

function integer(value: unknown, field: string, minimum: number): number {
  const number = nonnegativeNumber(value, field);
  if (!Number.isSafeInteger(number) || number < minimum) {
    throw new TypeError(
      `Profile ${field} must be a safe integer >= ${minimum}`,
    );
  }
  return number;
}

function flags(
  value: unknown,
  field: string,
  length: number,
): readonly boolean[] {
  if (!Array.isArray(value) || value.length !== length) {
    throw new TypeError(`Profile ${field} must contain ${length} booleans`);
  }
  const copied: boolean[] = [];
  for (let index = 0; index < length; index += 1) {
    if (!Object.hasOwn(value, index) || typeof value[index] !== "boolean") {
      throw new TypeError(`Profile ${field} must contain ${length} booleans`);
    }
    copied.push(value[index] as boolean);
  }
  return Object.freeze(copied);
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value) as unknown;
  return prototype === Object.prototype || prototype === null;
}

function normalizeUnlockState(input: unknown): ProfileUnlockState {
  if (!isPlainRecord(input)) {
    throw new TypeError("Completed-run unlock state must be a plain record");
  }
  return Object.freeze({
    weaponDiscoveries: flags(
      input.weaponDiscoveries,
      "weaponDiscoveries",
      PROFILE_EQUIPMENT_TIER_COUNT,
    ),
    armorDiscoveries: flags(
      input.armorDiscoveries,
      "armorDiscoveries",
      PROFILE_EQUIPMENT_TIER_COUNT,
    ),
    achievementSlots: flags(
      input.achievementSlots,
      "achievementSlots",
      PROFILE_ACHIEVEMENT_SLOT_COUNT,
    ),
  });
}

function mergeFlags(
  profileFlags: readonly boolean[],
  runFlags: readonly boolean[],
): readonly boolean[] {
  return Object.freeze(
    profileFlags.map((value, index) => value || runFlags[index] === true),
  );
}

/** Validates explicit configuration inputs, not a browser storage envelope. */
export function normalizeProfile(input: unknown): ProfileState {
  if (!isPlainRecord(input)) {
    throw new TypeError("Profile must be a plain record");
  }
  const profile = input;
  if (
    profile.schemaVersion !== 1 &&
    profile.schemaVersion !== PROFILE_SCHEMA_VERSION
  ) {
    throw new TypeError("Unsupported profile schemaVersion");
  }
  const minimal = profile.schemaVersion === 1;
  const keys = minimal
    ? ["schemaVersion", "scoreMultiplier", "tutorialPreference"]
    : Object.keys(createFreshProfile());
  if (
    Reflect.ownKeys(profile).some(
      (key) => typeof key !== "string" || !keys.includes(key),
    )
  ) {
    throw new TypeError("Profile contains unsupported fields");
  }
  const scoreMultiplier = nonnegativeNumber(
    profile.scoreMultiplier,
    "scoreMultiplier",
  );
  if (scoreMultiplier === 0) {
    throw new TypeError("Profile scoreMultiplier must be positive");
  }
  const tutorialPreference =
    minimal && !Object.hasOwn(profile, "tutorialPreference")
      ? "enabled"
      : profile.tutorialPreference;
  if (tutorialPreference !== "enabled" && tutorialPreference !== "disabled") {
    throw new TypeError(
      "Profile tutorialPreference must be enabled or disabled",
    );
  }
  if (minimal) {
    return Object.freeze({
      ...createFreshProfile(),
      scoreMultiplier,
      tutorialPreference,
    });
  }
  return Object.freeze({
    schemaVersion: PROFILE_SCHEMA_VERSION,
    level: integer(profile.level, "level", 1),
    xp: integer(profile.xp, "xp", 0),
    scoreMultiplier,
    highScore: nonnegativeNumber(profile.highScore, "highScore"),
    tutorialPreference,
    weaponDiscoveries: flags(
      profile.weaponDiscoveries,
      "weaponDiscoveries",
      PROFILE_EQUIPMENT_TIER_COUNT,
    ),
    armorDiscoveries: flags(
      profile.armorDiscoveries,
      "armorDiscoveries",
      PROFILE_EQUIPMENT_TIER_COUNT,
    ),
    achievementSlots: flags(
      profile.achievementSlots,
      "achievementSlots",
      PROFILE_ACHIEVEMENT_SLOT_COUNT,
    ),
  });
}

/** Calculates the original achievement-screen point totals from committed flags. */
export function calculateProfileProgress(input: ProfileInput): ProfileProgress {
  const profile = normalizeProfile(input);
  const weaponCount = profile.weaponDiscoveries.filter(Boolean).length;
  const armorCount = profile.armorDiscoveries.filter(Boolean).length;
  const achievementsUnlocked = profile.achievementSlots
    .slice(0, PROFILE_DEFINED_ACHIEVEMENT_COUNT)
    .filter(Boolean).length;
  const collectionProgress =
    (weaponCount + armorCount) * PROFILE_COLLECTION_POINTS_PER_DISCOVERY;
  const achievementProgress =
    achievementsUnlocked * PROFILE_ACHIEVEMENT_POINTS_PER_UNLOCK;

  return Object.freeze({
    weaponCount,
    armorCount,
    collectionProgress,
    achievementsUnlocked,
    achievementProgress,
    totalProgress: collectionProgress + achievementProgress,
  });
}

/** Resolves only the five researched achievement slots into public identities. */
export function achievementIdForSlot(slot: number): AchievementId {
  const achievement = ACHIEVEMENT_IDS[slot];
  if (achievement === undefined) {
    throw new RangeError(`Achievement slot ${slot} has no defined condition`);
  }
  return achievement;
}

function assertCompletedRun(
  run: Readonly<CompletedRunSettlementInput>,
): asserts run is Readonly<CompletedRunSettlementInput> {
  if (
    run === null ||
    typeof run !== "object" ||
    run.lifecycle?.phase !== "ended" ||
    (run.lifecycle.terminalReason !== "lifespan" &&
      run.lifecycle.terminalReason !== "combat")
  ) {
    throw new TypeError(
      "Profile settlement requires a completed run with a gameplay death",
    );
  }
  if (!Number.isSafeInteger(run.profileExpEarned) || run.profileExpEarned < 0) {
    throw new TypeError(
      "Completed-run profile EXP must be a safe nonnegative integer",
    );
  }
  if (
    typeof run.score !== "number" ||
    !Number.isFinite(run.score) ||
    run.score < 0
  ) {
    throw new TypeError("Completed-run score must be finite and nonnegative");
  }
}

/** Applies one completed gameplay death to a copy of the explicit profile. */
export function settleCompletedRun(
  initialProfile: ProfileInput,
  run: Readonly<CompletedRunSettlementInput>,
): ProfileState {
  assertCompletedRun(run);
  const profile = normalizeProfile(initialProfile);
  const runUnlocks = normalizeUnlockState(run);
  let level = profile.level;
  let xp = profile.xp;
  let scoreMultiplier = profile.scoreMultiplier;
  const advanced = advanceProfileExperience(
    level,
    xp,
    scoreMultiplier,
    run.profileExpEarned,
  );
  level = advanced.level;
  xp = advanced.xp;
  scoreMultiplier = advanced.scoreMultiplier;

  return Object.freeze({
    ...profile,
    level,
    xp,
    scoreMultiplier,
    highScore: Math.max(profile.highScore, run.score),
    tutorialPreference: "disabled",
    weaponDiscoveries: mergeFlags(
      profile.weaponDiscoveries,
      runUnlocks.weaponDiscoveries,
    ),
    armorDiscoveries: mergeFlags(
      profile.armorDiscoveries,
      runUnlocks.armorDiscoveries,
    ),
    achievementSlots: mergeFlags(
      profile.achievementSlots,
      runUnlocks.achievementSlots,
    ),
  });
}
