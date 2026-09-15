import type {
  AchievementId,
  CompletedRunSettlementInput,
  ProfileInput,
  ProfileState,
  RunTerminalReason,
  RunState,
} from "../domain/contracts.js";
import {
  ACHIEVEMENT_IDS,
  calculateProfileProgress,
  PROFILE_DEFINED_ACHIEVEMENT_COUNT,
  PROFILE_EQUIPMENT_TIER_COUNT,
  normalizeProfile,
  profileExperienceThreshold,
  settleCompletedRun,
} from "../domain/profile.js";
import { fingerprintCanonicalJson } from "./canonical-json.js";
import type { ProfileStorageError, ProfileStore } from "./persistence.js";

export interface CompletedRunRequest {
  readonly completionId: string;
  readonly initialProfile: ProfileInput;
  readonly run: Readonly<CompletedRunSettlementInput>;
}

/** @playerVisible Committed progression values safe for result presentation. */
export interface CommittedProfileView {
  readonly level: number;
  readonly xp: number;
  readonly experienceThreshold: number;
  readonly scoreMultiplier: number;
  readonly highScore: number;
  readonly collections: Readonly<{
    readonly weaponsDiscovered: number;
    readonly weaponsTotal: number;
    readonly armorDiscovered: number;
    readonly armorTotal: number;
  }>;
  readonly achievements: Readonly<{
    readonly unlocked: readonly AchievementId[];
    readonly unlockedCount: number;
    readonly total: number;
  }>;
  readonly progress: Readonly<{
    readonly collectionPoints: number;
    readonly achievementPoints: number;
    readonly totalPoints: number;
  }>;
}

/** @playerVisible Public result projection produced after durable commitment. */
export interface CommittedRunResultView {
  readonly run: Readonly<{
    readonly terminalReason: RunTerminalReason;
    readonly score: number;
    readonly profileExpEarned: number;
  }>;
  readonly progression: Readonly<{
    readonly level: Readonly<{
      readonly before: number;
      readonly after: number;
    }>;
    readonly xp: Readonly<{ readonly before: number; readonly after: number }>;
    readonly scoreMultiplier: Readonly<{
      readonly before: number;
      readonly after: number;
    }>;
    readonly highScore: Readonly<{
      readonly before: number;
      readonly after: number;
    }>;
  }>;
  readonly profile: CommittedProfileView;
}

export type CompletedRunResult =
  | Readonly<{
      status: "committed" | "already-committed";
      profile: ProfileState;
      result: CommittedRunResultView;
    }>
  | Readonly<{
      status: "uncertain";
      error: ProfileStorageError;
    }>
  | Readonly<{
      status: "failed";
      error: ProfileStorageError;
    }>;

export interface CompletedRunCoordinator {
  commit(request: CompletedRunRequest): CompletedRunResult;
}

function createCommittedProfileView(
  profile: Readonly<ProfileState>,
): CommittedProfileView {
  const progress = calculateProfileProgress(profile);
  const unlocked = Object.freeze(
    ACHIEVEMENT_IDS.filter((_, index) => profile.achievementSlots[index]),
  );

  return Object.freeze({
    level: profile.level,
    xp: profile.xp,
    experienceThreshold: profileExperienceThreshold(profile.level),
    scoreMultiplier: profile.scoreMultiplier,
    highScore: profile.highScore,
    collections: Object.freeze({
      weaponsDiscovered: progress.weaponCount,
      weaponsTotal: PROFILE_EQUIPMENT_TIER_COUNT,
      armorDiscovered: progress.armorCount,
      armorTotal: PROFILE_EQUIPMENT_TIER_COUNT,
    }),
    achievements: Object.freeze({
      unlocked,
      unlockedCount: progress.achievementsUnlocked,
      total: PROFILE_DEFINED_ACHIEVEMENT_COUNT,
    }),
    progress: Object.freeze({
      collectionPoints: progress.collectionProgress,
      achievementPoints: progress.achievementProgress,
      totalPoints: progress.totalProgress,
    }),
  });
}

/** Projects one committed run without exposing authoritative run mechanics. */
export function createCommittedRunResultView(
  initialProfile: ProfileInput,
  run: Readonly<CompletedRunSettlementInput>,
  committedProfile: ProfileState,
): CommittedRunResultView {
  const terminalReason = run.lifecycle.terminalReason;
  if (
    run.lifecycle.phase !== "ended" ||
    (terminalReason !== "lifespan" && terminalReason !== "combat")
  ) {
    throw new TypeError(
      "Committed result requires a completed run with a gameplay death",
    );
  }
  const before = normalizeProfile(initialProfile);
  const after = normalizeProfile(committedProfile);

  return Object.freeze({
    run: Object.freeze({
      terminalReason,
      score: run.score,
      profileExpEarned: run.profileExpEarned,
    }),
    progression: Object.freeze({
      level: Object.freeze({ before: before.level, after: after.level }),
      xp: Object.freeze({ before: before.xp, after: after.xp }),
      scoreMultiplier: Object.freeze({
        before: before.scoreMultiplier,
        after: after.scoreMultiplier,
      }),
      highScore: Object.freeze({
        before: before.highScore,
        after: after.highScore,
      }),
    }),
    profile: createCommittedProfileView(after),
  });
}

function assertCompletionId(completionId: string): void {
  if (typeof completionId !== "string" || completionId.trim() === "") {
    throw new TypeError(
      "Completed-run completionId must be a non-empty string",
    );
  }
}

/** Projects only the settlement inputs needed after a gameplay death. */
export function completedRunSettlementFromState(
  state: Readonly<RunState>,
): CompletedRunSettlementInput | undefined {
  if (
    state.lifecycle.phase !== "ended" ||
    (state.lifecycle.terminalReason !== "lifespan" &&
      state.lifecycle.terminalReason !== "combat")
  ) {
    return undefined;
  }

  return Object.freeze({
    lifecycle: Object.freeze({
      phase: state.lifecycle.phase,
      terminalReason: state.lifecycle.terminalReason,
    }),
    score: state.score,
    profileExpEarned: state.profileExpEarned,
    weaponDiscoveries: Object.freeze([...state.weaponDiscoveries]),
    armorDiscoveries: Object.freeze([...state.armorDiscoveries]),
    achievementSlots: Object.freeze([...state.achievementSlots]),
  });
}

/** Coordinates one idempotent profile commit for a completed gameplay run. */
export function createCompletedRunCoordinator(
  store: ProfileStore,
): CompletedRunCoordinator {
  return Object.freeze({
    commit(request: CompletedRunRequest): CompletedRunResult {
      assertCompletionId(request.completionId);
      const initialProfile = normalizeProfile(request.initialProfile);
      const completionFingerprint = fingerprintCanonicalJson({
        initialProfile,
        run: request.run,
      });
      const nextProfile = settleCompletedRun(initialProfile, request.run);
      const result = store.commitCompletedRun({
        completionId: request.completionId,
        completionFingerprint,
        expectedProfile: initialProfile,
        nextProfile,
      });

      switch (result.status) {
        case "saved":
          return Object.freeze({
            status: "committed" as const,
            profile: result.profile,
            result: createCommittedRunResultView(
              initialProfile,
              request.run,
              result.profile,
            ),
          });
        case "already-committed":
          return Object.freeze({
            status: "already-committed" as const,
            profile: result.profile,
            result: createCommittedRunResultView(
              initialProfile,
              request.run,
              result.profile,
            ),
          });
        case "failed":
        case "uncertain":
          return Object.freeze({ status: result.status, error: result.error });
      }
    },
  });
}
