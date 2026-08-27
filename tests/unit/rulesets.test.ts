import { describe, expect, it } from "vitest";

import {
  createRuleSetRegistry,
  ORIGINAL_V13_RULESET_ID,
  originalV13RuleSet,
  ruleSetRegistry,
} from "../../src/domain/rulesets.js";

describe("ruleset registry", () => {
  it("owns the original-v1.3 foundation and its compatibility decisions", () => {
    expect(originalV13RuleSet).toMatchObject({
      id: "original-v1.3",
      constants: {
        logicalTicksPerSecond: 30,
        pregameDelaySteps: 60,
        movement: {
          initialSpeed: 0,
          accelerationPerActiveTick: 1,
          maximumSpeed: 15,
          distancePerSpeedUnit: 1,
          distancePerDay: 7_000,
        },
        runningScorePerSpeedUnit: 10,
        economy: {
          initialGold: 300,
        },
        loadout: {
          weapon: {
            initialTier: 1,
            baseAttack: 129,
            attackPerTier: 87,
          },
          armor: {
            initialTier: 1,
            baseMaximumHp: 1_009,
            maximumHpPerTier: 899,
          },
          initialInventoryItem: "elixir",
        },
        lifespan: {
          initialWhole: 99,
          initialFraction: 99,
          drainPerActiveTick: 4,
          fractionReset: 99,
          deathBelowWhole: 0,
        },
        world: {
          originalStageUnitsPerWorldUnit: 1,
          initialCamera: {
            x: 0,
            y: 0,
            width: 480,
            height: 320,
          },
        },
      },
      compatibilityDecisions: {
        randomSequence: "mulberry32-fnv1a32-v1",
        randomCompatibilityTarget: "confirmed-ranges-probabilities-draw-order",
        coordinateModel: "original-stage-units-as-world-units",
        pregameDelayProgression: "after-commands-while-other-gates-open",
        pregameDelayCountsAsActiveGameplay: false,
        encounterInitializationDrawOrder: "queue-then-distance",
        encounterPromotionDrawOrder: "replacement-then-distance",
      },
    });
    expect(Object.isFrozen(originalV13RuleSet)).toBe(true);
    expect(Object.isFrozen(originalV13RuleSet.constants.movement)).toBe(true);
    expect(Object.isFrozen(originalV13RuleSet.constants.loadout.weapon)).toBe(
      true,
    );
    expect(Object.isFrozen(originalV13RuleSet.constants.loadout.armor)).toBe(
      true,
    );
    expect(
      Object.isFrozen(originalV13RuleSet.constants.world.initialCamera),
    ).toBe(true);
  });

  it("resolves every accepted identity to its implementation", () => {
    expect(ruleSetRegistry.supportedIds).toEqual([ORIGINAL_V13_RULESET_ID]);
    expect(ruleSetRegistry.resolve(ORIGINAL_V13_RULESET_ID)).toBe(
      originalV13RuleSet,
    );
    expect(() => ruleSetRegistry.resolve("walking-skeleton-v1")).toThrowError(
      'Unsupported ruleset "walking-skeleton-v1"',
    );
  });

  it("allows later rulesets to coexist without changing original-v1.3", () => {
    const futureRuleSet = Object.freeze({
      ...originalV13RuleSet,
      id: "future-v1",
    });
    const registry = createRuleSetRegistry([originalV13RuleSet, futureRuleSet]);

    expect(registry.supportedIds).toEqual(["original-v1.3", "future-v1"]);
    expect(registry.resolve(ORIGINAL_V13_RULESET_ID)).toBe(originalV13RuleSet);
    expect(registry.resolve("future-v1")).toBe(futureRuleSet);
  });
});
