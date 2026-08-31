import { describe, expect, it } from "vitest";

import { fingerprintCanonicalJson } from "../../src/application/canonical-json.js";
import type {
  EncounterGenerationState,
  RandomState,
  RunState,
} from "../../src/application/contracts.js";
import { generateEncounter } from "../../src/domain/encounters.js";
import {
  attemptPurchase,
  type PurchaseRules,
} from "../../src/domain/purchases.js";
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
const goblinBattle = Object.freeze({
  kind: "battle" as const,
  enemy: Object.freeze({
    id: "goblin" as const,
    maximumHp: 660,
    attack: 122,
    goldReward: 82,
    profileExp: 13,
  }),
});
const purchaseRules: PurchaseRules = Object.freeze({
  actionMinimumX: originalV13RuleSet.constants.encounters.shopActionMinimumX,
  actionMaximumX: originalV13RuleSet.constants.encounters.shopActionMaximumX,
  itemByShop: Object.freeze({
    pharmacy: "elixir",
    "grims-shop": "divine-edge",
    "voucher-store": "gold-voucher",
  }),
  soulShrineRestoration: Object.freeze({ whole: 99, fraction: 99 }),
  equipment: Object.freeze({
    weapon: originalV13RuleSet.constants.loadout.weapon,
    armor: originalV13RuleSet.constants.loadout.armor,
  }),
});

function randomAt(state: number): RandomState {
  return Object.freeze({ algorithm: RANDOM_ALGORITHM, state });
}

function activeRun(seed = "soul-shrine-seed"): RunState {
  const state = gameplayEngine.createRun({
    ruleset: ORIGINAL_V13_RULESET_ID,
    seed,
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

function generationState(
  overrides: Partial<EncounterGenerationState> = {},
): EncounterGenerationState {
  return {
    shopsUntilBattle: 1,
    dragonSpawned: false,
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
    ...overrides,
  };
}

function stateGeneratingReplacement(
  options: {
    readonly extensions?: number;
    readonly lifespanWhole?: number;
    readonly random?: RandomState;
    readonly shrineSeen?: boolean;
    readonly emergencyChanceGiven?: boolean;
    readonly emergencyThreshold?: number;
  } = {},
): RunState {
  const state = activeRun();

  return {
    ...state,
    random: options.random ?? randomAt(91),
    lifespan: {
      whole: options.lifespanWhole ?? 99,
      fraction: 99,
    },
    encounters: {
      ...state.encounters,
      current: null,
      distanceUntilNext: 0,
      upcoming: [
        { kind: "shop", shop: "pharmacy", cachedPrice: 150 },
        goblinBattle,
        { kind: "shop", shop: "grims-shop", cachedPrice: 200 },
      ],
      generation: generationState({
        seenSinceBattle: {
          bladesmith: false,
          armorsmith: false,
          soulShrine: options.shrineSeen ?? false,
        },
        soulShrine: {
          extensions: options.extensions ?? 0,
          emergencyThreshold: options.emergencyThreshold ?? 40,
          emergencyChanceGiven: options.emergencyChanceGiven ?? false,
        },
      }),
    },
  };
}

function atShrine(
  options: {
    readonly cachedPrice?: number;
    readonly extensions?: number;
    readonly emergencyChanceGiven?: boolean;
  } = {},
): RunState {
  const state = activeRun();

  return {
    ...state,
    lifespan: { whole: 12, fraction: 34 },
    player: { ...state.player, gold: 1_000 },
    encounters: {
      ...state.encounters,
      current: {
        kind: "shop",
        shop: "soul-shrine",
        cachedPrice: options.cachedPrice ?? 50,
        x: 200,
        used: false,
      },
      generation: generationState({
        soulShrine: {
          extensions: options.extensions ?? 0,
          emergencyThreshold: 44,
          emergencyChanceGiven: options.emergencyChanceGiven ?? true,
        },
      }),
    },
  };
}

describe("original-v1.3 Soul Shrine behavior", () => {
  it("initializes hidden emergency state inside the researched threshold range", () => {
    const state = activeRun();
    const shrine = state.encounters.generation.soulShrine;

    expect(shrine.extensions).toBe(0);
    expect(shrine.emergencyThreshold).toBeGreaterThanOrEqual(40);
    expect(shrine.emergencyThreshold).toBeLessThanOrEqual(49);
    expect(shrine.emergencyChanceGiven).toBe(false);
    expect(gameplayEngine.observe(state).encounters).not.toHaveProperty(
      "generation",
    );
  });

  it("restores both lifespan fields, spends the cached price, and resets emergency eligibility", () => {
    const state = atShrine();

    expect(
      gameplayEngine.observe(state).actions.canPurchaseCurrentEncounter,
    ).toBe(true);

    const purchase = attemptPurchase(state, purchaseRules);

    expect(purchase.state.lifespan).toEqual({ whole: 99, fraction: 99 });
    expect(purchase.state.encounters.generation.soulShrine).toEqual({
      extensions: 1,
      emergencyThreshold: 44,
      emergencyChanceGiven: false,
    });

    const result = gameplayEngine.step(state, [
      purchaseCommand,
      purchaseCommand,
    ]);

    expect(result.state.lifespan).toEqual({ whole: 99, fraction: 95 });
    expect(result.state.player.gold).toBe(950);
    expect(result.state.encounters.current).toMatchObject({ used: true });
    expect(result.state.encounters.generation.soulShrine).toEqual({
      extensions: 1,
      emergencyThreshold: 44,
      emergencyChanceGiven: false,
    });
    expect(result.events).toContainEqual({
      type: "shop-purchased",
      shop: "soul-shrine",
      price: 50,
    });
    expect(result.events).toContainEqual({
      type: "purchase-rejected",
      reason: "already-used",
    });
    expect(Object.isFrozen(result.state.encounters.generation.soulShrine)).toBe(
      true,
    );
  });

  it.each([
    [0, 50],
    [1, 120],
    [2, 190],
    [3, 260],
  ] as const)(
    "caches a %i-extension Shrine price of %i",
    (extensions, expectedPrice) => {
      const state = stateGeneratingReplacement({
        extensions,
        random: randomAt(0),
      });
      const result = gameplayEngine.step(state, []);

      expect(result.state.encounters.upcoming.at(-1)).toEqual({
        kind: "shop",
        shop: "soul-shrine",
        cachedPrice: expectedPrice,
      });
    },
  );

  it("forces one Shrine below the threshold and rerolls the threshold", () => {
    const state = stateGeneratingReplacement({
      lifespanWhole: 39,
      random: randomAt(91),
    });
    const result = gameplayEngine.step(state, []);
    const shrine = result.state.encounters.generation.soulShrine;

    expect(result.state.encounters.upcoming.at(-1)).toEqual({
      kind: "shop",
      shop: "soul-shrine",
      cachedPrice: 50,
    });
    expect(result.state.encounters.generation.seenSinceBattle.soulShrine).toBe(
      false,
    );
    expect(shrine.emergencyThreshold).toBeGreaterThanOrEqual(40);
    expect(shrine.emergencyThreshold).toBeLessThanOrEqual(49);
    expect(shrine.emergencyChanceGiven).toBe(true);
  });

  it("allows one normal Shrine after a forced Shrine in the same battle cycle", () => {
    const lifespan = Object.freeze({ whole: 20, fraction: 99 });
    const forced = generateEncounter(
      randomAt(91),
      generationState({ shopsUntilBattle: 2 }),
      4,
      activeRun().player,
      lifespan,
      originalV13RuleSet.constants.encounters,
    );
    const normal = generateEncounter(
      randomAt(0),
      forced.generation,
      4,
      activeRun().player,
      lifespan,
      originalV13RuleSet.constants.encounters,
    );

    expect(forced.encounter).toMatchObject({ shop: "soul-shrine" });
    expect(forced.generation.seenSinceBattle.soulShrine).toBe(false);
    expect(normal.encounter).toEqual({
      kind: "shop",
      shop: "soul-shrine",
      cachedPrice: 50,
    });
    expect(normal.generation.seenSinceBattle.soulShrine).toBe(true);
  });

  it.each([
    {
      name: "whole lifespan equals the threshold",
      options: { lifespanWhole: 40 },
    },
    {
      name: "the emergency chance was already given",
      options: { lifespanWhole: 39, emergencyChanceGiven: true },
    },
    {
      name: "the current battle cycle already contains a Shrine",
      options: { lifespanWhole: 39, shrineSeen: true },
    },
  ] as const)("does not force when $name", ({ options }) => {
    const result = gameplayEngine.step(
      stateGeneratingReplacement({ ...options, random: randomAt(91) }),
      [],
    );

    expect(result.state.encounters.upcoming.at(-1)).toMatchObject({
      kind: "shop",
      shop: "bladesmith",
    });
  });

  it("does not grant another forced Shrine after the first is passed", () => {
    const lifespan = Object.freeze({ whole: 20, fraction: 99 });
    const forced = generateEncounter(
      randomAt(91),
      generationState(),
      4,
      activeRun().player,
      lifespan,
      originalV13RuleSet.constants.encounters,
    );
    const battle = generateEncounter(
      forced.random,
      { ...forced.generation, shopsUntilBattle: 0 },
      4,
      activeRun().player,
      lifespan,
      originalV13RuleSet.constants.encounters,
    );
    const afterPassing = generateEncounter(
      randomAt(91),
      { ...battle.generation, shopsUntilBattle: 1 },
      4,
      activeRun().player,
      lifespan,
      originalV13RuleSet.constants.encounters,
    );

    expect(forced.encounter).toMatchObject({ shop: "soul-shrine" });
    expect(battle.encounter).toMatchObject({ kind: "battle" });
    expect(battle.generation.seenSinceBattle.soulShrine).toBe(false);
    expect(afterPassing.encounter).toMatchObject({ shop: "bladesmith" });
    expect(afterPassing.generation.soulShrine.emergencyChanceGiven).toBe(true);
  });

  it("makes another emergency Shrine eligible after a Shrine purchase", () => {
    const purchase = attemptPurchase(atShrine(), purchaseRules);
    const generated = generateEncounter(
      randomAt(91),
      {
        ...purchase.state.encounters.generation,
        shopsUntilBattle: 1,
        seenSinceBattle: {
          bladesmith: false,
          armorsmith: false,
          soulShrine: false,
        },
      },
      4,
      purchase.state.player,
      { whole: 20, fraction: 99 },
      originalV13RuleSet.constants.encounters,
    );

    expect(generated.encounter).toEqual({
      kind: "shop",
      shop: "soul-shrine",
      cachedPrice: 120,
    });
    expect(generated.generation.soulShrine.emergencyChanceGiven).toBe(true);
  });

  it("replays forced generation with equal random state, events, and hashes", () => {
    const initial = stateGeneratingReplacement({
      lifespanWhole: 39,
      random: randomAt(91),
    });
    const restored = JSON.parse(JSON.stringify(initial)) as RunState;

    const first = gameplayEngine.step(initial, []);
    const replayed = gameplayEngine.step(restored, []);

    expect(replayed).toEqual(first);
    expect(replayed.state.random).toEqual(first.state.random);
    expect(replayed.events).toEqual(first.events);
    expect(fingerprintCanonicalJson(replayed)).toBe(
      fingerprintCanonicalJson(first),
    );
  });
});
