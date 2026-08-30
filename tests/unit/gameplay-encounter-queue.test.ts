import { describe, expect, it } from "vitest";

import type {
  EncounterGenerationState,
  PlayerState,
  RandomState,
  RunState,
  ShopEncounter,
} from "../../src/domain/contracts.js";
import {
  generateEncounter,
  initializeEncounterQueue,
} from "../../src/domain/encounters.js";
import { RANDOM_ALGORITHM } from "../../src/domain/random.js";
import {
  ORIGINAL_V13_RULESET_ID,
  originalV13RuleSet,
} from "../../src/domain/rulesets.js";
import { createTestGameplayEngine } from "../helpers/gameplay-engine.js";

const gameplayEngine = createTestGameplayEngine();
const encounterRules = originalV13RuleSet.constants.encounters;
const player: PlayerState = Object.freeze({
  gold: 300,
  weapon: Object.freeze({ tier: 1, name: "Dagger", attack: 216 }),
  armor: Object.freeze({ tier: 1, name: "Clothing" }),
  hp: Object.freeze({ current: 1_908, maximum: 1_908 }),
  inventory: Object.freeze({ item: "elixir" }),
});
const emptyGeneration: EncounterGenerationState = Object.freeze({
  shopsUntilBattle: 1,
  seenSinceBattle: Object.freeze({
    bladesmith: false,
    armorsmith: false,
    soulShrine: false,
  }),
  soulShrine: Object.freeze({
    extensions: 0,
    emergencyThreshold: 40,
    emergencyChanceGiven: false,
  }),
});
const fullLifespan = Object.freeze({ whole: 99, fraction: 99 });

function randomAt(state: number): RandomState {
  return Object.freeze({ algorithm: RANDOM_ALGORITHM, state });
}

function requireShop(encounter: unknown): ShopEncounter {
  expect(encounter).toMatchObject({ kind: "shop" });
  return encounter as ShopEncounter;
}

describe("original-v1.3 encounter queue", () => {
  it("creates three queued entries through the confirmed initial draw order", () => {
    const initialized = initializeEncounterQueue(
      randomAt(0),
      1,
      player,
      fullLifespan,
      encounterRules,
    );

    expect(initialized.encounters.upcoming).toEqual([
      { kind: "battle" },
      { kind: "shop", shop: "pharmacy", cachedPrice: 150 },
      { kind: "battle" },
    ]);
    expect(initialized.encounters.generation).toEqual({
      shopsUntilBattle: 1,
      seenSinceBattle: {
        bladesmith: false,
        armorsmith: false,
        soulShrine: false,
      },
      soulShrine: {
        extensions: 0,
        emergencyThreshold: 45,
        emergencyChanceGiven: false,
      },
    });
    expect(initialized.encounters.current).toBeNull();
    expect(initialized.encounters.distanceUntilNext).toBe(1_467);
    expect(initialized.random).toEqual(randomAt(2_399_460_286));
    expect(Object.isFrozen(initialized.encounters)).toBe(true);
    expect(Object.isFrozen(initialized.encounters.upcoming)).toBe(true);
    expect(
      initialized.encounters.upcoming.every((entry) => Object.isFrozen(entry)),
    ).toBe(true);
  });

  it.each([
    [35, 0, "voucher-store", 500],
    [19, 5, "voucher-store", 500],
    [46, 6, "grims-shop", 200],
    [65, 10, "grims-shop", 200],
    [135, 11, "pharmacy", 150],
    [54, 25, "pharmacy", 150],
    [0, 26, "soul-shrine", 50],
    [200, 30, "soul-shrine", 50],
    [60, 31, "armorsmith", 204],
    [142, 65, "armorsmith", 204],
    [91, 66, "bladesmith", 236],
    [43, 99, "bladesmith", 236],
  ] as const)(
    "maps roll state %i to boundary %i as %s",
    (randomState, _roll, expectedShop, expectedPrice) => {
      const generated = generateEncounter(
        randomAt(randomState),
        emptyGeneration,
        4,
        player,
        fullLifespan,
        encounterRules,
      );
      const encounter = requireShop(generated.encounter);

      expect(encounter.shop).toBe(expectedShop);
      expect(encounter.cachedPrice).toBe(expectedPrice);
      expect(generated.generation.shopsUntilBattle).toBe(0);
    },
  );

  it("rerolls an early-day Voucher candidate without accepting it", () => {
    const generated = generateEncounter(
      randomAt(15_601),
      emptyGeneration,
      3,
      player,
      fullLifespan,
      encounterRules,
    );

    expect(generated.encounter).toEqual({
      kind: "shop",
      shop: "grims-shop",
      cachedPrice: 200,
    });
    expect(generated.random).toEqual(randomAt(3_663_147_227));
  });

  it("rerolls duplicate equipment and Shrine candidates within a battle cycle", () => {
    const afterBladesmith: EncounterGenerationState = Object.freeze({
      ...emptyGeneration,
      shopsUntilBattle: 1,
      seenSinceBattle: Object.freeze({
        ...emptyGeneration.seenSinceBattle,
        bladesmith: true,
      }),
    });
    const afterArmorsmith: EncounterGenerationState = Object.freeze({
      ...emptyGeneration,
      shopsUntilBattle: 1,
      seenSinceBattle: Object.freeze({
        ...emptyGeneration.seenSinceBattle,
        armorsmith: true,
      }),
    });
    const afterShrine: EncounterGenerationState = Object.freeze({
      ...emptyGeneration,
      shopsUntilBattle: 1,
      seenSinceBattle: Object.freeze({
        ...emptyGeneration.seenSinceBattle,
        soulShrine: true,
      }),
    });

    expect(
      generateEncounter(
        randomAt(4_291),
        afterBladesmith,
        4,
        player,
        fullLifespan,
        encounterRules,
      ).encounter,
    ).toMatchObject({ shop: "armorsmith" });
    expect(
      generateEncounter(
        randomAt(654),
        afterArmorsmith,
        4,
        player,
        fullLifespan,
        encounterRules,
      ).encounter,
    ).toMatchObject({ shop: "soul-shrine" });
    expect(
      generateEncounter(
        randomAt(1_485),
        afterShrine,
        4,
        player,
        fullLifespan,
        encounterRules,
      ).encounter,
    ).toMatchObject({ shop: "pharmacy" });
  });

  it("allows item shops to repeat within a battle cycle", () => {
    const first = generateEncounter(
      randomAt(8_309),
      Object.freeze({
        ...emptyGeneration,
        shopsUntilBattle: 2,
      }),
      4,
      player,
      fullLifespan,
      encounterRules,
    );
    const second = generateEncounter(
      first.random,
      first.generation,
      4,
      player,
      fullLifespan,
      encounterRules,
    );

    expect(first.encounter).toMatchObject({ shop: "pharmacy" });
    expect(second.encounter).toMatchObject({ shop: "pharmacy" });
  });

  it("queues a battle, resets duplicate flags, and defers enemy draws", () => {
    const generated = generateEncounter(
      randomAt(2),
      Object.freeze({
        ...emptyGeneration,
        shopsUntilBattle: 0,
        seenSinceBattle: Object.freeze({
          bladesmith: true,
          armorsmith: true,
          soulShrine: true,
        }),
      }),
      1,
      player,
      fullLifespan,
      encounterRules,
    );

    expect(generated.encounter).toEqual({ kind: "battle" });
    expect(generated.encounter).not.toHaveProperty("enemy");
    expect(generated.generation).toEqual({
      shopsUntilBattle: 3,
      seenSinceBattle: {
        bladesmith: false,
        armorsmith: false,
        soulShrine: false,
      },
      soulShrine: emptyGeneration.soulShrine,
    });
    expect(generated.random).toEqual(randomAt(1_831_565_815));
  });

  it("keeps generation-time equipment prices on already queued entries", () => {
    const queuedAtTierOne = generateEncounter(
      randomAt(91),
      emptyGeneration,
      4,
      player,
      fullLifespan,
      encounterRules,
    );
    const tierFourPlayer: PlayerState = Object.freeze({
      ...player,
      weapon: Object.freeze({ tier: 4, name: "Falchion", attack: 477 }),
    });
    const queuedAtTierFour = generateEncounter(
      randomAt(91),
      emptyGeneration,
      4,
      tierFourPlayer,
      fullLifespan,
      encounterRules,
    );

    expect(requireShop(queuedAtTierOne.encounter).cachedPrice).toBe(236);
    expect(requireShop(queuedAtTierFour.encounter).cachedPrice).toBe(344);
    expect(requireShop(queuedAtTierOne.encounter).cachedPrice).toBe(236);
  });

  it("starts the world lifecycle with a public queue and a confirmed distance counter", () => {
    const config = Object.freeze({
      ruleset: ORIGINAL_V13_RULESET_ID,
      seed: "encounter-queue-seed",
      initialProfile: Object.freeze({ schemaVersion: 1, scoreMultiplier: 1 }),
    });
    const initial = gameplayEngine.createRun(config);
    const repeated = gameplayEngine.createRun(config);
    const restored = JSON.parse(JSON.stringify(initial)) as RunState;

    expect(initial.schemaVersion).toBe(10);
    expect(initial.encounters.current).toBeNull();
    expect(initial.encounters.distanceUntilNext).toBeGreaterThanOrEqual(1_000);
    expect(initial.encounters.distanceUntilNext).toBeLessThanOrEqual(1_999);
    expect(initial.encounters.upcoming).toHaveLength(3);
    expect(repeated).toEqual(initial);
    expect(gameplayEngine.step(restored, [])).toEqual(
      gameplayEngine.step(initial, []),
    );
    expect(gameplayEngine.observe(initial)).toMatchObject({
      encounters: {
        current: null,
        upcoming: initial.encounters.upcoming,
      },
      actions: {
        canPurchaseCurrentEncounter: false,
      },
    });
    expect(gameplayEngine.observe(initial).encounters).not.toHaveProperty(
      "distanceUntilNext",
    );
    expect(gameplayEngine.observe(initial).encounters).not.toHaveProperty(
      "generation",
    );
    expect(gameplayEngine.observe(initial)).not.toHaveProperty("random");
  });
});
