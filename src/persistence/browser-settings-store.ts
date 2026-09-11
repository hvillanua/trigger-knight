import type {
  BrowserSettings,
  SettingsLoadResult,
  SettingsSaveResult,
  SettingsStore,
} from "../application/settings.js";
import {
  createDefaultSettings,
  normalizeSettings,
  SETTINGS_SCHEMA_VERSION,
} from "../application/settings.js";
import type { ProfileStorageError } from "../application/persistence.js";

export const SETTINGS_STORAGE_KEY = "trigger-knight.settings";
export const SETTINGS_STORAGE_VERSION = SETTINGS_SCHEMA_VERSION;

/** Minimal storage surface shared by browser settings and profile tests. */
export interface SettingsStorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function error(
  code: ProfileStorageError["code"],
  message: string,
): ProfileStorageError {
  return Object.freeze({ code, message });
}

function failed(errorValue: ProfileStorageError): SettingsLoadResult {
  return Object.freeze({ status: "failed" as const, error: errorValue });
}

function decode(
  raw: string,
):
  | Readonly<{ ok: true; settings: BrowserSettings }>
  | Readonly<{ ok: false; error: ProfileStorageError }> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    return {
      ok: false,
      error: error("corrupt-record", "Stored settings are not valid JSON"),
    };
  }

  try {
    return { ok: true, settings: normalizeSettings(parsed) };
  } catch (cause) {
    const code =
      cause instanceof TypeError &&
      cause.message === "Unsupported settings schemaVersion"
        ? "unsupported-version"
        : "invalid-record";
    return {
      ok: false,
      error: error(
        code,
        "Stored settings contain unsupported or invalid values",
      ),
    };
  }
}

function read(
  storage: SettingsStorageLike,
  key: string,
):
  | Readonly<{ ok: true; raw: string | null }>
  | Readonly<{
      ok: false;
      error: ProfileStorageError;
    }> {
  try {
    return { ok: true, raw: storage.getItem(key) };
  } catch {
    return {
      ok: false,
      error: error(
        "storage-read-failed",
        "Browser settings storage could not be read",
      ),
    };
  }
}

function serialize(settings: BrowserSettings): string | ProfileStorageError {
  try {
    return JSON.stringify(settings);
  } catch {
    return error("write-failed", "Browser settings could not be serialized");
  }
}

function writeSettings(
  storage: SettingsStorageLike,
  key: string,
  serialized: string,
):
  Readonly<{ ok: true }> | Readonly<{ ok: false; error: ProfileStorageError }> {
  try {
    storage.setItem(key, serialized);
    if (storage.getItem(key) !== serialized) {
      throw new Error("Settings verification failed");
    }
    return { ok: true };
  } catch {
    return {
      ok: false,
      error: error("write-failed", "Browser settings could not be stored"),
    };
  }
}

/** Browser adapter for the independent versioned settings record. */
export function createBrowserSettingsStore(
  storage: SettingsStorageLike,
  key: string = SETTINGS_STORAGE_KEY,
): SettingsStore {
  return Object.freeze({
    load(): SettingsLoadResult {
      const result = read(storage, key);
      if (!result.ok) {
        return failed(result.error);
      }
      if (result.raw === null) {
        return Object.freeze({
          status: "empty" as const,
          settings: createDefaultSettings(),
        });
      }
      const decoded = decode(result.raw);
      if (!decoded.ok) {
        return failed(decoded.error);
      }
      return Object.freeze({
        status: "loaded" as const,
        settings: decoded.settings,
      });
    },

    save(input: BrowserSettings): SettingsSaveResult {
      let settings: BrowserSettings;
      try {
        settings = normalizeSettings(input);
      } catch {
        return Object.freeze({
          status: "failed" as const,
          error: error("invalid-record", "Browser settings are invalid"),
        });
      }

      const existing = read(storage, key);
      if (!existing.ok) {
        return Object.freeze({
          status: "failed" as const,
          error: existing.error,
        });
      }
      if (existing.raw !== null) {
        const decoded = decode(existing.raw);
        if (!decoded.ok) {
          return Object.freeze({
            status: "failed" as const,
            error: decoded.error,
          });
        }
      }

      const serialized = serialize(settings);
      if (typeof serialized !== "string") {
        return Object.freeze({ status: "failed" as const, error: serialized });
      }
      const writeResult = writeSettings(storage, key, serialized);
      if (!writeResult.ok) {
        return Object.freeze({
          status: "failed" as const,
          error: writeResult.error,
        });
      }
      return Object.freeze({ status: "saved" as const, settings });
    },
  });
}
