import type {
  CompletedRunSettlementInput,
  ProfileInput,
  ProfileState,
} from "./contracts.js";

export const PROFILE_SCHEMA_VERSION = 2 as const;

const PROFILE_EXP_PER_TRANSFER = 3;
const PROFILE_LEVEL_THRESHOLD_BASE = 100;
const PROFILE_LEVEL_THRESHOLD_PER_LEVEL = 30;

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

/** Validates explicit configuration inputs, not a browser storage envelope. */
export function normalizeProfile(input: unknown): ProfileState {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    throw new TypeError("Profile must be a plain record");
  }
  const prototype = Object.getPrototypeOf(input) as unknown;
  if (prototype !== Object.prototype && prototype !== null) {
    throw new TypeError("Profile must be a plain record");
  }
  const profile = input as Record<string, unknown>;
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
      10,
    ),
    armorDiscoveries: flags(profile.armorDiscoveries, "armorDiscoveries", 10),
    achievementSlots: flags(profile.achievementSlots, "achievementSlots", 6),
  });
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
  let level = profile.level;
  let xp = profile.xp;
  let scoreMultiplier = profile.scoreMultiplier;
  let remainingExperience = run.profileExpEarned;

  while (remainingExperience > 0) {
    const transferred = Math.min(PROFILE_EXP_PER_TRANSFER, remainingExperience);
    xp += transferred;
    remainingExperience -= transferred;

    const threshold =
      PROFILE_LEVEL_THRESHOLD_BASE + level * PROFILE_LEVEL_THRESHOLD_PER_LEVEL;
    if (xp > threshold) {
      level += 1;
      xp = 0;
      scoreMultiplier = 1 + level / 10;
    }
  }

  return Object.freeze({
    ...profile,
    level,
    xp,
    scoreMultiplier,
    highScore: Math.max(profile.highScore, run.score),
    tutorialPreference: "disabled",
    weaponDiscoveries: Object.freeze([...profile.weaponDiscoveries]),
    armorDiscoveries: Object.freeze([...profile.armorDiscoveries]),
    achievementSlots: Object.freeze([...profile.achievementSlots]),
  });
}
