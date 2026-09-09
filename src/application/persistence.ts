import type { ProfileState } from "../domain/contracts.js";

/** Stable failure categories returned by a profile persistence adapter. */
export type ProfileStorageErrorCode =
  | "storage-read-failed"
  | "corrupt-record"
  | "unsupported-version"
  | "invalid-record"
  | "migration-failed"
  | "write-outcome-unknown"
  | "write-failed";

export interface ProfileStorageError {
  readonly code: ProfileStorageErrorCode;
  readonly message: string;
}

export type ProfileLoadResult =
  | Readonly<{
      status: "empty";
      profile: ProfileState;
    }>
  | Readonly<{
      status: "loaded";
      profile: ProfileState;
      migrated: boolean;
    }>
  | Readonly<{
      status: "failed";
      error: ProfileStorageError;
    }>;

export type ProfileSaveResult =
  | Readonly<{
      status: "saved";
      profile: ProfileState;
    }>
  | Readonly<{
      status: "uncertain";
      error: ProfileStorageError;
    }>
  | Readonly<{
      status: "failed";
      error: ProfileStorageError;
    }>;

/** Application boundary for between-run profile and supported settings data. */
export interface ProfileStore {
  load(): ProfileLoadResult;
  save(profile: ProfileState): ProfileSaveResult;
}
