import type { ProfileState } from "../domain/contracts.js";
import { createFreshProfile, normalizeProfile } from "../domain/profile.js";
import type {
  ProfileLoadResult,
  ProfileSaveResult,
  ProfileStorageError,
  ProfileStore,
} from "../application/persistence.js";

export const PROFILE_STORAGE_KEY = "trigger-knight.profile";
export const PROFILE_STORAGE_LEGACY_ENVELOPE_VERSION = 1 as const;
export const PROFILE_STORAGE_ENVELOPE_VERSION = 2 as const;

/** Minimal browser storage surface used by the adapter and its tests. */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

interface CurrentProfileProgress {
  readonly schemaVersion: 2;
  readonly level: number;
  readonly xp: number;
  readonly scoreMultiplier: number;
  readonly highScore: number;
  readonly weaponDiscoveries: readonly boolean[];
  readonly armorDiscoveries: readonly boolean[];
  readonly achievementSlots: readonly boolean[];
}

interface CurrentProfileSettings {
  readonly tutorialPreference: ProfileState["tutorialPreference"];
}

interface CurrentProfileEnvelope {
  readonly schemaVersion: typeof PROFILE_STORAGE_ENVELOPE_VERSION;
  readonly profile: CurrentProfileProgress;
  readonly settings: CurrentProfileSettings;
}

interface DecodedEnvelope {
  readonly profile: ProfileState;
  readonly migrated: boolean;
}

type DecodeResult =
  | Readonly<{ ok: true; value: DecodedEnvelope }>
  | Readonly<{ ok: false; error: ProfileStorageError }>;

function error(
  code: ProfileStorageError["code"],
  message: string,
): ProfileStorageError {
  return Object.freeze({ code, message });
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value) as unknown;
  return prototype === Object.prototype || prototype === null;
}

function hasExactKeys(
  value: Record<string, unknown>,
  keys: readonly string[],
): boolean {
  return (
    Reflect.ownKeys(value).every(
      (key) => typeof key === "string" && keys.includes(key),
    ) && keys.every((key) => Object.hasOwn(value, key))
  );
}

function decodeCurrentEnvelope(
  envelope: Record<string, unknown>,
): DecodeResult {
  if (
    !hasExactKeys(envelope, ["schemaVersion", "profile", "settings"]) ||
    !isPlainRecord(envelope.profile) ||
    !isPlainRecord(envelope.settings)
  ) {
    return {
      ok: false,
      error: error(
        "invalid-record",
        "Stored profile record has an unsupported current shape",
      ),
    };
  }

  const progress = envelope.profile;
  const settings = envelope.settings;
  if (
    !hasExactKeys(progress, [
      "schemaVersion",
      "level",
      "xp",
      "scoreMultiplier",
      "highScore",
      "weaponDiscoveries",
      "armorDiscoveries",
      "achievementSlots",
    ]) ||
    !hasExactKeys(settings, ["tutorialPreference"])
  ) {
    return {
      ok: false,
      error: error(
        "invalid-record",
        "Stored profile record has unsupported fields",
      ),
    };
  }

  try {
    return {
      ok: true,
      value: {
        profile: normalizeProfile({
          ...progress,
          tutorialPreference: settings.tutorialPreference,
        }),
        migrated: false,
      },
    };
  } catch {
    return {
      ok: false,
      error: error(
        "invalid-record",
        "Stored profile record contains invalid profile or setting values",
      ),
    };
  }
}

function decodeLegacyEnvelope(envelope: Record<string, unknown>): DecodeResult {
  if (!hasExactKeys(envelope, ["schemaVersion", "profile"])) {
    return {
      ok: false,
      error: error(
        "invalid-record",
        "Legacy stored profile record has an unsupported shape",
      ),
    };
  }

  if (
    !isPlainRecord(envelope.profile) ||
    envelope.profile.schemaVersion !== 2
  ) {
    return {
      ok: false,
      error: error(
        "invalid-record",
        "Legacy stored profile must contain a complete profile",
      ),
    };
  }

  try {
    return {
      ok: true,
      value: {
        profile: normalizeProfile(envelope.profile),
        migrated: true,
      },
    };
  } catch {
    return {
      ok: false,
      error: error(
        "invalid-record",
        "Legacy stored profile contains invalid values",
      ),
    };
  }
}

function decodeEnvelope(raw: string): DecodeResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    return {
      ok: false,
      error: error("corrupt-record", "Stored profile is not valid JSON"),
    };
  }

  if (!isPlainRecord(parsed)) {
    return {
      ok: false,
      error: error("invalid-record", "Stored profile must be a record"),
    };
  }

  if (
    parsed.schemaVersion !== PROFILE_STORAGE_ENVELOPE_VERSION &&
    parsed.schemaVersion !== PROFILE_STORAGE_LEGACY_ENVELOPE_VERSION
  ) {
    return {
      ok: false,
      error: error(
        "unsupported-version",
        "Stored profile envelope version is not supported",
      ),
    };
  }

  return parsed.schemaVersion === PROFILE_STORAGE_ENVELOPE_VERSION
    ? decodeCurrentEnvelope(parsed)
    : decodeLegacyEnvelope(parsed);
}

function currentEnvelope(profile: ProfileState): CurrentProfileEnvelope {
  return {
    schemaVersion: PROFILE_STORAGE_ENVELOPE_VERSION,
    profile: {
      schemaVersion: profile.schemaVersion,
      level: profile.level,
      xp: profile.xp,
      scoreMultiplier: profile.scoreMultiplier,
      highScore: profile.highScore,
      weaponDiscoveries: profile.weaponDiscoveries,
      armorDiscoveries: profile.armorDiscoveries,
      achievementSlots: profile.achievementSlots,
    },
    settings: {
      tutorialPreference: profile.tutorialPreference,
    },
  };
}

function restore(
  storage: StorageLike,
  key: string,
  previous: string | null,
): void {
  if (previous === null) {
    storage.removeItem(key);
  } else {
    storage.setItem(key, previous);
  }
}

function writeAtomically(
  storage: StorageLike,
  key: string,
  serialized: string,
  previous: string | null,
): ProfileStorageError | undefined {
  try {
    storage.setItem(key, serialized);
    if (storage.getItem(key) !== serialized) {
      throw new Error("Stored profile verification failed");
    }
    return undefined;
  } catch {
    try {
      restore(storage, key, previous);
    } catch {
      return error(
        "write-failed",
        "Profile write failed and the previous record could not be restored",
      );
    }
    return error("write-failed", "Profile write failed");
  }
}

function failed(errorValue: ProfileStorageError): ProfileLoadResult {
  return Object.freeze({ status: "failed" as const, error: errorValue });
}

/** Browser adapter for the versioned profile envelope. */
export function createBrowserProfileStore(
  storage: StorageLike,
  key: string = PROFILE_STORAGE_KEY,
): ProfileStore {
  const saveCurrent = (
    profile: ProfileState,
    previous: string | null,
  ): ProfileStorageError | undefined => {
    let serialized: string;
    try {
      serialized = JSON.stringify(currentEnvelope(profile));
    } catch {
      return error("write-failed", "Profile could not be serialized");
    }
    return writeAtomically(storage, key, serialized, previous);
  };

  return Object.freeze({
    load(): ProfileLoadResult {
      let raw: string | null;
      try {
        raw = storage.getItem(key);
      } catch {
        return failed(
          error("storage-read-failed", "Profile storage could not be read"),
        );
      }

      if (raw === null) {
        return Object.freeze({
          status: "empty" as const,
          profile: createFreshProfile(),
        });
      }

      const decoded = decodeEnvelope(raw);
      if (!decoded.ok) {
        return failed(decoded.error);
      }

      if (decoded.value.migrated) {
        const migrationError = saveCurrent(decoded.value.profile, raw);
        if (migrationError !== undefined) {
          return failed(
            error(
              "migration-failed",
              "Profile migration could not be committed",
            ),
          );
        }
      }

      return Object.freeze({
        status: "loaded" as const,
        profile: decoded.value.profile,
        migrated: decoded.value.migrated,
      });
    },

    save(profile: ProfileState): ProfileSaveResult {
      let normalized: ProfileState;
      try {
        normalized = normalizeProfile(profile);
      } catch {
        return Object.freeze({
          status: "failed" as const,
          error: error("invalid-record", "Profile cannot be stored"),
        });
      }

      let previous: string | null;
      try {
        previous = storage.getItem(key);
      } catch {
        return Object.freeze({
          status: "failed" as const,
          error: error(
            "storage-read-failed",
            "Profile storage could not be read before writing",
          ),
        });
      }

      const writeError = saveCurrent(normalized, previous);
      if (writeError !== undefined) {
        return Object.freeze({
          status: "failed" as const,
          error: writeError,
        });
      }

      return Object.freeze({ status: "saved" as const, profile: normalized });
    },
  });
}
