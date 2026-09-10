import { describe, expect, it } from "vitest";

import type {
  GameplayTrace,
  PlayerPolicy,
} from "../../src/application/contracts.js";
import { completedRunSettlementFromState } from "../../src/application/completed-run.js";
import { settleCompletedRun } from "../../src/domain/profile.js";
import { createCombatPolicy } from "../../src/simulation/combat-policy.js";
import { nonProgressingPolicy } from "../../src/simulation/non-progressing-policy.js";
import { purchasingPolicy } from "../../src/simulation/purchasing-policy.js";
import { createSimulationRunner } from "../../src/simulation/simulation-runner.js";
import { originalLifecyclePolicy } from "../helpers/original-lifecycle.js";
import { createTestGameplayEngine } from "../helpers/gameplay-engine.js";
import { assertOriginalV13CompatibilityBaseline } from "../fixtures/original-v13-baseline.js";
import { originalV13Traceability } from "../fixtures/original-v13-traceability.js";
import {
  ORIGINAL_V13_GAMEPLAY_TRACE_SCHEMA_VERSION,
  ORIGINAL_V13_RUN_RESULT_SCHEMA_VERSION,
  originalV13CompatibilityRuns,
  originalV13CompatibilitySettlements,
  summarizeCheckpoint,
  tutorialPages,
  type CompatibilityPolicyKey,
} from "../fixtures/original-v13-compatibility.js";

const engine = createTestGameplayEngine();

function policyFor(key: CompatibilityPolicyKey): PlayerPolicy {
  switch (key) {
    case "original-lifecycle":
      return originalLifecyclePolicy;
    case "combat-shopper":
      return createCombatPolicy({ elixirHpFraction: 0.5 });
    case "non-progressing":
      return nonProgressingPolicy;
    case "purchasing":
      return purchasingPolicy;
  }
}

function runFixture(fixture: (typeof originalV13CompatibilityRuns)[number]): {
  readonly result: ReturnType<ReturnType<typeof createSimulationRunner>["run"]>;
  readonly trace: GameplayTrace;
} {
  let trace: GameplayTrace | undefined;
  const policy = policyFor(fixture.policy.key);
  const result = createSimulationRunner(engine, {
    onTrace: (value) => {
      trace = value;
    },
  }).run({
    config: fixture.config,
    policy,
    maxSteps: fixture.maxSteps,
  });

  if (trace === undefined) {
    throw new Error(`Expected retained trace for ${fixture.id}`);
  }

  return { result, trace };
}

describe("original-v1.3 compatibility corpus", () => {
  it("labels every retained run and leaves no traceability blocker behind", () => {
    assertOriginalV13CompatibilityBaseline();
    expect(originalV13CompatibilityRuns.length).toBeGreaterThanOrEqual(5);
    expect(
      originalV13CompatibilityRuns.every(
        (fixture) =>
          fixture.execution === "uninterrupted-generated-run" &&
          fixture.provenance === "seeded-clean-room-evidence" &&
          fixture.config.ruleset === "original-v1.3" &&
          fixture.config.seed.length > 0 &&
          fixture.maxSteps > 0 &&
          fixture.policy.descriptor.id === fixture.expected.result.policy.id &&
          fixture.policy.descriptor.version ===
            fixture.expected.result.policy.version,
      ),
    ).toBe(true);
    expect(
      originalV13Traceability.filter((entry) => "blocker" in entry),
    ).toEqual([]);
  });

  it.each(originalV13CompatibilityRuns)(
    "replays the retained $id result, trace, and representative checkpoints",
    (fixture) => {
      const { result, trace } = runFixture(fixture);

      expect(trace.schemaVersion).toBe(
        ORIGINAL_V13_GAMEPLAY_TRACE_SCHEMA_VERSION,
      );
      expect(trace.config).toEqual(fixture.config);
      expect(result.schemaVersion).toBe(ORIGINAL_V13_RUN_RESULT_SCHEMA_VERSION);
      expect(result).toEqual(fixture.expected.result);
      expect(trace.traceHash).toBe(fixture.expected.traceHash);
      expect(tutorialPages(trace)).toEqual(fixture.expected.tutorialPages);

      for (const expected of fixture.expected.checkpoints) {
        const actual = trace.checkpoints[expected.index];
        expect(actual, `missing checkpoint ${expected.index}`).toBeDefined();
        expect(summarizeCheckpoint(actual!)).toEqual(expected);
      }

      const terminal = trace.checkpoints.at(-1)?.state;
      expect(terminal).toBeDefined();
      if (fixture.id === "gated-step-limit-does-not-settle") {
        expect(completedRunSettlementFromState(terminal!)).toBeUndefined();
      } else if (fixture.expected.completedProfile !== undefined) {
        const settlement = completedRunSettlementFromState(terminal!);
        expect(settlement).toBeDefined();
        expect(
          settleCompletedRun(fixture.config.initialProfile, settlement!),
        ).toEqual(fixture.expected.completedProfile);
      }

      if (
        fixture.id === "combat-death-with-shops-items-enemies-and-achievements"
      ) {
        const events = trace.checkpoints.flatMap(
          ({ events: checkpointEvents }) => checkpointEvents,
        );
        expect(
          new Set(
            events.flatMap((event) =>
              event.type === "shop-purchased" ? [event.shop] : [],
            ),
          ),
        ).toEqual(
          new Set([
            "armorsmith",
            "bladesmith",
            "grims-shop",
            "pharmacy",
            "soul-shrine",
            "voucher-store",
          ]),
        );
        expect(
          new Set(
            events.flatMap((event) =>
              event.type === "battle-started" ? [event.enemy.id] : [],
            ),
          ),
        ).toEqual(new Set(["dragon", "goblin", "golem", "wolf"]));
        expect(
          new Set(
            events.flatMap((event) =>
              event.type === "item-used" ? [event.item] : [],
            ),
          ),
        ).toEqual(new Set(["divine-edge", "elixir", "gold-voucher"]));
        expect(
          events
            .filter((event) => event.type === "equipment-discovered")
            .filter((event) => event.equipment === "weapon")
            .map((event) => event.tier),
        ).toEqual([2, 3, 4, 5, 6, 7, 8, 9, 10]);
        expect(
          events
            .filter((event) => event.type === "equipment-discovered")
            .filter((event) => event.equipment === "armor")
            .map((event) => event.tier),
        ).toEqual([2, 3, 4, 5, 6, 7, 8, 9, 10]);
        expect(
          events.some(
            (event) =>
              event.type === "achievement-unlocked" &&
              event.achievement === "reach-day-10",
          ),
        ).toBe(true);
      }
    },
    60_000,
  );

  it.each(originalV13CompatibilitySettlements)(
    "replays the retained $id profile settlement sequence",
    (fixture) => {
      expect(fixture.execution).toBe("constructed-boundary-scenario");
      expect(fixture.provenance).toBe("derived-clean-room-scenario");
      expect(fixture.ruleset).toBe("original-v1.3");
      expect(fixture.initialProfiles).toHaveLength(fixture.runs.length);
      expect(fixture.expectedProfiles).toHaveLength(fixture.runs.length);

      for (let index = 0; index < fixture.runs.length; index += 1) {
        const initialProfile = fixture.initialProfiles[index]!;
        const run = fixture.runs[index]!;
        const expected = fixture.expectedProfiles[index]!;

        expect(settleCompletedRun(initialProfile, run)).toEqual(expected);
        if (index > 0) {
          expect(initialProfile).toEqual(fixture.expectedProfiles[index - 1]);
        }
      }
    },
  );
});
