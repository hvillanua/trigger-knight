import { describe, expect, it } from "vitest";

import type {
  GameplayEngine,
  PresentationPort,
  ProfileState,
  RunConfig,
  RunState,
  RunTerminalReason,
} from "../../src/application/contracts.js";
import {
  createCompletedRunCoordinator,
  completedRunSettlementFromState,
} from "../../src/application/completed-run.js";
import type {
  CompletedRunCommitResult,
  ProfileStore,
} from "../../src/application/persistence.js";
import {
  createFreshProfile,
  normalizeProfile,
} from "../../src/domain/profile.js";
import { createTestGameplayEngine } from "../helpers/gameplay-engine.js";
import { createBrowserGameplaySession } from "../../src/browser/gameplay-session.js";

const gameplayEngine = createTestGameplayEngine();

function completedRun(
  terminalReason: RunTerminalReason,
  patch: Partial<Pick<RunState, "profileExpEarned" | "score">> = {},
  initialProfile: ProfileState = createFreshProfile(),
): RunState {
  const active = gameplayEngine.createRun({
    ruleset: "original-v1.3",
    seed: "completed-run",
    initialProfile,
  });
  return Object.freeze({
    ...active,
    ...patch,
    lifecycle: Object.freeze({
      ...active.lifecycle,
      phase: "ended",
      terminalReason,
    }),
  });
}

class MemoryProfileStore implements ProfileStore {
  #profile: ProfileState | undefined;
  #commits = new Map<string, string>();
  failNextCommit = false;

  constructor(profile?: ProfileState) {
    this.#profile = profile;
  }

  load() {
    return this.#profile === undefined
      ? { status: "empty" as const, profile: createFreshProfile() }
      : { status: "loaded" as const, profile: this.#profile, migrated: false };
  }

  save(profile: ProfileState) {
    this.#profile = normalizeProfile(profile);
    return { status: "saved" as const, profile: this.#profile };
  }

  commitCompletedRun(request: {
    readonly completionId: string;
    readonly completionFingerprint: string;
    readonly expectedProfile: ProfileState;
    readonly nextProfile: ProfileState;
  }): CompletedRunCommitResult {
    const existingFingerprint = this.#commits.get(request.completionId);
    if (existingFingerprint !== undefined) {
      if (existingFingerprint !== request.completionFingerprint) {
        return {
          status: "failed",
          error: {
            code: "completion-conflict",
            message: "Completion identity was reused for different inputs",
          },
        };
      }
      return {
        status: "already-committed",
        profile: this.#profile ?? createFreshProfile(),
      };
    }

    if (this.failNextCommit) {
      this.failNextCommit = false;
      return {
        status: "failed",
        error: { code: "write-failed", message: "Simulated write failure" },
      };
    }

    this.#commits.set(request.completionId, request.completionFingerprint);
    this.#profile = normalizeProfile(request.nextProfile);
    return { status: "saved", profile: this.#profile };
  }
}

describe("completed-run coordination", () => {
  it.each(["lifespan", "combat"] as const)(
    "commits one %s death before any later presentation work",
    (terminalReason) => {
      const initialProfile = createFreshProfile();
      const store = new MemoryProfileStore(initialProfile);
      const coordinator = createCompletedRunCoordinator(store);
      const run = completedRun(
        terminalReason,
        { profileExpEarned: 131 },
        initialProfile,
      );
      const settlement = completedRunSettlementFromState(run);

      expect(settlement).toEqual({
        lifecycle: { phase: "ended", terminalReason },
        score: 0,
        profileExpEarned: 131,
        weaponDiscoveries: initialProfile.weaponDiscoveries,
        armorDiscoveries: initialProfile.armorDiscoveries,
        achievementSlots: initialProfile.achievementSlots,
      });
      expect(settlement).not.toHaveProperty("random");
      expect(settlement).not.toHaveProperty("battle");
      const first = coordinator.commit({
        completionId: `${terminalReason}-run`,
        initialProfile,
        run: settlement!,
      });

      expect(first).toMatchObject({
        status: "committed",
        profile: { level: 2, xp: 0, tutorialPreference: "enabled" },
      });
    },
  );

  it("makes repeated terminal notifications idempotent", () => {
    const initialProfile = createFreshProfile();
    const store = new MemoryProfileStore(initialProfile);
    const coordinator = createCompletedRunCoordinator(store);
    const settlement = completedRunSettlementFromState(
      completedRun("combat", { profileExpEarned: 131 }, initialProfile),
    );

    const first = coordinator.commit({
      completionId: "same-run",
      initialProfile,
      run: settlement!,
    });
    const retry = coordinator.commit({
      completionId: "same-run",
      initialProfile,
      run: settlement!,
    });

    expect(first).toMatchObject({ status: "committed" });
    if (first.status !== "committed") {
      throw new Error("Expected the first completion to commit");
    }
    expect(retry).toEqual({
      status: "already-committed",
      profile: first.profile,
      result: first.result,
    });
  });

  it("keeps identical deterministic runs distinct when their explicit identities differ", () => {
    const initialProfile = createFreshProfile();
    const store = new MemoryProfileStore(initialProfile);
    const coordinator = createCompletedRunCoordinator(store);
    const settlement = completedRunSettlementFromState(
      completedRun("lifespan", { profileExpEarned: 131 }, initialProfile),
    );

    const first = coordinator.commit({
      completionId: "run-one",
      initialProfile,
      run: settlement!,
    });
    if (first.status !== "committed") {
      throw new Error("Expected the first completion to commit");
    }
    const second = coordinator.commit({
      completionId: "run-two",
      initialProfile: first.profile,
      run: settlement!,
    });

    expect(first).toMatchObject({ status: "committed" });
    expect(second).toMatchObject({
      status: "committed",
      profile: { level: 2, xp: 131 },
    });
  });

  it("preserves the old profile and permits a retry after a failed commit", () => {
    const initialProfile = createFreshProfile();
    const store = new MemoryProfileStore(initialProfile);
    const coordinator = createCompletedRunCoordinator(store);
    const settlement = completedRunSettlementFromState(
      completedRun("combat", { profileExpEarned: 131 }, initialProfile),
    );
    store.failNextCommit = true;

    const failed = coordinator.commit({
      completionId: "retryable-run",
      initialProfile,
      run: settlement!,
    });
    expect(store.load()).toEqual({
      status: "loaded",
      profile: initialProfile,
      migrated: false,
    });
    const retried = coordinator.commit({
      completionId: "retryable-run",
      initialProfile,
      run: settlement!,
    });

    expect(failed).toMatchObject({
      status: "failed",
      error: { code: "write-failed" },
    });
    expect(retried).toMatchObject({
      status: "committed",
      profile: { level: 2 },
    });
  });

  it("does not derive completion identity from a step-limited or active run", () => {
    expect(
      completedRunSettlementFromState(
        gameplayEngine.createRun({
          ruleset: "original-v1.3",
          seed: "active",
          initialProfile: createFreshProfile(),
        }),
      ),
    ).toBeUndefined();
  });

  it("commits a terminal checkpoint before presenting it", () => {
    const config: RunConfig = {
      ruleset: "original-v1.3",
      seed: "presentation-order",
      initialProfile: createFreshProfile(),
    };
    const initial = gameplayEngine.createRun(config);
    const terminal = Object.freeze({
      ...initial,
      lifecycle: Object.freeze({
        ...initial.lifecycle,
        phase: "ended" as const,
        terminalReason: "lifespan" as const,
      }),
    });
    const engine: GameplayEngine = {
      createRun: () => initial,
      step: () => ({
        state: terminal,
        events: [{ type: "run-ended", reason: "lifespan" }],
      }),
      observe: (state) => gameplayEngine.observe(state),
    };
    const order: string[] = [];
    const presentation: PresentationPort = {
      present: () => order.push("present"),
    };

    const session = createBrowserGameplaySession(engine, config, presentation, {
      onCompletedRun: () => order.push("commit"),
    });
    session.dispatch([]);

    expect(order).toEqual(["present", "commit", "present"]);
  });
});
