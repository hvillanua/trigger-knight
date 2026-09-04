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
            maximumTier: 10,
            names: [
              "Dagger",
              "Sword",
              "Rapier",
              "Falchion",
              "Katana",
              "Flamberge",
              "Zweihander",
              "Broad Kris",
              "Excalibur",
              "Astral Sword",
            ],
            baseAttack: 129,
            attackPerTier: 87,
          },
          armor: {
            initialTier: 1,
            maximumTier: 10,
            names: [
              "Clothing",
              "Protector",
              "Breastplate",
              "Chainmail",
              "Fullplate",
              "Samurai Mail",
              "Valkyrie Garb",
              "Odin Garb",
              "Avalon",
              "Astral Armor",
            ],
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
        encounters: {
          enemySelection: {
            ordinaryIds: ["goblin", "golem", "wolf"],
            ordinaryRollUpperBound: 3,
            dragonRollFirstDay: 7,
            dragonChanceDayOffset: 7,
            dragonChancePerDay: 3,
            dragonRollUpperBound: 100,
            scaling: {
              goblin: {
                maximumHpBase: 600,
                maximumHpPerDay: 60,
                attackBase: 82,
                attackPerDay: 40,
                goldRewardBase: 70,
                goldRewardPerDay: 12,
                profileExpBase: 10,
                profileExpPerDay: 3,
              },
              golem: {
                maximumHpBase: 860,
                maximumHpPerDay: 120,
                attackBase: 40,
                attackPerDay: 28,
                goldRewardBase: 78,
                goldRewardPerDay: 14,
                profileExpBase: 9,
                profileExpPerDay: 4,
              },
              wolf: {
                maximumHpBase: 450,
                maximumHpPerDay: 44,
                attackBase: 94,
                attackPerDay: 56,
                goldRewardBase: 78,
                goldRewardPerDay: 14,
                profileExpBase: 8,
                profileExpPerDay: 5,
              },
              dragon: {
                maximumHpBase: 2_400,
                maximumHpPerDay: 300,
                attackBase: 160,
                attackPerDay: 80,
                goldRewardBase: 350,
                goldRewardPerDay: 60,
                profileExpBase: 40,
                profileExpPerDay: 25,
              },
            },
          },
        },
        battle: {
          heroInitialX: 50,
          initialAttackDelay: 0,
          initialAttackFactor: 1,
          initialAttackCount: 0,
          initialAlpha: 100,
          initialEnemyGoldMultiplier: 1,
          speedDecayPerActiveTick: 1,
        },
        items: {
          divineEdgeAttackFactor: 100,
          goldVoucherMultiplier: 10,
        },
      },
      compatibilityDecisions: {
        randomSequence: "mulberry32-fnv1a32-v1",
        randomCompatibilityTarget: "confirmed-ranges-probabilities-draw-order",
        coordinateModel: "original-stage-units-as-world-units",
        pregameDelayProgression: "after-commands-while-other-gates-open",
        pregameDelayCountsAsActiveGameplay: false,
        encounterInitializationDrawOrder: "queue-then-distance",
        soulShrineInitializationDrawOrder: "after-queue-and-distance",
        encounterPromotionDrawOrder: "replacement-then-distance",
        battleGenerationDrawOrder:
          "shop-count-then-dragon-check-then-ordinary-enemy",
        dragonResetPoint: "ordinary-battle-promotion-before-replacement",
        battleEntryProgression: "running-tick-then-battle-ticks",
        battleActorPositions: "hero-x-50-enemy-at-positioned-encounter",
      },
    });
    expect(Object.isFrozen(originalV13RuleSet)).toBe(true);
    expect(Object.isFrozen(originalV13RuleSet.constants.movement)).toBe(true);
    expect(Object.isFrozen(originalV13RuleSet.constants.loadout.weapon)).toBe(
      true,
    );
    expect(
      Object.isFrozen(originalV13RuleSet.constants.loadout.weapon.names),
    ).toBe(true);
    expect(Object.isFrozen(originalV13RuleSet.constants.loadout.armor)).toBe(
      true,
    );
    expect(
      Object.isFrozen(originalV13RuleSet.constants.loadout.armor.names),
    ).toBe(true);
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
