import { describe, expect, it } from "vitest";

import type {
  CompletedRunSettlementInput,
  CombatActorState,
  GameplayTrace,
  ProfileState,
  RunConfig,
  RunState,
  RunTerminalReason,
} from "../../src/application/contracts.js";
import {
  createCompletedRunCoordinator,
  completedRunSettlementFromState,
} from "../../src/application/completed-run.js";
import type { ProfileStore } from "../../src/application/persistence.js";
import {
  createFreshProfile,
  calculateProfileProgress,
  normalizeProfile,
} from "../../src/domain/profile.js";
import { ORIGINAL_V13_RULESET_ID } from "../../src/domain/rulesets.js";
import {
  createBrowserProfileStore,
  PROFILE_STORAGE_ENVELOPE_VERSION,
  PROFILE_STORAGE_KEY,
  PROFILE_STORAGE_PREVIOUS_ENVELOPE_VERSION,
  type StorageLike,
} from "../../src/persistence/browser-profile-store.js";
import { nonProgressingPolicy } from "../../src/simulation/non-progressing-policy.js";
import { createSimulationRunner } from "../../src/simulation/simulation-runner.js";
import { createTestGameplayEngine } from "../helpers/gameplay-engine.js";

const engine = createTestGameplayEngine();

class ScenarioStorage implements StorageLike {
  readonly #values = new Map<string, string>();
  failNextPrimaryWrite = false;

  getItem(key: string): string | null {
    return this.#values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    if (key === PROFILE_STORAGE_KEY && this.failNextPrimaryWrite) {
      this.failNextPrimaryWrite = false;
      throw new Error("simulated completed-run write failure");
    }
    this.#values.set(key, value);
  }

  removeItem(key: string): void {
    this.#values.delete(key);
  }
}

function profileWith(patch: Partial<ProfileState> = {}): ProfileState {
  return normalizeProfile({ ...createFreshProfile(), ...patch });
}

function previousEnvelope(profile: ProfileState): Record<string, unknown> {
  return {
    schemaVersion: PROFILE_STORAGE_PREVIOUS_ENVELOPE_VERSION,
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
    settings: { tutorialPreference: profile.tutorialPreference },
  };
}

function deadActor(
  x: number,
  overrides: Partial<CombatActorState> = {},
): CombatActorState {
  return {
    phase: "dead",
    x,
    attackDelay: 0,
    attackFactor: 1,
    attackCount: 0,
    alpha: 10,
    attackTicks: 0,
    knockback: 0,
    ...overrides,
  };
}

interface TerminalRunPatch {
  readonly score: number;
  readonly profileExpEarned: number;
  readonly weaponDiscoveries?: readonly boolean[];
  readonly armorDiscoveries?: readonly boolean[];
  readonly achievementSlots?: readonly boolean[];
}

/** Derived scenario fixtures. They do not claim to recover Flash RNG seeds. */
function terminalRun(
  initialProfile: ProfileState,
  seed: string,
  terminalReason: RunTerminalReason,
  patch: TerminalRunPatch,
): RunState {
  const config: RunConfig = {
    ruleset: ORIGINAL_V13_RULESET_ID,
    seed,
    initialProfile,
  };
  const active = engine.createRun(config);
  const preTerminal: RunState =
    terminalReason === "lifespan"
      ? {
          ...active,
          lifecycle: {
            ...active.lifecycle,
            tutorialPage: null,
            pregameStepsRemaining: 0,
          },
          lifespan: { whole: 0, fraction: 1 },
          encounters: {
            ...active.encounters,
            current: null,
            distanceUntilNext: 100_000,
          },
        }
      : {
          ...active,
          lifecycle: {
            ...active.lifecycle,
            phase: "battling",
            tutorialPage: null,
            pregameStepsRemaining: 0,
          },
          encounters: {
            ...active.encounters,
            current: {
              kind: "battle",
              x: 400,
              enemy: {
                id: "goblin",
                maximumHp: 600,
                attack: 82,
                goldReward: 70,
                profileExp: 10,
              },
            },
          },
          battle: {
            enemyHp: 1,
            enemyGoldMultiplier: 1,
            hero: deadActor(50),
            enemy: {
              ...deadActor(400),
              phase: "idle",
            },
          },
        };
  const stepped = engine.step(preTerminal, []).state;
  if (stepped.lifecycle.terminalReason !== terminalReason) {
    throw new Error(`Expected ${terminalReason} death scenario`);
  }

  return Object.freeze({
    ...stepped,
    score: patch.score,
    profileExpEarned: patch.profileExpEarned,
    weaponDiscoveries: Object.freeze([
      ...(patch.weaponDiscoveries ?? stepped.weaponDiscoveries),
    ]),
    armorDiscoveries: Object.freeze([
      ...(patch.armorDiscoveries ?? stepped.armorDiscoveries),
    ]),
    achievementSlots: Object.freeze([
      ...(patch.achievementSlots ?? stepped.achievementSlots),
    ]),
  });
}

function settlementFrom(
  initialProfile: ProfileState,
  seed: string,
  terminalReason: RunTerminalReason,
  patch: TerminalRunPatch,
): CompletedRunSettlementInput {
  const settlement = completedRunSettlementFromState(
    terminalRun(initialProfile, seed, terminalReason, patch),
  );
  if (settlement === undefined) {
    throw new Error("Expected a completed gameplay death");
  }
  return settlement;
}

function commit(
  store: ProfileStore,
  completionId: string,
  initialProfile: ProfileState,
  run: CompletedRunSettlementInput,
) {
  return createCompletedRunCoordinator(store).commit({
    completionId,
    initialProfile,
    run,
  });
}

describe("Milestone 5 progression and persistence scenarios", () => {
  it.each([
    {
      name: "clean lifespan death replaces the empty high score and levels up repeatedly",
      migrated: false,
      terminalReason: "lifespan" as const,
      seed: "m5-07-clean-lifespan",
      initial: createFreshProfile(),
      patch: { score: 500, profileExpEarned: 486 },
      expected: {
        level: 4,
        xp: 0,
        scoreMultiplier: 1.4,
        highScore: 500,
      },
    },
    {
      name: "migrated combat death retains the existing high score while crossing a level",
      migrated: true,
      terminalReason: "combat" as const,
      seed: "m5-07-migrated-combat",
      initial: profileWith({
        level: 2,
        xp: 159,
        scoreMultiplier: 1.2,
        highScore: 900,
        tutorialPreference: "disabled",
      }),
      patch: { score: 800, profileExpEarned: 4 },
      expected: {
        level: 3,
        xp: 1,
        scoreMultiplier: 1.3,
        highScore: 900,
      },
    },
  ])(
    "settles a deterministic $name",
    ({ migrated, terminalReason, seed, initial, patch, expected }) => {
      const storage = new ScenarioStorage();
      if (migrated) {
        storage.setItem(
          PROFILE_STORAGE_KEY,
          JSON.stringify(previousEnvelope(initial)),
        );
      }
      const store = createBrowserProfileStore(storage);
      const loaded = store.load();

      expect(loaded).toMatchObject({
        status: migrated ? "loaded" : "empty",
        profile: initial,
        ...(migrated ? { migrated: true } : {}),
      });
      if (loaded.status === "failed") {
        throw new Error("Expected the scenario profile to load");
      }

      const run = settlementFrom(loaded.profile, seed, terminalReason, patch);
      const result = commit(store, seed, loaded.profile, run);
      const expectedProfile = normalizeProfile({
        ...loaded.profile,
        ...expected,
        tutorialPreference: "disabled",
      });

      expect(result).toMatchObject({ status: "committed" });
      if (result.status !== "committed") {
        throw new Error("Expected the completed run to commit");
      }
      expect(result.profile).toEqual(expectedProfile);
      expect(result.result).toMatchObject({
        run: {
          terminalReason,
          score: patch.score,
          profileExpEarned: patch.profileExpEarned,
        },
        progression: {
          level: { before: loaded.profile.level, after: expected.level },
          xp: { before: loaded.profile.xp, after: expected.xp },
          scoreMultiplier: {
            before: loaded.profile.scoreMultiplier,
            after: expected.scoreMultiplier,
          },
          highScore: {
            before: loaded.profile.highScore,
            after: expected.highScore,
          },
        },
      });
      expect(store.load()).toMatchObject({
        status: "loaded",
        profile: expectedProfile,
      });
    },
  );

  it("accumulates collections and achievements across runs without duplicate completion awards", () => {
    const storage = new ScenarioStorage();
    const store = createBrowserProfileStore(storage);
    const initial = createFreshProfile();
    expect(store.save(initial)).toMatchObject({ status: "saved" });

    const firstRun = settlementFrom(initial, "m5-07-collection-1", "lifespan", {
      score: 400,
      profileExpEarned: 3,
      weaponDiscoveries: [
        true,
        true,
        false,
        false,
        false,
        false,
        false,
        false,
        false,
        false,
      ],
      armorDiscoveries: initial.armorDiscoveries,
      achievementSlots: [true, false, false, false, false, false],
    });
    const first = commit(store, "m5-07-collection-1", initial, firstRun);
    expect(first).toMatchObject({
      status: "committed",
      profile: { level: 1, xp: 3, highScore: 400 },
    });
    if (first.status !== "committed") {
      throw new Error("Expected the first collection run to commit");
    }

    const repeatedFirst = commit(
      store,
      "m5-07-collection-1",
      initial,
      firstRun,
    );
    expect(repeatedFirst).toEqual({
      status: "already-committed",
      profile: first.profile,
      result: first.result,
    });

    const secondRun = settlementFrom(
      first.profile,
      "m5-07-collection-2",
      "combat",
      {
        score: 300,
        profileExpEarned: 0,
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
        armorDiscoveries: [
          true,
          true,
          false,
          false,
          false,
          false,
          false,
          false,
          false,
          false,
        ],
        achievementSlots: [true, true, false, false, false, false],
      },
    );
    const second = commit(
      store,
      "m5-07-collection-2",
      first.profile,
      secondRun,
    );
    expect(second).toMatchObject({
      status: "committed",
      profile: { highScore: 400 },
    });
    if (second.status !== "committed") {
      throw new Error("Expected the second collection run to commit");
    }

    const completeRun = settlementFrom(
      second.profile,
      "m5-07-collection-complete",
      "lifespan",
      {
        score: 450,
        profileExpEarned: 0,
        weaponDiscoveries: Array(10).fill(true),
        armorDiscoveries: Array(10).fill(true),
        achievementSlots: Array(6).fill(true),
      },
    );
    const complete = commit(
      store,
      "m5-07-collection-complete",
      second.profile,
      completeRun,
    );
    expect(complete).toMatchObject({ status: "committed" });
    if (complete.status !== "committed") {
      throw new Error("Expected the complete collection run to commit");
    }
    expect(complete.profile.weaponDiscoveries).toEqual(Array(10).fill(true));
    expect(complete.profile.armorDiscoveries).toEqual(Array(10).fill(true));
    expect(complete.profile.achievementSlots).toEqual(Array(6).fill(true));
    expect(calculateProfileProgress(complete.profile)).toEqual({
      weaponCount: 10,
      armorCount: 10,
      collectionProgress: 70,
      achievementsUnlocked: 5,
      achievementProgress: 30,
      totalProgress: 100,
    });
    expect(store.load()).toMatchObject({
      status: "loaded",
      profile: complete.profile,
    });
  });

  it("keeps a failed completion retryable, deduplicates the retry, and ignores a step-limit run", () => {
    const storage = new ScenarioStorage();
    const store = createBrowserProfileStore(storage);
    const initial = createFreshProfile();
    expect(store.save(initial)).toMatchObject({ status: "saved" });
    const run = settlementFrom(initial, "m5-07-retry", "combat", {
      score: 600,
      profileExpEarned: 131,
    });

    storage.failNextPrimaryWrite = true;
    const failed = commit(store, "m5-07-retry", initial, run);
    expect(failed).toMatchObject({
      status: "failed",
      error: { code: "write-failed" },
    });
    expect(store.load()).toEqual({
      status: "loaded",
      profile: initial,
      migrated: false,
    });

    const retried = commit(store, "m5-07-retry", initial, run);
    expect(retried).toMatchObject({
      status: "committed",
      profile: { level: 2, xp: 0, highScore: 600 },
    });
    if (retried.status !== "committed") {
      throw new Error("Expected the retry to commit");
    }
    expect(commit(store, "m5-07-retry", initial, run)).toEqual({
      status: "already-committed",
      profile: retried.profile,
      result: retried.result,
    });

    let trace: GameplayTrace | undefined;
    const runner = createSimulationRunner(engine, {
      onTrace: (value) => {
        trace = value;
      },
    });
    const stepLimited = runner.run({
      config: {
        ruleset: ORIGINAL_V13_RULESET_ID,
        seed: "m5-07-step-limit",
        initialProfile: retried.profile,
      },
      policy: nonProgressingPolicy,
      maxSteps: 5,
    });

    expect(stepLimited.terminalReason).toBe("step-limit");
    if (trace === undefined) {
      throw new Error("Expected a retained step-limit trace");
    }
    const terminal = trace.checkpoints.at(-1)?.state;
    expect(terminal).toBeDefined();
    expect(
      terminal === undefined
        ? undefined
        : completedRunSettlementFromState(terminal),
    ).toBeUndefined();
    expect(store.load()).toMatchObject({
      status: "loaded",
      profile: retried.profile,
    });
  });

  it("retains high-score replacement and retention across distinct completion identities", () => {
    const storage = new ScenarioStorage();
    const store = createBrowserProfileStore(storage);
    const initial = createFreshProfile();
    expect(store.save(initial)).toMatchObject({ status: "saved" });

    const firstRun = settlementFrom(initial, "m5-07-high-score-1", "lifespan", {
      score: 200,
      profileExpEarned: 0,
    });
    const first = commit(store, "m5-07-high-score-1", initial, firstRun);
    expect(first).toMatchObject({
      status: "committed",
      profile: { highScore: 200 },
    });
    if (first.status !== "committed") {
      throw new Error("Expected the first score to commit");
    }

    const retainedRun = settlementFrom(
      first.profile,
      "m5-07-high-score-2",
      "combat",
      { score: 199, profileExpEarned: 0 },
    );
    const retained = commit(
      store,
      "m5-07-high-score-2",
      first.profile,
      retainedRun,
    );
    expect(retained).toMatchObject({
      status: "committed",
      profile: { highScore: 200 },
    });
    if (retained.status !== "committed") {
      throw new Error("Expected the retained score to commit");
    }

    const replacementRun = settlementFrom(
      retained.profile,
      "m5-07-high-score-3",
      "lifespan",
      { score: 201, profileExpEarned: 0 },
    );
    const replacement = commit(
      store,
      "m5-07-high-score-3",
      retained.profile,
      replacementRun,
    );
    expect(replacement).toMatchObject({
      status: "committed",
      profile: { highScore: 201 },
    });

    const raw = storage.getItem(PROFILE_STORAGE_KEY);
    expect(raw).not.toBeNull();
    expect(JSON.parse(raw as string)).toMatchObject({
      schemaVersion: PROFILE_STORAGE_ENVELOPE_VERSION,
      completedRuns: [
        { completionId: "m5-07-high-score-1" },
        { completionId: "m5-07-high-score-2" },
        { completionId: "m5-07-high-score-3" },
      ],
    });
  });
});
