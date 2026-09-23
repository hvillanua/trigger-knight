import { describe, expect, it } from "vitest";

import {
  normalizeProfileInput,
  normalizeRunConfig,
} from "../../src/application/run-config.js";

describe("run configuration boundaries", () => {
  it("preserves profile variants and startup option presence", () => {
    const minimal = {
      schemaVersion: 1,
      scoreMultiplier: 1.25,
    } as const;
    const base = {
      ruleset: "original-v1.3",
      seed: "boundary",
      initialProfile: minimal,
    };

    const omitted = normalizeRunConfig(base);
    const explicitFalse = normalizeRunConfig({
      ...base,
      startImmediately: false,
    });

    expect(omitted.initialProfile).toEqual(minimal);
    expect(Object.hasOwn(omitted, "startImmediately")).toBe(false);
    expect(Object.hasOwn(explicitFalse, "startImmediately")).toBe(true);
    expect(explicitFalse.startImmediately).toBe(false);

    const expanded = normalizeProfileInput({
      schemaVersion: 2,
      level: 1,
      xp: 0,
      scoreMultiplier: 1,
      highScore: 0,
      tutorialPreference: "enabled",
      weaponDiscoveries: [
        true,
        false,
        false,
        false,
        false,
        false,
        false,
        false,
        false,
        false,
      ],
      armorDiscoveries: [
        true,
        false,
        false,
        false,
        false,
        false,
        false,
        false,
        false,
        false,
      ],
      achievementSlots: [false, false, false, false, false, false],
    });
    expect(expanded.schemaVersion).toBe(2);
    expect(expanded).toHaveProperty("weaponDiscoveries");
  });

  it("copies and freezes accepted configuration at the boundary", () => {
    const initialProfile = { schemaVersion: 1 as const, scoreMultiplier: 1 };
    const input = {
      ruleset: "original-v1.3",
      seed: "copy",
      initialProfile,
    };

    const normalized = normalizeRunConfig(input);
    initialProfile.scoreMultiplier = 2;

    expect(normalized.initialProfile).toEqual({
      schemaVersion: 1,
      scoreMultiplier: 1,
    });
    expect(Object.isFrozen(normalized)).toBe(true);
    expect(Object.isFrozen(normalized.initialProfile)).toBe(true);
  });

  it.each([
    {
      name: "a missing seed",
      input: {
        ruleset: "original-v1.3",
        initialProfile: { schemaVersion: 1, scoreMultiplier: 1 },
      },
    },
    {
      name: "an unknown field",
      input: {
        ruleset: "original-v1.3",
        seed: "invalid",
        initialProfile: { schemaVersion: 1, scoreMultiplier: 1 },
        extra: true,
      },
    },
    {
      name: "a non-boolean startup option",
      input: {
        ruleset: "original-v1.3",
        seed: "invalid",
        initialProfile: { schemaVersion: 1, scoreMultiplier: 1 },
        startImmediately: "yes",
      },
    },
  ])("rejects $name", ({ input }) => {
    expect(() => normalizeRunConfig(input)).toThrow();
  });
});
