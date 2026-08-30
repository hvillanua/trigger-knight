import { describe, expect, it } from "vitest";

import type {
  PlayerState,
  RandomState,
  RunState,
  ShopId,
} from "../../src/application/contracts.js";
import { generateEncounter } from "../../src/domain/encounters.js";
import { RANDOM_ALGORITHM } from "../../src/domain/random.js";
import {
  ORIGINAL_V13_RULESET_ID,
  originalV13RuleSet,
} from "../../src/domain/rulesets.js";
import { createTestGameplayEngine } from "../helpers/gameplay-engine.js";

const gameplayEngine = createTestGameplayEngine();
const purchaseCommand = Object.freeze({
  type: "purchase-current-encounter" as const,
});

const weaponTiers = [
  ["Dagger", 216],
  ["Sword", 303],
  ["Rapier", 390],
  ["Falchion", 477],
  ["Katana", 564],
  ["Flamberge", 651],
  ["Zweihander", 738],
  ["Broad Kris", 825],
  ["Excalibur", 912],
  ["Astral Sword", 999],
] as const;

const armorTiers = [
  ["Clothing", 1_908],
  ["Protector", 2_807],
  ["Breastplate", 3_706],
  ["Chainmail", 4_605],
  ["Fullplate", 5_504],
  ["Samurai Mail", 6_403],
  ["Valkyrie Garb", 7_302],
  ["Odin Garb", 8_201],
  ["Avalon", 9_100],
  ["Astral Armor", 9_999],
] as const;

function activeRun(): RunState {
  const state = gameplayEngine.createRun({
    ruleset: ORIGINAL_V13_RULESET_ID,
    seed: "equipment-upgrade-seed",
    initialProfile: { schemaVersion: 1, scoreMultiplier: 1 },
  });

  return {
    ...state,
    movementSpeed: 0,
    lifecycle: {
      ...state.lifecycle,
      tutorialPage: null,
      pregameStepsRemaining: 0,
    },
  };
}

function atEquipmentShop(
  state: Readonly<RunState>,
  shop: Extract<ShopId, "bladesmith" | "armorsmith">,
  cachedPrice: number,
): RunState {
  return {
    ...state,
    encounters: {
      ...state.encounters,
      current: {
        kind: "shop",
        shop,
        cachedPrice,
        x: 200,
        used: false,
      },
    },
  };
}

function randomAt(state: number): RandomState {
  return Object.freeze({ algorithm: RANDOM_ALGORITHM, state });
}

describe("original-v1.3 equipment upgrades", () => {
  it("starts with the researched tier-one names and values", () => {
    const player = gameplayEngine.observe(activeRun()).player;

    expect(player.weapon).toEqual({
      tier: 1,
      name: "Dagger",
      attack: 216,
    });
    expect(player.armor).toEqual({ tier: 1, name: "Clothing" });
    expect(player.hp).toEqual({ current: 1_908, maximum: 1_908 });
  });

  it("generates fresh equipment prices from the current tier", () => {
    for (let tier = 1; tier <= 10; tier += 1) {
      const player: PlayerState = {
        ...activeRun().player,
        weapon: {
          ...activeRun().player.weapon,
          tier,
          attack: 129 + 87 * tier,
        },
        armor: { ...activeRun().player.armor, tier },
        hp: {
          current: 1_009 + 899 * tier,
          maximum: 1_009 + 899 * tier,
        },
      };
      const generation = {
        shopsUntilBattle: 1,
        seenSinceBattle: {
          bladesmith: false,
          armorsmith: false,
          soulShrine: false,
        },
        soulShrine: {
          extensions: 0,
          emergencyThreshold: 40,
          emergencyChanceGiven: false,
        },
      } as const;

      const weapon = generateEncounter(
        randomAt(91),
        generation,
        4,
        player,
        { whole: 99, fraction: 99 },
        originalV13RuleSet.constants.encounters,
      );
      const armor = generateEncounter(
        randomAt(60),
        generation,
        4,
        player,
        { whole: 99, fraction: 99 },
        originalV13RuleSet.constants.encounters,
      );

      expect(weapon.encounter).toEqual({
        kind: "shop",
        shop: "bladesmith",
        cachedPrice: 200 + 36 * tier,
      });
      expect(armor.encounter).toEqual({
        kind: "shop",
        shop: "armorsmith",
        cachedPrice: 150 + 54 * tier,
      });
    }
  });

  it("advances every weapon tier, recomputes attack, and preserves HP", () => {
    let state: RunState = {
      ...activeRun(),
      player: { ...activeRun().player, gold: 10_000 },
    };

    expect(state.player.weapon).toEqual({
      tier: 1,
      name: weaponTiers[0][0],
      attack: weaponTiers[0][1],
    });

    for (let tier = 2; tier <= 10; tier += 1) {
      const price = 200 + 36 * (tier - 1);
      const expectedTier = weaponTiers[tier - 1];
      if (expectedTier === undefined) {
        throw new RangeError(`Missing weapon fixture for tier ${tier}`);
      }
      const hpBefore = state.player.hp;
      const goldBefore = state.player.gold;
      const result = gameplayEngine.step(
        atEquipmentShop(state, "bladesmith", price),
        [purchaseCommand],
      );

      expect(result.state.player.weapon).toEqual({
        tier,
        name: expectedTier[0],
        attack: expectedTier[1],
      });
      expect(result.state.player.hp).toEqual(hpBefore);
      expect(result.state.player.gold).toBe(goldBefore - price);
      expect(result.state.encounters.current).toMatchObject({ used: true });
      expect(result.events).toContainEqual({
        type: "shop-purchased",
        shop: "bladesmith",
        price,
      });

      state = result.state;
    }
  });

  it("advances every armor tier, recomputes maximum HP, and fully heals", () => {
    let state: RunState = {
      ...activeRun(),
      player: { ...activeRun().player, gold: 10_000 },
    };

    expect(state.player.armor).toEqual({
      tier: 1,
      name: armorTiers[0][0],
    });

    for (let tier = 2; tier <= 10; tier += 1) {
      const price = 150 + 54 * (tier - 1);
      const expectedTier = armorTiers[tier - 1];
      if (expectedTier === undefined) {
        throw new RangeError(`Missing armor fixture for tier ${tier}`);
      }
      const goldBefore = state.player.gold;
      state = {
        ...state,
        player: {
          ...state.player,
          hp: { ...state.player.hp, current: 1 },
        },
      };
      const result = gameplayEngine.step(
        atEquipmentShop(state, "armorsmith", price),
        [purchaseCommand],
      );

      expect(result.state.player.armor).toEqual({
        tier,
        name: expectedTier[0],
      });
      expect(result.state.player.hp).toEqual({
        current: expectedTier[1],
        maximum: expectedTier[1],
      });
      expect(result.state.player.gold).toBe(goldBefore - price);
      expect(result.state.encounters.current).toMatchObject({ used: true });
      expect(result.events).toContainEqual({
        type: "shop-purchased",
        shop: "armorsmith",
        price,
      });

      state = result.state;
    }
  });

  it("uses the same earlier cached price for upgrades queued across a battle", () => {
    const initial = atEquipmentShop(
      {
        ...activeRun(),
        player: { ...activeRun().player, gold: 1_000 },
        encounters: {
          ...activeRun().encounters,
          upcoming: [
            { kind: "battle" },
            { kind: "shop", shop: "bladesmith", cachedPrice: 236 },
          ],
        },
      },
      "bladesmith",
      236,
    );
    const first = gameplayEngine.step(initial, [purchaseCommand]);
    const second = gameplayEngine.step(
      atEquipmentShop(first.state, "bladesmith", 236),
      [purchaseCommand],
    );

    expect(first.state.player.weapon).toEqual({
      tier: 2,
      name: "Sword",
      attack: 303,
    });
    expect(second.state.player).toMatchObject({
      gold: 528,
      weapon: { tier: 3, name: "Rapier", attack: 390 },
      hp: initial.player.hp,
    });
    expect(
      [...first.events, ...second.events].filter(
        (event) => event.type === "shop-purchased",
      ),
    ).toEqual([
      { type: "shop-purchased", shop: "bladesmith", price: 236 },
      { type: "shop-purchased", shop: "bladesmith", price: 236 },
    ]);
  });

  it("preserves an earlier cached armor price across a queued battle", () => {
    const initial = atEquipmentShop(
      {
        ...activeRun(),
        player: { ...activeRun().player, gold: 1_000 },
        encounters: {
          ...activeRun().encounters,
          upcoming: [
            { kind: "battle" },
            { kind: "shop", shop: "armorsmith", cachedPrice: 204 },
          ],
        },
      },
      "armorsmith",
      204,
    );
    const first = gameplayEngine.step(initial, [purchaseCommand]);
    const second = gameplayEngine.step(
      atEquipmentShop(first.state, "armorsmith", 204),
      [purchaseCommand],
    );

    expect(first.state.player).toMatchObject({
      gold: 796,
      armor: { tier: 2, name: "Protector" },
      hp: { current: 2_807, maximum: 2_807 },
    });
    expect(second.state.player).toMatchObject({
      gold: 592,
      armor: { tier: 3, name: "Breastplate" },
      hp: { current: 3_706, maximum: 3_706 },
    });
    expect(second.state.player.weapon).toEqual(initial.player.weapon);
  });

  it("reports a funded max-tier Bladesmith as unavailable", () => {
    const initial = atEquipmentShop(
      {
        ...activeRun(),
        player: {
          ...activeRun().player,
          gold: 560,
          weapon: { tier: 10, name: "Astral Sword", attack: 999 },
        },
      },
      "bladesmith",
      560,
    );

    expect(
      gameplayEngine.observe(initial).actions.canPurchaseCurrentEncounter,
    ).toBe(false);

    const result = gameplayEngine.step(initial, [purchaseCommand]);

    expect(result.state.player).toEqual(initial.player);
    expect(result.state.encounters.current).toMatchObject({ used: false });
    expect(result.events).toContainEqual({
      type: "purchase-rejected",
      reason: "maximum-tier",
    });
    expect(
      gameplayEngine.observe(result.state).actions.canPurchaseCurrentEncounter,
    ).toBe(false);
  });

  it("keeps max-tier Bladesmith unavailable regardless of affordability", () => {
    const initial = atEquipmentShop(
      {
        ...activeRun(),
        player: {
          ...activeRun().player,
          gold: 559,
          weapon: { tier: 10, name: "Astral Sword", attack: 999 },
        },
      },
      "bladesmith",
      560,
    );
    const result = gameplayEngine.step(initial, [purchaseCommand]);

    expect(result.state.player).toEqual(initial.player);
    expect(result.state.encounters.current).toMatchObject({ used: false });
    expect(result.events).toContainEqual({
      type: "purchase-rejected",
      reason: "maximum-tier",
    });
  });

  it("reports a funded max-tier Armorsmith as unavailable without healing", () => {
    const initial = atEquipmentShop(
      {
        ...activeRun(),
        player: {
          ...activeRun().player,
          gold: 690,
          armor: { tier: 10, name: "Astral Armor" },
          hp: { current: 500, maximum: 9_999 },
        },
      },
      "armorsmith",
      690,
    );
    const result = gameplayEngine.step(initial, [purchaseCommand]);

    expect(result.state.player).toEqual(initial.player);
    expect(result.state.encounters.current).toMatchObject({ used: false });
    expect(result.events).toContainEqual({
      type: "purchase-rejected",
      reason: "maximum-tier",
    });
    expect(
      gameplayEngine.observe(result.state).actions.canPurchaseCurrentEncounter,
    ).toBe(false);
  });

  it("keeps max-tier Armorsmith unavailable regardless of affordability", () => {
    const initial = atEquipmentShop(
      {
        ...activeRun(),
        player: {
          ...activeRun().player,
          gold: 689,
          armor: { tier: 10, name: "Astral Armor" },
          hp: { current: 500, maximum: 9_999 },
        },
      },
      "armorsmith",
      690,
    );
    const result = gameplayEngine.step(initial, [purchaseCommand]);

    expect(result.state.player).toEqual(initial.player);
    expect(result.state.encounters.current).toMatchObject({ used: false });
    expect(result.events).toContainEqual({
      type: "purchase-rejected",
      reason: "maximum-tier",
    });
  });

  it("replays an equipment purchase after a checkpoint round trip", () => {
    const state = atEquipmentShop(
      { ...activeRun(), player: { ...activeRun().player, gold: 236 } },
      "bladesmith",
      236,
    );
    const restored = JSON.parse(JSON.stringify(state)) as RunState;
    const before = JSON.stringify(state);

    const first = gameplayEngine.step(state, [purchaseCommand]);
    const replayed = gameplayEngine.step(restored, [purchaseCommand]);

    expect(replayed).toEqual(first);
    expect(JSON.stringify(state)).toBe(before);
    expect(Object.isFrozen(first.state.player.weapon)).toBe(true);
    expect(Object.isFrozen(first.state.player.armor)).toBe(true);
    expect(Object.isFrozen(first.state.player.hp)).toBe(true);
  });
});
