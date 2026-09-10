import { describe, expect, it } from "vitest";

import {
  createCompletedRunCoordinator,
  completedRunSettlementFromState,
} from "../../src/application/completed-run.js";
import type {
  CompletedRunCommitResult,
  CompletedRunCommitRequest,
  ProfileStore,
} from "../../src/application/persistence.js";
import {
  createFreshProfile,
  normalizeProfile,
} from "../../src/domain/profile.js";
import type { ProfileState } from "../../src/domain/contracts.js";
import { createTestGameplayEngine } from "../helpers/gameplay-engine.js";

const engine = createTestGameplayEngine();

function completedRun() {
  const initialProfile = createFreshProfile();
  const active = engine.createRun({
    ruleset: "original-v1.3",
    seed: "committed-result",
    initialProfile,
  });
  return {
    initialProfile,
    run: Object.freeze({
      ...active,
      score: 500,
      profileExpEarned: 131,
      lifecycle: Object.freeze({
        ...active.lifecycle,
        phase: "ended" as const,
        terminalReason: "combat" as const,
      }),
    }),
  };
}

function createStore(profile: ProfileState): ProfileStore {
  let current = profile;
  return Object.freeze({
    load: () =>
      Object.freeze({
        status: "loaded" as const,
        profile: current,
        migrated: false,
      }),
    save: (nextProfile: ProfileState) => {
      current = normalizeProfile(nextProfile);
      return Object.freeze({ status: "saved" as const, profile: current });
    },
    commitCompletedRun: (
      request: CompletedRunCommitRequest,
    ): CompletedRunCommitResult => {
      current = normalizeProfile(request.nextProfile);
      return Object.freeze({ status: "saved" as const, profile: current });
    },
  });
}

describe("committed run result", () => {
  it("projects only committed, player-visible progression values", () => {
    const { initialProfile, run } = completedRun();
    const settlement = completedRunSettlementFromState(run);
    if (settlement === undefined) {
      throw new Error("Expected a completed gameplay death");
    }

    const result = createCompletedRunCoordinator(
      createStore(initialProfile),
    ).commit({
      completionId: "committed-result",
      initialProfile,
      run: settlement,
    });

    expect(result).toMatchObject({ status: "committed" });
    if (result.status !== "committed") {
      throw new Error("Expected the completed run to be committed");
    }
    expect(result.result).toEqual({
      run: {
        terminalReason: "combat",
        score: 500,
        profileExpEarned: 131,
      },
      progression: {
        level: { before: 1, after: 2 },
        xp: { before: 0, after: 0 },
        scoreMultiplier: { before: 1, after: 1.2 },
        highScore: { before: 0, after: 500 },
      },
      profile: {
        level: 2,
        xp: 0,
        scoreMultiplier: 1.2,
        highScore: 500,
        collections: {
          weaponsDiscovered: 1,
          weaponsTotal: 10,
          armorDiscovered: 1,
          armorTotal: 10,
        },
        achievements: {
          unlocked: [],
          unlockedCount: 0,
          total: 5,
        },
        progress: {
          collectionPoints: 7,
          achievementPoints: 0,
          totalPoints: 7,
        },
      },
    });
    expect(result).not.toHaveProperty("result.profile.weaponDiscoveries");
    expect(result).not.toHaveProperty("result.profile.achievementSlots");
    expect(result).not.toHaveProperty("result.random");
  });
});
