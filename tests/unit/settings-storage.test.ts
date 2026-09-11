import { describe, expect, it } from "vitest";

import {
  createDefaultSettings,
  normalizeSettings,
} from "../../src/application/settings.js";
import { createFreshProfile } from "../../src/domain/profile.js";
import {
  createBrowserSettingsStore,
  SETTINGS_STORAGE_KEY,
  SETTINGS_STORAGE_VERSION,
  type SettingsStorageLike,
} from "../../src/persistence/browser-settings-store.js";
import {
  createBrowserProfileStore,
  PROFILE_STORAGE_KEY,
  type StorageLike,
} from "../../src/persistence/browser-profile-store.js";

class MemoryStorage implements SettingsStorageLike, StorageLike {
  readonly #values = new Map<string, string>();
  failNextRead = false;
  failNextWrite = false;

  getItem(key: string): string | null {
    if (this.failNextRead) {
      this.failNextRead = false;
      throw new Error("simulated read failure");
    }
    return this.#values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    if (this.failNextWrite) {
      this.failNextWrite = false;
      throw new Error("simulated write failure");
    }
    this.#values.set(key, value);
  }

  removeItem(key: string): void {
    this.#values.delete(key);
  }
}

describe("versioned browser settings storage", () => {
  it("returns independent defaults when settings are missing", () => {
    const store = createBrowserSettingsStore(new MemoryStorage());

    expect(store.load()).toEqual({
      status: "empty",
      settings: createDefaultSettings(),
    });
  });

  it("round-trips validated bindings and sound preferences", () => {
    const storage = new MemoryStorage();
    const store = createBrowserSettingsStore(storage);
    const settings = normalizeSettings({
      schemaVersion: SETTINGS_STORAGE_VERSION,
      bindings: {
        togglePause: "KeyP",
        dismissTutorial: "Space",
        purchaseCurrentEncounter: "KeyB",
        useCarriedItem: "KeyI",
      },
      sound: { muted: true, volume: 0.35 },
    });

    expect(store.save(settings)).toEqual({ status: "saved", settings });
    expect(store.load()).toEqual({ status: "loaded", settings });
    expect(JSON.parse(storage.getItem(SETTINGS_STORAGE_KEY) as string)).toEqual(
      settings,
    );
  });

  it.each([
    ["unsupported-version", { schemaVersion: 99 }],
    ["invalid-record", {}],
    [
      "invalid-record",
      {
        schemaVersion: SETTINGS_STORAGE_VERSION,
        bindings: {
          ...createDefaultSettings().bindings,
          togglePause: "NotARealKey",
        },
        sound: createDefaultSettings().sound,
      },
    ],
    [
      "invalid-record",
      {
        schemaVersion: SETTINGS_STORAGE_VERSION,
        bindings: createDefaultSettings().bindings,
        sound: { muted: false, volume: 2 },
      },
    ],
  ] as const)("rejects %s records without replacing them", (code, value) => {
    const storage = new MemoryStorage();
    const store = createBrowserSettingsStore(storage);
    const raw = JSON.stringify(value);
    storage.setItem(SETTINGS_STORAGE_KEY, raw);

    expect(store.load()).toMatchObject({ status: "failed", error: { code } });
    expect(storage.getItem(SETTINGS_STORAGE_KEY)).toBe(raw);
  });

  it("rejects unsupported bindings when saving", () => {
    const storage = new MemoryStorage();
    const store = createBrowserSettingsStore(storage);
    const existing = createDefaultSettings();
    store.save(existing);

    const result = store.save({
      ...existing,
      bindings: { ...existing.bindings, togglePause: "NotARealKey" },
    });

    expect(result).toMatchObject({
      status: "failed",
      error: { code: "invalid-record" },
    });
    expect(store.load()).toEqual({ status: "loaded", settings: existing });
  });

  it("reports read and write failures while leaving defaults available", () => {
    const storage = new MemoryStorage();
    const store = createBrowserSettingsStore(storage);
    storage.failNextRead = true;

    expect(store.load()).toMatchObject({
      status: "failed",
      error: { code: "storage-read-failed" },
    });

    storage.failNextWrite = true;
    expect(store.save(createDefaultSettings())).toMatchObject({
      status: "failed",
      error: { code: "write-failed" },
    });
  });

  it("uses a separate record from progression commits", () => {
    const storage = new MemoryStorage();
    const settingsStore = createBrowserSettingsStore(storage);
    const profileStore = createBrowserProfileStore(storage);
    const profile = createFreshProfile();

    settingsStore.save({
      ...createDefaultSettings(),
      sound: { muted: true, volume: 0.2 },
    });
    profileStore.save(profile);

    expect(settingsStore.load()).toMatchObject({
      status: "loaded",
      settings: { sound: { muted: true, volume: 0.2 } },
    });
    expect(profileStore.load()).toMatchObject({ status: "loaded", profile });
    expect(storage.getItem(PROFILE_STORAGE_KEY)).not.toBe(
      storage.getItem(SETTINGS_STORAGE_KEY),
    );
  });

  it("does not accept a profile-shaped object as settings", () => {
    expect(() => normalizeSettings(createFreshProfile())).toThrow(
      "Unsupported settings schemaVersion",
    );
  });
});
