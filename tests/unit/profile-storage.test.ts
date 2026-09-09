import { describe, expect, it } from "vitest";

import {
  createFreshProfile,
  normalizeProfile,
} from "../../src/domain/profile.js";
import { ORIGINAL_V13_RULESET_ID } from "../../src/domain/rulesets.js";
import { createTestGameplayEngine } from "../helpers/gameplay-engine.js";
import {
  createBrowserProfileStore,
  PROFILE_STORAGE_ENVELOPE_VERSION,
  PROFILE_STORAGE_KEY,
  PROFILE_STORAGE_LEGACY_ENVELOPE_VERSION,
  type StorageLike,
} from "../../src/persistence/browser-profile-store.js";
import type { ProfileState } from "../../src/application/contracts.js";

class MemoryStorage implements StorageLike {
  readonly #values = new Map<string, string>();
  readonly #writeCalls = new Map<string, number>();
  failNextWriteAfterCommitKey: string | undefined;
  failNextWriteBeforeCommitKey: string | undefined;
  failVerificationAfterWriteKey: string | undefined;
  failVerificationAfterWriteOnCall:
    { readonly key: string; readonly call: number } | undefined;
  failNextReadKey: string | undefined;
  failAfterWriteOnCall:
    { readonly key: string; readonly call: number } | undefined;

  getItem(key: string): string | null {
    if (this.failNextReadKey === key) {
      this.failNextReadKey = undefined;
      throw new Error("simulated read failure");
    }
    return this.#values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    if (this.failNextWriteBeforeCommitKey === key) {
      this.failNextWriteBeforeCommitKey = undefined;
      throw new Error("simulated write failure");
    }
    this.#values.set(key, value);
    const call = (this.#writeCalls.get(key) ?? 0) + 1;
    this.#writeCalls.set(key, call);
    if (this.failVerificationAfterWriteKey === key) {
      this.failVerificationAfterWriteKey = undefined;
      this.failNextReadKey = key;
    }
    if (
      this.failVerificationAfterWriteOnCall?.key === key &&
      this.failVerificationAfterWriteOnCall.call === call
    ) {
      this.failVerificationAfterWriteOnCall = undefined;
      this.failNextReadKey = key;
    }
    if (this.failNextWriteAfterCommitKey === key) {
      this.failNextWriteAfterCommitKey = undefined;
      this.failNextWriteBeforeCommitKey = key;
      throw new Error("simulated write failure");
    }
    if (
      this.failAfterWriteOnCall?.key === key &&
      this.failAfterWriteOnCall.call === call
    ) {
      this.failAfterWriteOnCall = undefined;
      this.failNextWriteBeforeCommitKey = key;
      throw new Error("simulated write failure");
    }
  }

  resetWriteCalls(): void {
    this.#writeCalls.clear();
  }

  removeItem(key: string): void {
    this.#values.delete(key);
  }
}

function profileWith(patch: Partial<ProfileState> = {}): ProfileState {
  return normalizeProfile({ ...createFreshProfile(), ...patch });
}

describe("versioned browser profile storage", () => {
  it("loads an independent fresh profile when storage is empty", () => {
    const store = createBrowserProfileStore(new MemoryStorage());

    const result = store.load();

    expect(result).toEqual({
      status: "empty",
      profile: createFreshProfile(),
    });
  });

  it("round-trips the complete profile and supported tutorial setting", () => {
    const storage = new MemoryStorage();
    const store = createBrowserProfileStore(storage);
    const profile = profileWith({
      level: 4,
      xp: 87,
      scoreMultiplier: 1.4,
      highScore: 12_345.5,
      tutorialPreference: "disabled",
      weaponDiscoveries: [
        true,
        true,
        true,
        false,
        false,
        false,
        false,
        false,
        false,
        false,
      ],
    });

    expect(store.save(profile)).toEqual({ status: "saved", profile });

    const raw = storage.getItem(PROFILE_STORAGE_KEY);
    expect(raw).not.toBeNull();
    const envelope = JSON.parse(raw as string) as Record<string, unknown>;
    expect(envelope).toMatchObject({
      schemaVersion: PROFILE_STORAGE_ENVELOPE_VERSION,
      settings: { tutorialPreference: "disabled" },
    });
    expect(envelope.profile).not.toHaveProperty("tutorialPreference");
    expect(store.load()).toEqual({
      status: "loaded",
      profile,
      migrated: false,
    });
  });

  it("migrates a prior storage envelope without treating it as a minimal run input", () => {
    const storage = new MemoryStorage();
    const store = createBrowserProfileStore(storage);
    const profile = profileWith({ tutorialPreference: "disabled" });
    storage.setItem(
      PROFILE_STORAGE_KEY,
      JSON.stringify({
        schemaVersion: PROFILE_STORAGE_LEGACY_ENVELOPE_VERSION,
        profile,
      }),
    );

    expect(store.load()).toEqual({
      status: "loaded",
      profile,
      migrated: true,
    });
    expect(
      JSON.parse(storage.getItem(PROFILE_STORAGE_KEY) as string),
    ).toMatchObject({
      schemaVersion: PROFILE_STORAGE_ENVELOPE_VERSION,
      settings: { tutorialPreference: "disabled" },
    });
  });

  it("rejects a minimal RunConfig shape inside a storage envelope", () => {
    const storage = new MemoryStorage();
    const store = createBrowserProfileStore(storage);
    const raw = JSON.stringify({
      schemaVersion: PROFILE_STORAGE_LEGACY_ENVELOPE_VERSION,
      profile: { schemaVersion: 1, scoreMultiplier: 2 },
    });
    storage.setItem(PROFILE_STORAGE_KEY, raw);

    expect(store.load()).toMatchObject({
      status: "failed",
      error: { code: "invalid-record" },
    });
    expect(storage.getItem(PROFILE_STORAGE_KEY)).toBe(raw);
  });

  it.each([
    { name: "corrupt JSON", raw: "{", code: "corrupt-record" },
    {
      name: "unsupported envelope version",
      raw: JSON.stringify({ schemaVersion: 99 }),
      code: "unsupported-version",
    },
    {
      name: "invalid current record",
      raw: JSON.stringify({
        schemaVersion: PROFILE_STORAGE_ENVELOPE_VERSION,
        profile: {},
        settings: { tutorialPreference: "enabled" },
      }),
      code: "invalid-record",
    },
  ])("reports $name without replacing the stored record", ({ raw, code }) => {
    const storage = new MemoryStorage();
    const store = createBrowserProfileStore(storage);
    storage.setItem(PROFILE_STORAGE_KEY, raw);

    expect(store.load()).toMatchObject({ status: "failed", error: { code } });
    expect(storage.getItem(PROFILE_STORAGE_KEY)).toBe(raw);
  });

  it("restores the prior committed record when a write fails after mutation", () => {
    const storage = new MemoryStorage();
    const store = createBrowserProfileStore(storage);
    const previous = profileWith({ highScore: 200 });
    const next = profileWith({ highScore: 500 });
    store.save(previous);
    storage.failNextWriteAfterCommitKey = PROFILE_STORAGE_KEY;

    expect(store.save(next)).toMatchObject({
      status: "failed",
      error: { code: "write-failed" },
    });
    storage.failNextWriteBeforeCommitKey = undefined;
    expect(store.load()).toEqual({
      status: "loaded",
      profile: previous,
      migrated: false,
    });
  });

  it("keeps the prior committed profile when verification cannot read a new record", () => {
    const storage = new MemoryStorage();
    const store = createBrowserProfileStore(storage);
    const previous = profileWith({ highScore: 200 });
    const next = profileWith({ highScore: 500 });
    store.save(previous);
    storage.failVerificationAfterWriteKey = PROFILE_STORAGE_KEY;

    expect(store.save(next)).toMatchObject({
      status: "failed",
      error: { code: "write-failed" },
    });
    expect(store.load()).toEqual({
      status: "loaded",
      profile: previous,
      migrated: false,
    });
  });

  it("does not treat an uncommitted first write as committed data", () => {
    const storage = new MemoryStorage();
    const store = createBrowserProfileStore(storage);
    storage.failNextWriteAfterCommitKey = PROFILE_STORAGE_KEY;

    expect(store.save(createFreshProfile())).toMatchObject({
      status: "failed",
      error: { code: "write-failed" },
    });
    storage.failNextWriteBeforeCommitKey = undefined;
    const primaryRaw = storage.getItem(PROFILE_STORAGE_KEY);
    const backupRaw = storage.getItem(`${PROFILE_STORAGE_KEY}.backup`);
    const markerRaw = storage.getItem(`${PROFILE_STORAGE_KEY}.commit`);
    expect(store.load()).toMatchObject({
      status: "failed",
      error: { code: "invalid-record" },
    });
    expect(store.save(profileWith({ highScore: 1 }))).toMatchObject({
      status: "failed",
      error: { code: "invalid-record" },
    });
    expect(storage.getItem(PROFILE_STORAGE_KEY)).toBe(primaryRaw);
    expect(storage.getItem(`${PROFILE_STORAGE_KEY}.backup`)).toBe(backupRaw);
    expect(storage.getItem(`${PROFILE_STORAGE_KEY}.commit`)).toBe(markerRaw);
  });

  it.each([
    { name: "corrupt JSON", raw: "{", code: "corrupt-record" },
    {
      name: "unsupported envelope",
      raw: JSON.stringify({ schemaVersion: 99 }),
      code: "unsupported-version",
    },
  ])("does not save over a rejected $name", ({ raw, code }) => {
    const storage = new MemoryStorage();
    const store = createBrowserProfileStore(storage);
    storage.setItem(PROFILE_STORAGE_KEY, raw);

    expect(store.save(createFreshProfile())).toMatchObject({
      status: "failed",
      error: { code },
    });
    expect(storage.getItem(PROFILE_STORAGE_KEY)).toBe(raw);
  });

  it.each([
    { name: "corrupt JSON", raw: "{", code: "corrupt-record" },
    {
      name: "unsupported envelope",
      raw: JSON.stringify({ schemaVersion: 99 }),
      code: "unsupported-version",
    },
    {
      name: "incomplete envelope",
      raw: JSON.stringify({
        schemaVersion: PROFILE_STORAGE_ENVELOPE_VERSION,
        profile: {},
        settings: { tutorialPreference: "enabled" },
      }),
      code: "invalid-record",
    },
  ])(
    "does not recover over rejected $name when a backup exists",
    ({ raw, code }) => {
      const storage = new MemoryStorage();
      const store = createBrowserProfileStore(storage);
      store.save(profileWith({ highScore: 200 }));
      store.save(profileWith({ highScore: 500 }));
      const backupRaw = storage.getItem(`${PROFILE_STORAGE_KEY}.backup`);
      const markerRaw = storage.getItem(`${PROFILE_STORAGE_KEY}.commit`);
      storage.setItem(PROFILE_STORAGE_KEY, raw);

      expect(store.load()).toMatchObject({
        status: "failed",
        error: { code },
      });
      expect(storage.getItem(PROFILE_STORAGE_KEY)).toBe(raw);
      expect(storage.getItem(`${PROFILE_STORAGE_KEY}.backup`)).toBe(backupRaw);
      expect(storage.getItem(`${PROFILE_STORAGE_KEY}.commit`)).toBe(markerRaw);
    },
  );

  it("does not erase a surviving backup from an empty journal", () => {
    const storage = new MemoryStorage();
    const store = createBrowserProfileStore(storage);
    store.save(profileWith({ highScore: 200 }));
    store.save(profileWith({ highScore: 300 }));
    const backupRaw = storage.getItem(`${PROFILE_STORAGE_KEY}.backup`);
    storage.removeItem(PROFILE_STORAGE_KEY);
    storage.setItem(
      `${PROFILE_STORAGE_KEY}.commit`,
      "trigger-knight.commit.v1:empty",
    );

    expect(store.save(profileWith({ highScore: 500 }))).toMatchObject({
      status: "failed",
      error: { code: "invalid-record" },
    });
    expect(storage.getItem(PROFILE_STORAGE_KEY)).toBeNull();
    expect(storage.getItem(`${PROFILE_STORAGE_KEY}.backup`)).toBe(backupRaw);
    expect(storage.getItem(`${PROFILE_STORAGE_KEY}.commit`)).toBe(
      "trigger-knight.commit.v1:empty",
    );
  });

  it("reports a final marker failure as saved when the new marker is durable", () => {
    const storage = new MemoryStorage();
    const store = createBrowserProfileStore(storage);
    store.save(profileWith({ highScore: 200 }));
    storage.resetWriteCalls();
    storage.failAfterWriteOnCall = {
      key: `${PROFILE_STORAGE_KEY}.commit`,
      call: 2,
    };

    expect(store.save(profileWith({ highScore: 500 }))).toMatchObject({
      status: "saved",
      profile: { highScore: 500 },
    });
    expect(store.load()).toMatchObject({
      status: "loaded",
      profile: { highScore: 500 },
      migrated: false,
    });
  });

  it("reports an uncertain outcome when marker readback and rollback both fail", () => {
    const storage = new MemoryStorage();
    const store = createBrowserProfileStore(storage);
    store.save(profileWith({ highScore: 200 }));
    storage.resetWriteCalls();
    storage.failAfterWriteOnCall = {
      key: `${PROFILE_STORAGE_KEY}.commit`,
      call: 2,
    };
    storage.failVerificationAfterWriteOnCall = {
      key: `${PROFILE_STORAGE_KEY}.commit`,
      call: 2,
    };

    expect(store.save(profileWith({ highScore: 500 }))).toMatchObject({
      status: "uncertain",
      error: { code: "write-outcome-unknown" },
    });
    storage.failNextWriteBeforeCommitKey = undefined;
    expect(store.load()).toMatchObject({
      status: "loaded",
      profile: { highScore: 500 },
      migrated: false,
    });
  });

  it("does not change gameplay when a complete profile crosses the storage boundary", () => {
    const storage = new MemoryStorage();
    const store = createBrowserProfileStore(storage);
    const profile = profileWith({
      level: 3,
      xp: 91,
      scoreMultiplier: 1.3,
      highScore: 400,
      tutorialPreference: "disabled",
    });
    store.save(profile);
    const loaded = store.load();
    if (loaded.status !== "loaded") {
      throw new Error("Expected the stored profile to load");
    }

    const engine = createTestGameplayEngine();
    const config = {
      ruleset: ORIGINAL_V13_RULESET_ID,
      seed: "storage-boundary",
    };
    const direct = engine.createRun({ ...config, initialProfile: profile });
    const roundTripped = engine.createRun({
      ...config,
      initialProfile: loaded.profile,
    });

    expect(roundTripped).toEqual(direct);
    expect(engine.step(roundTripped, [{ type: "dismiss-tutorial" }])).toEqual(
      engine.step(direct, [{ type: "dismiss-tutorial" }]),
    );
  });
});
