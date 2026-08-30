import { describe, expect, it } from "vitest";

import type {
  EncounterGenerationState,
  PlayerState,
  RunState,
} from "../../src/domain/contracts.js";
import { generateEncounter } from "../../src/domain/encounters.js";
import { RANDOM_ALGORITHM } from "../../src/domain/random.js";
import { originalV13RuleSet } from "../../src/domain/rulesets.js";
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
const fullLifespan = Object.freeze({ whole: 99, fraction: 99 });
const battleGeneration: EncounterGenerationState = Object.freeze({
  shopsUntilBattle: 0,
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
  dragonSpawned: false,
});

function randomAt(state: number) {
  return Object.freeze({ algorithm: RANDOM_ALGORITHM, state });
}

describe("original-v1.3 enemy selection", () => {
  it("stores a uniformly selected ordinary enemy with day-scaled rewards", () => {
    const generated = generateEncounter(
      randomAt(2),
      battleGeneration,
      1,
      player,
      fullLifespan,
      encounterRules,
    );

    expect(generated.encounter).toEqual({
      kind: "battle",
      enemy: {
        id: "goblin",
        maxHp: 660,
        attack: 122,
        gold: 82,
        profileExp: 13,
      },
    });
    expect(generated.generation).toMatchObject({ dragonSpawned: false });
    expect(generated.random).toEqual(randomAt(3_663_131_628));
  });

  it.each([
    [0, "goblin", 6, 960, 322, 142, 28],
    [8, "golem", 6, 1_580, 208, 162, 33],
    [5, "wolf", 6, 714, 430, 162, 38],
  ] as const)(
    "scales %s-selected %s stats from day %s",
    (randomState, id, day, maxHp, attack, gold, profileExp) => {
      const generated = generateEncounter(
        randomAt(randomState),
        battleGeneration,
        day,
        player,
        fullLifespan,
        encounterRules,
      );

      expect(generated.encounter).toMatchObject({
        kind: "battle",
        enemy: { id, maxHp, attack, gold, profileExp },
      });
    },
  );

  it("uses the eligible Dragon chance and records its anti-repeat state", () => {
    const generated = generateEncounter(
      randomAt(27),
      battleGeneration,
      8,
      player,
      fullLifespan,
      encounterRules,
    );

    expect(generated.encounter).toMatchObject({
      kind: "battle",
      enemy: {
        id: "dragon",
        maxHp: 4_800,
        attack: 800,
        gold: 830,
        profileExp: 240,
      },
    });
    expect(generated.generation).toMatchObject({ dragonSpawned: true });
    expect(generated.random).toEqual(randomAt(3_663_131_653));

    const blocked = generateEncounter(
      generated.random,
      { ...generated.generation, shopsUntilBattle: 0 },
      8,
      player,
      fullLifespan,
      encounterRules,
    );

    expect(blocked.encounter.kind).toBe("battle");
    if (blocked.encounter.kind !== "battle") {
      throw new Error("Expected an ordinary battle");
    }
    expect(blocked.encounter.enemy.id).not.toBe("dragon");
    expect(blocked.generation).toMatchObject({ dragonSpawned: true });
    expect(blocked.random).toEqual(randomAt(3_031_295_983));
  });

  it("keeps Dragon unavailable before day 8 and guarantees it from day 41", () => {
    const daySeven = generateEncounter(
      randomAt(27),
      battleGeneration,
      7,
      player,
      fullLifespan,
      encounterRules,
    );
    const dayFortyOne = generateEncounter(
      randomAt(0),
      battleGeneration,
      41,
      player,
      fullLifespan,
      encounterRules,
    );
    const dayForty = generateEncounter(
      randomAt(37),
      battleGeneration,
      40,
      player,
      fullLifespan,
      encounterRules,
    );

    expect(daySeven.encounter.kind).toBe("battle");
    if (daySeven.encounter.kind !== "battle") {
      throw new Error("Expected an ordinary battle");
    }
    expect(daySeven.encounter.enemy.id).not.toBe("dragon");
    expect(daySeven.random).toEqual(randomAt(1_199_730_170));
    expect(dayFortyOne.encounter).toMatchObject({
      kind: "battle",
      enemy: { id: "dragon" },
    });
    expect(dayForty.encounter).toMatchObject({
      kind: "battle",
      enemy: { id: "goblin" },
    });
  });

  it("hides future enemy identities from ordinary observations", () => {
    const state = gameplayEngine.createRun({
      ruleset: originalV13RuleSet.id,
      seed: "enemy-observation-seed",
      initialProfile: { schemaVersion: 1, scoreMultiplier: 1 },
    });
    const battleIndex = state.encounters.upcoming.findIndex(
      (encounter) => encounter.kind === "battle",
    );
    const observation = gameplayEngine.observe(state);

    if (battleIndex < 0) {
      throw new Error("Expected an initial battle entry");
    }
    expect(state.encounters.upcoming[battleIndex]).toHaveProperty("enemy");
    expect(observation.encounters.upcoming[battleIndex]).toEqual({
      kind: "battle",
    });
    expect(observation.encounters.upcoming[battleIndex]).not.toHaveProperty(
      "enemy",
    );
  });

  it("clears the Dragon flag when an ordinary battle becomes current", () => {
    const initial = gameplayEngine.createRun({
      ruleset: originalV13RuleSet.id,
      seed: "dragon-flag-lifecycle-seed",
      initialProfile: { schemaVersion: 1, scoreMultiplier: 1 },
    });
    const ordinaryEnemy = {
      id: "goblin" as const,
      maxHp: 660,
      attack: 122,
      gold: 82,
      profileExp: 13,
    };
    const state: RunState = {
      ...initial,
      movementSpeed: 0,
      encounters: {
        ...initial.encounters,
        current: null,
        distanceUntilNext: 0,
        upcoming: [
          { kind: "battle", enemy: ordinaryEnemy },
          { kind: "shop", shop: "pharmacy", cachedPrice: 150 },
          { kind: "shop", shop: "grims-shop", cachedPrice: 200 },
        ],
        generation: {
          ...initial.encounters.generation,
          shopsUntilBattle: 1,
          dragonSpawned: true,
        },
      },
      lifecycle: {
        ...initial.lifecycle,
        tutorialPage: null,
        pregameStepsRemaining: 0,
      },
    };

    const result = gameplayEngine.step(state, []);

    expect(result.state.encounters.current).toMatchObject({
      kind: "battle",
      enemy: ordinaryEnemy,
    });
    expect(result.state.encounters.generation.dragonSpawned).toBe(false);
  });

  it("freezes and restores generated enemy snapshots", () => {
    const state = gameplayEngine.createRun({
      ruleset: originalV13RuleSet.id,
      seed: "enemy-serialization-seed",
      initialProfile: { schemaVersion: 1, scoreMultiplier: 1 },
    });
    const battle = state.encounters.upcoming.find(
      (encounter) => encounter.kind === "battle",
    );
    if (battle?.kind !== "battle") {
      throw new Error("Expected an initial battle entry");
    }

    expect(Object.isFrozen(battle)).toBe(true);
    expect(Object.isFrozen(battle.enemy)).toBe(true);
    expect(Object.isFrozen(state.encounters.generation)).toBe(true);
    expect(Object.isFrozen(state.encounters.generation.seenSinceBattle)).toBe(
      true,
    );

    const restored = JSON.parse(JSON.stringify(state)) as RunState;
    const stepped = gameplayEngine.step(restored, []);

    expect(stepped.state).toEqual(gameplayEngine.step(state, []).state);
    const restoredBattle = stepped.state.encounters.upcoming.find(
      (encounter) => encounter.kind === "battle",
    );
    if (restoredBattle?.kind !== "battle") {
      throw new Error("Expected a restored battle entry");
    }
    expect(Object.isFrozen(restoredBattle.enemy)).toBe(true);
  });
});
