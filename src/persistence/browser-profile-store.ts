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

const PROFILE_STORAGE_BACKUP_SUFFIX = ".backup";
const PROFILE_STORAGE_COMMIT_SUFFIX = ".commit";
const PROFILE_STORAGE_COMMIT_MARKER_PREFIX = "trigger-knight.commit.v1:";

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

interface RawReadSuccess {
  readonly ok: true;
  readonly raw: string | null;
}

type RawReadResult =
  RawReadSuccess | Readonly<{ ok: false; error: ProfileStorageError }>;

interface Candidate {
  readonly raw: string;
  readonly decoded: DecodeResult;
}

interface SelectedRecord {
  readonly kind: "record";
  readonly raw: string;
  readonly decoded: Readonly<{ ok: true; value: DecodedEnvelope }>;
  readonly repair: boolean;
}

type Selection =
  | Readonly<{ kind: "empty" }>
  | SelectedRecord
  | Readonly<{ kind: "failed"; error: ProfileStorageError }>;

type CommitMarker =
  | Readonly<{ kind: "missing" }>
  | Readonly<{ kind: "valid"; record: string | null }>
  | Readonly<{ kind: "invalid" }>;

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

function serializeCurrent(profile: ProfileState): string | ProfileStorageError {
  try {
    return JSON.stringify(currentEnvelope(profile));
  } catch {
    return error("write-failed", "Profile could not be serialized");
  }
}

function readRaw(storage: StorageLike, key: string): RawReadResult {
  try {
    return { ok: true, raw: storage.getItem(key) };
  } catch {
    return {
      ok: false,
      error: error("storage-read-failed", "Profile storage could not be read"),
    };
  }
}

function writeRawAndVerify(
  storage: StorageLike,
  key: string,
  value: string | null,
): void {
  if (value === null) {
    storage.removeItem(key);
  } else {
    storage.setItem(key, value);
  }
  if (storage.getItem(key) !== value) {
    throw new Error("Stored profile verification failed");
  }
}

function encodeCommitMarker(record: string | null): string {
  return record === null
    ? `${PROFILE_STORAGE_COMMIT_MARKER_PREFIX}empty`
    : `${PROFILE_STORAGE_COMMIT_MARKER_PREFIX}${record}`;
}

function decodeCommitMarker(raw: string | null): CommitMarker {
  if (raw === null) {
    return { kind: "missing" };
  }
  if (raw === `${PROFILE_STORAGE_COMMIT_MARKER_PREFIX}empty`) {
    return { kind: "valid", record: null };
  }
  if (raw.startsWith(PROFILE_STORAGE_COMMIT_MARKER_PREFIX)) {
    const record = raw.slice(PROFILE_STORAGE_COMMIT_MARKER_PREFIX.length);
    return record === "" ? { kind: "invalid" } : { kind: "valid", record };
  }
  return { kind: "invalid" };
}

function candidate(
  raw: string | null,
  decoded: DecodeResult | undefined,
): Candidate | undefined {
  return raw === null || decoded === undefined ? undefined : { raw, decoded };
}

function selectCandidate(
  record: Candidate | undefined,
  repair: boolean,
): SelectedRecord | undefined {
  if (record?.decoded.ok !== true) {
    return undefined;
  }
  return {
    kind: "record",
    raw: record.raw,
    decoded: record.decoded,
    repair,
  };
}

function firstDecodeError(
  primary: Candidate | undefined,
  backup: Candidate | undefined,
): ProfileStorageError {
  if (primary?.decoded.ok === false) {
    return primary.decoded.error;
  }
  if (backup?.decoded.ok === false) {
    return backup.decoded.error;
  }
  return error(
    "invalid-record",
    "Stored profile commit state does not identify a valid record",
  );
}

function selectCommittedRecord(
  primaryRaw: string | null,
  backupRaw: string | null,
  marker: CommitMarker,
): Selection {
  const primary = candidate(
    primaryRaw,
    primaryRaw === null ? undefined : decodeEnvelope(primaryRaw),
  );
  const backup = candidate(
    backupRaw,
    backupRaw === null ? undefined : decodeEnvelope(backupRaw),
  );

  if (marker.kind === "missing") {
    if (primaryRaw === null && backupRaw === null) {
      return { kind: "empty" };
    }
    if (backupRaw !== null) {
      return {
        kind: "failed",
        error: error(
          "invalid-record",
          "Stored profile has an incomplete commit journal",
        ),
      };
    }
    const directPrimary = selectCandidate(primary, false);
    if (directPrimary !== undefined) {
      return directPrimary;
    }
    return { kind: "failed", error: firstDecodeError(primary, backup) };
  }

  if (marker.kind === "invalid") {
    return {
      kind: "failed",
      error: error(
        "invalid-record",
        "Stored profile commit metadata is not valid",
      ),
    };
  }

  if (marker.record === null) {
    return primaryRaw === null && backupRaw === null
      ? { kind: "empty" }
      : {
          kind: "failed",
          error: error(
            "invalid-record",
            "Stored profile commit journal points to an empty record",
          ),
        };
  }

  if (marker.record === primaryRaw && primaryRaw !== null) {
    const committedPrimary = selectCandidate(primary, false);
    if (committedPrimary !== undefined) {
      return committedPrimary;
    }
    return { kind: "failed", error: firstDecodeError(primary, backup) };
  }

  if (marker.record === backupRaw && backupRaw !== null) {
    const committedBackup = selectCandidate(backup, true);
    if (committedBackup !== undefined) {
      return committedBackup;
    }
  }
  return { kind: "failed", error: firstDecodeError(primary, backup) };
}

function publishCommitMarker(
  storage: StorageLike,
  commitKey: string,
  serialized: string,
  previousMarker: string,
): ProfileStorageError | undefined {
  const nextMarker = encodeCommitMarker(serialized);
  try {
    storage.setItem(commitKey, nextMarker);
    return undefined;
  } catch {
    let observed: string | null | undefined;
    try {
      observed = storage.getItem(commitKey);
    } catch {
      observed = undefined;
    }
    if (observed === nextMarker) {
      return undefined;
    }

    try {
      writeRawAndVerify(storage, commitKey, previousMarker);
    } catch {
      // If publication mutated the marker, load will choose the complete record it names.
    }
    return error(
      "write-failed",
      "Profile commit marker could not be published",
    );
  }
}

/** Commits one record while retaining the prior record as the recovery choice. */
function commitSerialized(
  storage: StorageLike,
  key: string,
  serialized: string,
  previous: string | null,
): ProfileStorageError | undefined {
  const backupKey = `${key}${PROFILE_STORAGE_BACKUP_SUFFIX}`;
  const commitKey = `${key}${PROFILE_STORAGE_COMMIT_SUFFIX}`;
  const previousMarker = encodeCommitMarker(previous);

  try {
    writeRawAndVerify(storage, backupKey, previous);
    writeRawAndVerify(storage, commitKey, previousMarker);
    writeRawAndVerify(storage, key, serialized);
  } catch {
    try {
      writeRawAndVerify(storage, commitKey, previousMarker);
    } catch {
      // The primary and backup records still retain a complete candidate pair.
    }
    return error("write-failed", "Profile write failed");
  }

  return publishCommitMarker(storage, commitKey, serialized, previousMarker);
}

function failedLoad(errorValue: ProfileStorageError): ProfileLoadResult {
  return Object.freeze({ status: "failed" as const, error: errorValue });
}

function saveTargetError(
  storage: StorageLike,
  key: string,
  primaryRaw: string | null,
): ProfileStorageError | undefined {
  const backupResult = readRaw(
    storage,
    `${key}${PROFILE_STORAGE_BACKUP_SUFFIX}`,
  );
  if (!backupResult.ok) {
    return backupResult.error;
  }
  const markerResult = readRaw(
    storage,
    `${key}${PROFILE_STORAGE_COMMIT_SUFFIX}`,
  );
  if (!markerResult.ok) {
    return markerResult.error;
  }

  if (markerResult.raw === null) {
    return backupResult.raw === null
      ? undefined
      : error(
          "invalid-record",
          "Stored profile has recoverable data that must be loaded first",
        );
  }

  const marker = decodeCommitMarker(markerResult.raw);
  if (marker.kind === "valid" && marker.record === null) {
    return backupResult.raw === null
      ? primaryRaw === null
        ? undefined
        : error(
            "invalid-record",
            "Stored profile commit journal points to an empty record",
          )
      : error(
          "invalid-record",
          "Stored profile has recoverable data that must be loaded first",
        );
  }
  if (marker.kind !== "valid" || marker.record !== primaryRaw) {
    return error(
      "invalid-record",
      "Stored profile commit state is incomplete or unreadable",
    );
  }
  return undefined;
}

/** Browser adapter for the versioned profile envelope. */
export function createBrowserProfileStore(
  storage: StorageLike,
  key: string = PROFILE_STORAGE_KEY,
): ProfileStore {
  return Object.freeze({
    load(): ProfileLoadResult {
      const primaryResult = readRaw(storage, key);
      if (!primaryResult.ok) {
        return failedLoad(primaryResult.error);
      }
      const backupResult = readRaw(
        storage,
        `${key}${PROFILE_STORAGE_BACKUP_SUFFIX}`,
      );
      if (!backupResult.ok) {
        return failedLoad(backupResult.error);
      }
      const markerResult = readRaw(
        storage,
        `${key}${PROFILE_STORAGE_COMMIT_SUFFIX}`,
      );
      if (!markerResult.ok) {
        return failedLoad(markerResult.error);
      }

      const selection = selectCommittedRecord(
        primaryResult.raw,
        backupResult.raw,
        decodeCommitMarker(markerResult.raw),
      );
      if (selection.kind === "failed") {
        return failedLoad(selection.error);
      }
      if (selection.kind === "empty") {
        return Object.freeze({
          status: "empty" as const,
          profile: createFreshProfile(),
        });
      }

      const profile = selection.decoded.value.profile;
      if (selection.repair || selection.decoded.value.migrated) {
        const serialized = serializeCurrent(profile);
        if (typeof serialized !== "string") {
          return failedLoad(
            error(
              "migration-failed",
              "Profile migration or recovery could not be serialized",
            ),
          );
        }
        const writeError = commitSerialized(
          storage,
          key,
          serialized,
          selection.raw,
        );
        if (writeError !== undefined) {
          return failedLoad(
            error(
              "migration-failed",
              "Profile migration or recovery could not be committed",
            ),
          );
        }
      }

      return Object.freeze({
        status: "loaded" as const,
        profile,
        migrated: selection.decoded.value.migrated,
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

      const primaryResult = readRaw(storage, key);
      if (!primaryResult.ok) {
        return Object.freeze({
          status: "failed" as const,
          error: primaryResult.error,
        });
      }
      if (primaryResult.raw !== null) {
        const previous = decodeEnvelope(primaryResult.raw);
        if (!previous.ok) {
          return Object.freeze({
            status: "failed" as const,
            error: previous.error,
          });
        }
      }

      const journalError = saveTargetError(storage, key, primaryResult.raw);
      if (journalError !== undefined) {
        return Object.freeze({
          status: "failed" as const,
          error: journalError,
        });
      }

      const serialized = serializeCurrent(normalized);
      if (typeof serialized !== "string") {
        return Object.freeze({
          status: "failed" as const,
          error: serialized,
        });
      }
      const writeError = commitSerialized(
        storage,
        key,
        serialized,
        primaryResult.raw,
      );
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
