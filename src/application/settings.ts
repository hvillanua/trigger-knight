import type { ProfileStorageError } from "./persistence.js";

export const SETTINGS_SCHEMA_VERSION = 1 as const;

/** Device-independent browser bindings persisted outside gameplay state. */
export interface InputBindings {
  readonly togglePause: string;
  readonly dismissTutorial: string;
  readonly purchaseCurrentEncounter: string;
  readonly useCarriedItem: string;
}

/** Sound presentation preferences persisted outside gameplay state. */
export interface SoundPreferences {
  readonly muted: boolean;
  /** Master volume, normalized to the inclusive range 0–1. */
  readonly volume: number;
}

/** Versioned settings record shared by browser input and sound adapters. */
export interface BrowserSettings {
  readonly schemaVersion: typeof SETTINGS_SCHEMA_VERSION;
  readonly bindings: InputBindings;
  readonly sound: SoundPreferences;
}

export type SettingsLoadResult =
  | Readonly<{
      status: "empty";
      settings: BrowserSettings;
    }>
  | Readonly<{
      status: "loaded";
      settings: BrowserSettings;
    }>
  | Readonly<{
      status: "failed";
      error: ProfileStorageError;
    }>;

export type SettingsSaveResult =
  | Readonly<{
      status: "saved";
      settings: BrowserSettings;
    }>
  | Readonly<{
      status: "failed";
      error: ProfileStorageError;
    }>;

/** Application boundary for browser-only settings. */
export interface SettingsStore {
  load(): SettingsLoadResult;
  save(settings: BrowserSettings): SettingsSaveResult;
}

export const DEFAULT_INPUT_BINDINGS: InputBindings = Object.freeze({
  togglePause: "KeyP",
  dismissTutorial: "Enter",
  purchaseCurrentEncounter: "KeyB",
  useCarriedItem: "KeyI",
});

/** Creates an independent copy of the supported browser defaults. */
export function createDefaultSettings(): BrowserSettings {
  return Object.freeze({
    schemaVersion: SETTINGS_SCHEMA_VERSION,
    bindings: Object.freeze({ ...DEFAULT_INPUT_BINDINGS }),
    sound: Object.freeze({ muted: false, volume: 1 }),
  });
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

function binding(value: unknown, field: string): string {
  if (typeof value !== "string" || !/^[A-Za-z][A-Za-z0-9]*$/u.test(value)) {
    throw new TypeError(`Settings ${field} must be a supported keyboard code`);
  }
  return value;
}

function volume(value: unknown): number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < 0 ||
    value > 1
  ) {
    throw new TypeError("Settings sound volume must be between 0 and 1");
  }
  return value === 0 ? 0 : value;
}

/** Validates and deeply copies an explicit settings record. */
export function normalizeSettings(input: unknown): BrowserSettings {
  if (!isPlainRecord(input)) {
    throw new TypeError("Settings must be a plain record");
  }
  if (typeof input.schemaVersion !== "number") {
    throw new TypeError("Settings schemaVersion must be a number");
  }
  if (input.schemaVersion !== SETTINGS_SCHEMA_VERSION) {
    throw new TypeError("Unsupported settings schemaVersion");
  }
  if (
    !hasExactKeys(input, ["schemaVersion", "bindings", "sound"]) ||
    !isPlainRecord(input.bindings) ||
    !isPlainRecord(input.sound)
  ) {
    throw new TypeError("Settings contains unsupported fields");
  }

  const bindings = input.bindings;
  const sound = input.sound;
  if (
    !hasExactKeys(bindings, [
      "togglePause",
      "dismissTutorial",
      "purchaseCurrentEncounter",
      "useCarriedItem",
    ]) ||
    !hasExactKeys(sound, ["muted", "volume"])
  ) {
    throw new TypeError("Settings contains unsupported fields");
  }
  if (typeof sound.muted !== "boolean") {
    throw new TypeError("Settings sound muted must be boolean");
  }

  return Object.freeze({
    schemaVersion: SETTINGS_SCHEMA_VERSION,
    bindings: Object.freeze({
      togglePause: binding(bindings.togglePause, "togglePause"),
      dismissTutorial: binding(bindings.dismissTutorial, "dismissTutorial"),
      purchaseCurrentEncounter: binding(
        bindings.purchaseCurrentEncounter,
        "purchaseCurrentEncounter",
      ),
      useCarriedItem: binding(bindings.useCarriedItem, "useCarriedItem"),
    }),
    sound: Object.freeze({ muted: sound.muted, volume: volume(sound.volume) }),
  });
}
