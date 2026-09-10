import type {
  CompletedRunSettlementInput,
  ProfileInput,
  ProfileState,
  RunState,
} from "../domain/contracts.js";
import { normalizeProfile, settleCompletedRun } from "../domain/profile.js";
import { fingerprintCanonicalJson } from "./canonical-json.js";
import type { ProfileStorageError, ProfileStore } from "./persistence.js";

export interface CompletedRunRequest {
  readonly completionId: string;
  readonly initialProfile: ProfileInput;
  readonly run: Readonly<CompletedRunSettlementInput>;
}

export type CompletedRunResult =
  | Readonly<{
      status: "committed" | "already-committed";
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

export interface CompletedRunCoordinator {
  commit(request: CompletedRunRequest): CompletedRunResult;
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
          });
        case "already-committed":
          return Object.freeze({
            status: "already-committed" as const,
            profile: result.profile,
          });
        case "failed":
        case "uncertain":
          return Object.freeze({ status: result.status, error: result.error });
      }
    },
  });
}
