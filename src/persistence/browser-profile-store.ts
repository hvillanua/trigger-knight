import type { ProfileState } from "../domain/contracts.js";
import { createFreshProfile, normalizeProfile } from "../domain/profile.js";
import type {
  CompletedRunCommitRequest,
  CompletedRunCommitResult,
  ProfileLoadResult,
  ProfileSaveResult,
  ProfileStorageError,
  ProfileStore,
} from "../application/persistence.js";

export const PROFILE_STORAGE_KEY = "trigger-knight.profile";
export const PROFILE_STORAGE_LEGACY_ENVELOPE_VERSION = 1 as const;
export const PROFILE_STORAGE_PREVIOUS_ENVELOPE_VERSION = 2 as const;
export const PROFILE_STORAGE_ENVELOPE_VERSION = 3 as const;

const PROFILE_STORAGE_BACKUP_SUFFIX = ".backup";
const PROFILE_STORAGE_COMMIT_SUFFIX = ".commit";
const PROFILE_STORAGE_COMMIT_MARKER_PREFIX = "trigger-knight.commit.v1:";
const PROFILE_STORAGE_READY_MARKER_PREFIX = `${PROFILE_STORAGE_COMMIT_MARKER_PREFIX}ready:`;

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
  readonly completedRuns: readonly StoredCompletedRun[];
}

interface StoredCompletedRun {
  readonly completionId: string;
  readonly fingerprint: string;
}

interface DecodedEnvelope {
  readonly profile: ProfileState;
  readonly completedRuns: readonly StoredCompletedRun[];
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
  | Readonly<{ kind: "ready"; record: string }>
  | Readonly<{ kind: "invalid" }>;

type CommitOutcome =
  | Readonly<{ status: "saved" }>
  | Readonly<{ status: "failed"; error: ProfileStorageError }>
  | Readonly<{ status: "uncertain"; error: ProfileStorageError }>;

function uncertainCommitOutcome(): CommitOutcome {
  return {
    status: "uncertain",
    error: error(
      "write-outcome-unknown",
      "Profile commit outcome could not be reconciled; load the profile before retrying",
    ),
  };
}

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

function decodeCompletedRuns(
  value: unknown,
): readonly StoredCompletedRun[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const seen = new Set<string>();
  const completedRuns: StoredCompletedRun[] = [];
  for (const entry of value) {
    if (!isPlainRecord(entry)) {
      return undefined;
    }
    if (!hasExactKeys(entry, ["completionId", "fingerprint"])) {
      return undefined;
    }
    if (
      typeof entry.completionId !== "string" ||
      entry.completionId.trim() === "" ||
      typeof entry.fingerprint !== "string" ||
      entry.fingerprint.trim() === "" ||
      seen.has(entry.completionId)
    ) {
      return undefined;
    }
    seen.add(entry.completionId);
    completedRuns.push({
      completionId: entry.completionId,
      fingerprint: entry.fingerprint,
    });
  }

  return Object.freeze(completedRuns);
}

function decodeCurrentEnvelope(
  envelope: Record<string, unknown>,
): DecodeResult {
  if (
    !hasExactKeys(envelope, [
      "schemaVersion",
      "profile",
      "settings",
      "completedRuns",
    ]) ||
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
  const completedRuns = decodeCompletedRuns(envelope.completedRuns);
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
  if (completedRuns === undefined) {
    return {
      ok: false,
      error: error(
        "invalid-record",
        "Stored profile record has invalid completion metadata",
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
        completedRuns,
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

function decodePreviousEnvelope(
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
        "Previous stored profile record has an unsupported shape",
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
        "Previous stored profile record has unsupported fields",
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
        completedRuns: Object.freeze([]),
        migrated: true,
      },
    };
  } catch {
    return {
      ok: false,
      error: error(
        "invalid-record",
        "Previous stored profile record contains invalid profile or setting values",
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
        completedRuns: Object.freeze([]),
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
    parsed.schemaVersion !== PROFILE_STORAGE_PREVIOUS_ENVELOPE_VERSION &&
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

  if (parsed.schemaVersion === PROFILE_STORAGE_ENVELOPE_VERSION) {
    return decodeCurrentEnvelope(parsed);
  }
  if (parsed.schemaVersion === PROFILE_STORAGE_PREVIOUS_ENVELOPE_VERSION) {
    return decodePreviousEnvelope(parsed);
  }
  return decodeLegacyEnvelope(parsed);
}

function currentEnvelope(
  profile: ProfileState,
  completedRuns: readonly StoredCompletedRun[],
): CurrentProfileEnvelope {
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
    completedRuns,
  };
}

function serializeCurrent(
  profile: ProfileState,
  completedRuns: readonly StoredCompletedRun[],
): string | ProfileStorageError {
  try {
    return JSON.stringify(currentEnvelope(profile, completedRuns));
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

function encodeReadyMarker(record: string): string {
  return `${PROFILE_STORAGE_READY_MARKER_PREFIX}${record}`;
}

function decodeCommitMarker(raw: string | null): CommitMarker {
  if (raw === null) {
    return { kind: "missing" };
  }
  if (raw === `${PROFILE_STORAGE_COMMIT_MARKER_PREFIX}empty`) {
    return { kind: "valid", record: null };
  }
  if (raw.startsWith(PROFILE_STORAGE_READY_MARKER_PREFIX)) {
    const record = raw.slice(PROFILE_STORAGE_READY_MARKER_PREFIX.length);
    return record === "" ? { kind: "invalid" } : { kind: "ready", record };
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

  if (marker.kind === "ready") {
    if (marker.record === primaryRaw && primaryRaw !== null) {
      const readyPrimary = selectCandidate(primary, true);
      if (readyPrimary !== undefined) {
        return readyPrimary;
      }
    }
    return { kind: "failed", error: firstDecodeError(primary, backup) };
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

function restorePreviousPrimary(
  storage: StorageLike,
  key: string,
  commitKey: string,
  serialized: string,
  previous: string | null,
): CommitOutcome {
  try {
    writeRawAndVerify(storage, key, previous);
  } catch {
    if (previous === null) {
      try {
        writeRawAndVerify(storage, commitKey, encodeReadyMarker(serialized));
      } catch {
        // The outcome remains unknown when the recovery marker cannot be staged.
      }
      return uncertainCommitOutcome();
    }
    return {
      status: "failed",
      error: error("write-failed", "Profile write failed"),
    };
  }
  return {
    status: "failed",
    error: error("write-failed", "Profile write failed"),
  };
}

function publishCommitMarker(
  storage: StorageLike,
  key: string,
  commitKey: string,
  serialized: string,
  previous: string | null,
  previousMarker: string,
): CommitOutcome {
  const nextMarker = encodeCommitMarker(serialized);
  const readyMarker = encodeReadyMarker(serialized);
  try {
    storage.setItem(commitKey, nextMarker);
    return { status: "saved" };
  } catch {
    let observed: string | null | undefined;
    try {
      observed = storage.getItem(commitKey);
    } catch {
      observed = undefined;
    }
    if (observed === nextMarker) {
      return { status: "saved" };
    }
    if (observed === readyMarker) {
      return uncertainCommitOutcome();
    }

    try {
      writeRawAndVerify(storage, commitKey, previousMarker);
    } catch {
      if (previous === null) {
        try {
          writeRawAndVerify(storage, commitKey, readyMarker);
        } catch {
          // The outcome remains unknown when the recovery marker cannot be staged.
        }
      }
      return uncertainCommitOutcome();
    }
    return restorePreviousPrimary(
      storage,
      key,
      commitKey,
      serialized,
      previous,
    );
  }
}

function publishReadyMarker(
  storage: StorageLike,
  key: string,
  commitKey: string,
  serialized: string,
  previous: string | null,
  previousMarker: string,
): CommitOutcome {
  const readyMarker = encodeReadyMarker(serialized);
  try {
    writeRawAndVerify(storage, commitKey, readyMarker);
    return { status: "saved" };
  } catch {
    let observed: string | null | undefined;
    try {
      observed = storage.getItem(commitKey);
    } catch {
      observed = undefined;
    }
    if (observed === readyMarker) {
      return { status: "saved" };
    }

    if (observed !== previousMarker) {
      if (previous === null) {
        try {
          writeRawAndVerify(storage, commitKey, readyMarker);
        } catch {
          // The outcome remains unknown when the recovery marker cannot be staged.
        }
      }
      return uncertainCommitOutcome();
    }

    return restorePreviousPrimary(
      storage,
      key,
      commitKey,
      serialized,
      previous,
    );
  }
}

/** Commits one record while retaining the prior record as the recovery choice. */
function commitSerialized(
  storage: StorageLike,
  key: string,
  serialized: string,
  previous: string | null,
): CommitOutcome {
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
      if (previous === null) {
        try {
          writeRawAndVerify(storage, commitKey, encodeReadyMarker(serialized));
        } catch {
          // The outcome remains unknown when the recovery marker cannot be staged.
        }
      }
      return uncertainCommitOutcome();
    }
    return restorePreviousPrimary(
      storage,
      key,
      commitKey,
      serialized,
      previous,
    );
  }

  const readyOutcome = publishReadyMarker(
    storage,
    key,
    commitKey,
    serialized,
    previous,
    previousMarker,
  );
  if (readyOutcome.status !== "saved") {
    return readyOutcome;
  }

  return publishCommitMarker(
    storage,
    key,
    commitKey,
    serialized,
    previous,
    previousMarker,
  );
}

function failedLoad(errorValue: ProfileStorageError): ProfileLoadResult {
  return Object.freeze({ status: "failed" as const, error: errorValue });
}

type SelectionReadResult =
  | Readonly<{
      ok: true;
      selection: Selection;
    }>
  | Readonly<{ ok: false; error: ProfileStorageError }>;

function readSelection(storage: StorageLike, key: string): SelectionReadResult {
  const primaryResult = readRaw(storage, key);
  if (!primaryResult.ok) {
    return { ok: false, error: primaryResult.error };
  }
  const backupResult = readRaw(
    storage,
    `${key}${PROFILE_STORAGE_BACKUP_SUFFIX}`,
  );
  if (!backupResult.ok) {
    return { ok: false, error: backupResult.error };
  }
  const markerResult = readRaw(
    storage,
    `${key}${PROFILE_STORAGE_COMMIT_SUFFIX}`,
  );
  if (!markerResult.ok) {
    return { ok: false, error: markerResult.error };
  }

  return {
    ok: true,
    selection: selectCommittedRecord(
      primaryResult.raw,
      backupResult.raw,
      decodeCommitMarker(markerResult.raw),
    ),
  };
}

function profilesEqual(left: ProfileState, right: ProfileState): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function invalidCommitResult(message: string): CompletedRunCommitResult {
  return Object.freeze({
    status: "failed" as const,
    error: error("invalid-record", message),
  });
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
      const selectionResult = readSelection(storage, key);
      if (!selectionResult.ok) {
        return failedLoad(selectionResult.error);
      }
      const selection = selectionResult.selection;
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
        const serialized = serializeCurrent(
          profile,
          selection.decoded.value.completedRuns,
        );
        if (typeof serialized !== "string") {
          return failedLoad(
            error(
              "migration-failed",
              "Profile migration or recovery could not be serialized",
            ),
          );
        }
        const writeOutcome = commitSerialized(
          storage,
          key,
          serialized,
          selection.raw,
        );
        if (writeOutcome.status !== "saved") {
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
      let completedRuns: readonly StoredCompletedRun[] = Object.freeze([]);
      if (primaryResult.raw !== null) {
        const previous = decodeEnvelope(primaryResult.raw);
        if (!previous.ok) {
          return Object.freeze({
            status: "failed" as const,
            error: previous.error,
          });
        }
        completedRuns = previous.value.completedRuns;
      }

      const journalError = saveTargetError(storage, key, primaryResult.raw);
      if (journalError !== undefined) {
        return Object.freeze({
          status: "failed" as const,
          error: journalError,
        });
      }

      const serialized = serializeCurrent(normalized, completedRuns);
      if (typeof serialized !== "string") {
        return Object.freeze({
          status: "failed" as const,
          error: serialized,
        });
      }
      const writeOutcome = commitSerialized(
        storage,
        key,
        serialized,
        primaryResult.raw,
      );
      if (writeOutcome.status !== "saved") {
        return Object.freeze({
          status: writeOutcome.status,
          error: writeOutcome.error,
        });
      }

      return Object.freeze({ status: "saved" as const, profile: normalized });
    },

    commitCompletedRun(
      request: CompletedRunCommitRequest,
    ): CompletedRunCommitResult {
      if (
        typeof request.completionId !== "string" ||
        request.completionId.trim() === "" ||
        typeof request.completionFingerprint !== "string" ||
        request.completionFingerprint.trim() === ""
      ) {
        return invalidCommitResult(
          "Completed-run commit identity must contain non-empty strings",
        );
      }

      let expectedProfile: ProfileState;
      let nextProfile: ProfileState;
      try {
        expectedProfile = normalizeProfile(request.expectedProfile);
        nextProfile = normalizeProfile(request.nextProfile);
      } catch {
        return invalidCommitResult(
          "Completed-run commit contains an invalid profile",
        );
      }

      const selectionResult = readSelection(storage, key);
      if (!selectionResult.ok) {
        return Object.freeze({
          status: "failed" as const,
          error: selectionResult.error,
        });
      }
      const selection = selectionResult.selection;
      if (selection.kind === "failed") {
        return Object.freeze({
          status: "failed" as const,
          error: selection.error,
        });
      }

      let previousRaw: string | null = null;
      let completedRuns: readonly StoredCompletedRun[] = Object.freeze([]);
      if (selection.kind === "record") {
        const current = selection.decoded.value;
        const existing = current.completedRuns.find(
          (entry) => entry.completionId === request.completionId,
        );
        if (existing !== undefined) {
          if (existing.fingerprint !== request.completionFingerprint) {
            return Object.freeze({
              status: "failed" as const,
              error: error(
                "completion-conflict",
                "Completion identity was reused for different inputs",
              ),
            });
          }
          return Object.freeze({
            status: "already-committed" as const,
            profile: current.profile,
          });
        }
        if (!profilesEqual(current.profile, expectedProfile)) {
          return Object.freeze({
            status: "failed" as const,
            error: error(
              "profile-conflict",
              "Committed profile changed before the completed run was stored",
            ),
          });
        }
        previousRaw = selection.raw;
        completedRuns = current.completedRuns;
      }

      const serialized = serializeCurrent(nextProfile, [
        ...completedRuns,
        {
          completionId: request.completionId,
          fingerprint: request.completionFingerprint,
        },
      ]);
      if (typeof serialized !== "string") {
        return Object.freeze({
          status: "failed" as const,
          error: serialized,
        });
      }

      const writeOutcome = commitSerialized(
        storage,
        key,
        serialized,
        previousRaw,
      );
      if (writeOutcome.status !== "saved") {
        return Object.freeze({
          status: writeOutcome.status,
          error: writeOutcome.error,
        });
      }

      return Object.freeze({ status: "saved" as const, profile: nextProfile });
    },
  });
}
