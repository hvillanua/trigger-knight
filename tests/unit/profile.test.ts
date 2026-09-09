import { describe, expect, it } from "vitest";
import {
  createFreshProfile,
  normalizeProfile,
} from "../../src/domain/profile.js";
import { createTestGameplayEngine } from "../helpers/gameplay-engine.js";
import { createSimulationRunner } from "../../src/simulation/simulation-runner.js";
import { nonProgressingPolicy } from "../../src/simulation/non-progressing-policy.js";

const gameplayEngine = createTestGameplayEngine();
const config = { ruleset: "original-v1.3", seed: "profile" };

describe("versioned profiles", () => {
  it("creates researched fresh progression with an independent stored multiplier", () => {
    expect(createFreshProfile()).toEqual({
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
    expect(
      normalizeProfile({
        ...createFreshProfile(),
        level: 12,
        scoreMultiplier: 1.75,
      }).scoreMultiplier,
    ).toBe(1.75);
  });

  it("expands minimal inputs without reconstructing historical progress", () => {
    expect(
      normalizeProfile({ schemaVersion: 1, scoreMultiplier: 2.5 }),
    ).toEqual({ ...createFreshProfile(), scoreMultiplier: 2.5 });
    expect(
      normalizeProfile({
        schemaVersion: 1,
        scoreMultiplier: 1,
        tutorialPreference: "disabled",
      }).tutorialPreference,
    ).toBe("disabled");
  });

  it("copies and freezes nested progress without changing the supplied profile", () => {
    const input = JSON.parse(
      JSON.stringify(createFreshProfile()),
    ) as ReturnType<typeof createFreshProfile>;
    const before = JSON.stringify(input);
    const normalized = normalizeProfile(input);
    expect(normalized).toEqual(input);
    expect(normalized).not.toBe(input);
    for (const key of [
      "weaponDiscoveries",
      "armorDiscoveries",
      "achievementSlots",
    ] as const) {
      expect(normalized[key]).not.toBe(input[key]);
      expect(Object.isFrozen(normalized[key])).toBe(true);
    }
    expect(Object.isFrozen(normalized)).toBe(true);
    expect(normalizeProfile(JSON.parse(JSON.stringify(normalized)))).toEqual(
      normalized,
    );
    gameplayEngine.createRun({ ...config, initialProfile: input });
    expect(JSON.stringify(input)).toBe(before);
  });

  const invalid = [
    null,
    [],
    {},
    { schemaVersion: 3, scoreMultiplier: 1 },
    ...[0, -1, Infinity, NaN, "1"].map((scoreMultiplier) => ({
      schemaVersion: 1,
      scoreMultiplier,
    })),
    { schemaVersion: 1, scoreMultiplier: 1, level: 9 },
    ...[
      { level: 0 },
      { level: 1.5 },
      { level: Number.MAX_SAFE_INTEGER + 1 },
      { xp: -1 },
      { xp: 0.5 },
      { highScore: Infinity },
      { highScore: -1 },
      { tutorialPreference: "maybe" },
      { weaponDiscoveries: [true] },
      { armorDiscoveries: Array(10).fill(0) },
      { achievementSlots: Array(5).fill(false) },
      { achievementSlots: new Array(6) },
      { extra: true },
    ].map((patch) => ({ ...createFreshProfile(), ...patch })),
  ];
  it.each(invalid)("rejects malformed or unsupported input %j", (input) => {
    expect(() => normalizeProfile(input)).toThrow();
    expect(() =>
      gameplayEngine.createRun({
        ...config,
        initialProfile: input as ReturnType<typeof createFreshProfile>,
      }),
    ).toThrow();
  });

  it("retains all progress in fingerprints and reproduces equivalent inputs", () => {
    const runner = createSimulationRunner(gameplayEngine);
    const run = (initialProfile: ReturnType<typeof createFreshProfile>) =>
      runner.run({
        config: { ...config, initialProfile },
        policy: nonProgressingPolicy,
        maxSteps: 2,
      });
    const initial = createFreshProfile();
    const baseline = run(initial);
    expect(
      run(
        Object.fromEntries(
          Object.entries(initial).reverse(),
        ) as unknown as typeof initial,
      ),
    ).toEqual(baseline);
    const variants = [
      { level: 2 },
      { xp: 130 },
      { scoreMultiplier: 1.1 },
      { highScore: 0.5 },
      { tutorialPreference: "disabled" as const },
      ...(
        ["weaponDiscoveries", "armorDiscoveries", "achievementSlots"] as const
      ).flatMap((key) =>
        initial[key].map((value, index) => ({
          [key]: initial[key].map((entry, slot) =>
            slot === index ? !value : entry,
          ),
        })),
      ),
    ];
    const fingerprints = variants.map(
      (patch) => run({ ...initial, ...patch }).initialProfileFingerprint,
    );
    expect(
      new Set([baseline.initialProfileFingerprint, ...fingerprints]).size,
    ).toBe(variants.length + 1);
  });

  it("produces identical gameplay from minimal and expanded explicit inputs", () => {
    const minimal = {
      schemaVersion: 1,
      scoreMultiplier: 1.75,
      tutorialPreference: "disabled" as const,
    };
    const first = gameplayEngine.createRun({
      ...config,
      initialProfile: minimal,
    });
    const second = gameplayEngine.createRun({
      ...config,
      initialProfile: normalizeProfile(minimal),
    });
    expect(second).toEqual(first);
    expect(gameplayEngine.step(second, [{ type: "dismiss-tutorial" }])).toEqual(
      gameplayEngine.step(first, [{ type: "dismiss-tutorial" }]),
    );
  });
});
