import { describe, expect, expectTypeOf, it } from "vitest";

import type {
  CompletedRunSettlementInput,
  ProfileState,
  RunState,
  RunTerminalReason,
} from "../../src/domain/contracts.js";
import type { RunResult } from "../../src/application/contracts.js";
import {
  createFreshProfile,
  profileExperienceAtProgress,
  settleCompletedRun,
} from "../../src/domain/profile.js";
import { createTestGameplayEngine } from "../helpers/gameplay-engine.js";
import { createSimulationRunner } from "../../src/simulation/simulation-runner.js";
import { nonProgressingPolicy } from "../../src/simulation/non-progressing-policy.js";

const gameplayEngine = createTestGameplayEngine();
const config = Object.freeze({
  ruleset: "original-v1.3",
  seed: "profile-settlement",
  initialProfile: createFreshProfile(),
});

function completedRun(
  terminalReason: RunTerminalReason,
  patch: Partial<Pick<RunState, "profileExpEarned" | "score">> = {},
  initialProfile: ProfileState = config.initialProfile,
): RunState {
  const active = gameplayEngine.createRun({ ...config, initialProfile });
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

function profileWith(patch: Partial<ProfileState>): ProfileState {
  return {
    ...createFreshProfile(),
    ...patch,
  };
}

describe("completed-run profile settlement", () => {
  it("animates a threshold crossing with matching level and threshold", () => {
    const samples = [0, 0.25, 0.5, 0.75, 1].map((progress) =>
      profileExperienceAtProgress(1, 129, 1.75, 4, progress),
    );

    expect(samples).toEqual([
      { level: 1, xp: 129, threshold: 130, scoreMultiplier: 1.75 },
      { level: 1, xp: 130, threshold: 130, scoreMultiplier: 1.75 },
      { level: 2, xp: 0, threshold: 160, scoreMultiplier: 1.2 },
      { level: 2, xp: 0, threshold: 160, scoreMultiplier: 1.2 },
      { level: 2, xp: 1, threshold: 160, scoreMultiplier: 1.2 },
    ]);
  });

  it("animates multiple level-ups without changing the visible level backward", () => {
    const samples = [0, 0.2, 0.4, 0.6, 0.8, 1].map((progress) =>
      profileExperienceAtProgress(1, 0, 1, 486, progress),
    );

    expect(samples.at(-1)).toEqual({
      level: 4,
      xp: 0,
      threshold: 220,
      scoreMultiplier: 1.4,
    });
    for (let index = 1; index < samples.length; index += 1) {
      const previous = samples[index - 1]!;
      const current = samples[index]!;
      expect(current.level).toBeGreaterThanOrEqual(previous.level);
      if (current.level === previous.level) {
        expect(current.xp).toBeGreaterThanOrEqual(previous.xp);
        expect(current.threshold).toBe(previous.threshold);
      }
    }
  });

  it.each(["lifespan", "combat"] as const)(
    "settles a %s death from authoritative run earnings",
    (terminalReason) => {
      const initial = profileWith({
        xp: 129,
        scoreMultiplier: 1.75,
        highScore: 100,
        tutorialPreference: "enabled",
      });
      const run = completedRun(
        terminalReason,
        {
          profileExpEarned: 4,
          score: 125,
        },
        initial,
      );

      const settled = settleCompletedRun(initial, run);

      expect(settled).toMatchObject({
        level: 2,
        xp: 1,
        scoreMultiplier: 1.2,
        highScore: 125,
        tutorialPreference: "disabled",
      });
      expect(settled.weaponDiscoveries).toEqual(initial.weaponDiscoveries);
      expect(settled.armorDiscoveries).toEqual(initial.armorDiscoveries);
      expect(settled.achievementSlots).toEqual(initial.achievementSlots);
    },
  );

  it.each([
    {
      name: "equality at the threshold",
      initial: { level: 1, xp: 0 },
      earned: 130,
      expected: { level: 1, xp: 130, scoreMultiplier: 1.75 },
    },
    {
      name: "crossing the threshold",
      initial: { level: 1, xp: 0 },
      earned: 131,
      expected: { level: 2, xp: 0, scoreMultiplier: 1.2 },
    },
    {
      name: "a partial final transfer after a level-up",
      initial: { level: 1, xp: 129 },
      earned: 4,
      expected: { level: 2, xp: 1, scoreMultiplier: 1.2 },
    },
    {
      name: "zero earnings",
      initial: { level: 4, xp: 17 },
      earned: 0,
      expected: { level: 4, xp: 17, scoreMultiplier: 1.75 },
    },
    {
      name: "multiple level-ups",
      initial: { level: 1, xp: 0 },
      earned: 486,
      expected: { level: 4, xp: 0, scoreMultiplier: 1.4 },
    },
  ])("preserves researched transfer behavior for $name", (scenario) => {
    const initial = profileWith({
      ...scenario.initial,
      scoreMultiplier: 1.75,
      tutorialPreference: "enabled",
    });
    const settled = settleCompletedRun(
      initial,
      completedRun("lifespan", { profileExpEarned: scenario.earned }),
    );

    expect(settled).toMatchObject({
      ...scenario.expected,
      highScore: 0,
      tutorialPreference: "disabled",
    });
  });

  it.each([
    { score: 199, expectedHighScore: 200 },
    { score: 200, expectedHighScore: 200 },
    { score: 201, expectedHighScore: 201 },
  ])(
    "retains or replaces high score by comparison",
    ({ score, expectedHighScore }) => {
      const initial = profileWith({ highScore: 200, scoreMultiplier: 1.5 });
      const run = completedRun("combat", { score }, initial);
      const beforeRun = JSON.stringify(run);
      const beforeProfile = JSON.stringify(initial);

      const settled = settleCompletedRun(initial, run);

      expect(settled.highScore).toBe(expectedHighScore);
      expect(run.scoreMultiplier).toBe(1.5);
      expect(run.score).toBe(score);
      expect(JSON.stringify(run)).toBe(beforeRun);
      expect(JSON.stringify(initial)).toBe(beforeProfile);
      expect(settleCompletedRun(initial, run)).toEqual(settled);
    },
  );

  it("keeps the unconditional introductory tutorial on the next run", () => {
    const settled = settleCompletedRun(
      profileWith({ tutorialPreference: "enabled" }),
      completedRun("lifespan"),
    );

    expect(settled.tutorialPreference).toBe("disabled");
    expect(
      gameplayEngine.createRun({ ...config, initialProfile: settled }).lifecycle
        .tutorialPage,
    ).toBe(0);
  });

  it("rejects active runs and keeps step-limit results outside settlement", () => {
    const initial = createFreshProfile();
    const active = gameplayEngine.createRun({
      ...config,
      initialProfile: initial,
    });
    expect(() => settleCompletedRun(initial, active)).toThrow("completed run");

    const stepLimit = createSimulationRunner(gameplayEngine).run({
      config: { ...config, initialProfile: initial },
      policy: nonProgressingPolicy,
      maxSteps: 1,
    });
    expect(stepLimit.terminalReason).toBe("step-limit");
    expectTypeOf<RunResult>().not.toMatchTypeOf<CompletedRunSettlementInput>();
    expect(() =>
      settleCompletedRun(
        initial,
        stepLimit as unknown as CompletedRunSettlementInput,
      ),
    ).toThrow("completed run");
  });
});
