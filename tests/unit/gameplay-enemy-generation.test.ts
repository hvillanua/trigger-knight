import { describe, expect, it } from "vitest";

import type {
  EncounterGenerationState,
  PlayerState,
  RandomState,
  RunState,
} from "../../src/domain/contracts.js";
import { generateEncounter } from "../../src/domain/encounters.js";
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
const fullLifespan = Object.freeze({ whole: 99, fraction: 99 });

function randomAt(state: number): RandomState {
  return Object.freeze({ algorithm: RANDOM_ALGORITHM, state });
}

function battleGeneration(
  dragonSpawned = false,
): EncounterGenerationState & { readonly dragonSpawned: boolean } {
  return Object.freeze({
    shopsUntilBattle: 0,
    dragonSpawned,
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
}

describe("original-v1.3 enemy generation", () => {
  it.each([
    [0, "goblin", 660, 122, 82, 13],
    [35, "golem", 980, 68, 92, 13],
    [5, "wolf", 494, 150, 92, 13],
  ] as const)(
    "maps random state %i to the day-1 %s enemy",
    (randomState, enemy, maximumHp, attack, goldReward, profileExp) => {
      const generated = generateEncounter(
        randomAt(randomState),
        battleGeneration(),
        1,
        player,
        fullLifespan,
        encounterRules,
      );

      expect(generated.encounter).toEqual({
        kind: "battle",
        enemy: { id: enemy, maximumHp, attack, goldReward, profileExp },
      });
      expect(generated.random).toEqual(randomAt(randomState + 3_663_131_626));
    },
  );

  it.each([
    [0, "goblin", 1_800, 882, 310, 70],
    [35, "golem", 3_260, 600, 358, 89],
    [5, "wolf", 1_330, 1_214, 358, 108],
  ] as const)(
    "scales random state %i to the day-20 %s enemy",
    (randomState, enemy, maximumHp, attack, goldReward, profileExp) => {
      const generated = generateEncounter(
        randomAt(randomState),
        battleGeneration(true),
        20,
        player,
        fullLifespan,
        encounterRules,
      );

      expect(generated.encounter).toEqual({
        kind: "battle",
        enemy: { id: enemy, maximumHp, attack, goldReward, profileExp },
      });
      expect(generated.generation.dragonSpawned).toBe(true);
    },
  );

  it("uses the confirmed Dragon day boundary and selected draw order", () => {
    const beforeRolls = generateEncounter(
      randomAt(5),
      battleGeneration(),
      6,
      player,
      fullLifespan,
      encounterRules,
    );
    const zeroPercent = generateEncounter(
      randomAt(5),
      battleGeneration(),
      7,
      player,
      fullLifespan,
      encounterRules,
    );
    const threePercentSuccess = generateEncounter(
      randomAt(91),
      battleGeneration(),
      8,
      player,
      fullLifespan,
      encounterRules,
    );
    const threePercentFailure = generateEncounter(
      randomAt(3),
      battleGeneration(),
      8,
      player,
      fullLifespan,
      encounterRules,
    );
    const ninetyNinePercentFailure = generateEncounter(
      randomAt(37),
      battleGeneration(),
      40,
      player,
      fullLifespan,
      encounterRules,
    );
    const guaranteed = generateEncounter(
      randomAt(37),
      battleGeneration(),
      41,
      player,
      fullLifespan,
      encounterRules,
    );

    expect(beforeRolls.encounter).toMatchObject({
      enemy: { id: "wolf" },
    });
    expect(beforeRolls.random).toEqual(randomAt(3_663_131_631));
    expect(zeroPercent.encounter).toMatchObject({
      enemy: { id: "goblin" },
    });
    expect(zeroPercent.random).toEqual(randomAt(1_199_730_148));
    expect(threePercentSuccess.encounter).toMatchObject({
      enemy: {
        id: "dragon",
        maximumHp: 4_800,
        attack: 800,
        goldReward: 830,
        profileExp: 240,
      },
    });
    expect(threePercentSuccess.random).toEqual(randomAt(3_663_131_717));
    expect(threePercentFailure.encounter).toMatchObject({
      enemy: { id: "golem" },
    });
    expect(threePercentFailure.random).toEqual(randomAt(1_199_730_146));
    expect(ninetyNinePercentFailure.encounter).toMatchObject({
      enemy: { id: "goblin" },
    });
    expect(ninetyNinePercentFailure.random).toEqual(randomAt(1_199_730_180));
    expect(guaranteed.encounter).toMatchObject({
      enemy: {
        id: "dragon",
        maximumHp: 14_700,
        attack: 3_440,
        goldReward: 2_810,
        profileExp: 1_065,
      },
    });
    expect(guaranteed.random).toEqual(randomAt(3_663_131_663));
  });

  it("prevents queued Dragons until an ordinary enemy becomes current", () => {
    const dragon = generateEncounter(
      randomAt(37),
      battleGeneration(),
      41,
      player,
      fullLifespan,
      encounterRules,
    );
    const followingBattle = generateEncounter(
      randomAt(91),
      { ...dragon.generation, shopsUntilBattle: 0 },
      41,
      player,
      fullLifespan,
      encounterRules,
    );

    expect(dragon.generation).toMatchObject({ dragonSpawned: true });
    expect(followingBattle.encounter).toMatchObject({
      enemy: { id: "goblin" },
    });
    expect(followingBattle.generation).toMatchObject({ dragonSpawned: true });

    const initial = gameplayEngine.createRun({
      ruleset: ORIGINAL_V13_RULESET_ID,
      seed: "dragon-current-reset",
      initialProfile: { schemaVersion: 1, scoreMultiplier: 1 },
    });
    const ready = {
      ...initial,
      activeTicks: 1,
      day: 41,
      encounters: {
        ...initial.encounters,
        current: null,
        distanceUntilNext: 0,
        upcoming: [followingBattle.encounter, ...initial.encounters.upcoming],
        generation: {
          ...followingBattle.generation,
          shopsUntilBattle: 1,
        },
      },
      lifecycle: {
        ...initial.lifecycle,
        tutorialPage: null,
        pregameStepsRemaining: 0,
      },
    } as RunState;
    const promotion = gameplayEngine.step(ready, []);
    const promoted = promotion.state;

    expect(promoted.encounters.current).toMatchObject({
      enemy: { id: "goblin" },
    });
    expect(promoted.encounters.generation).toMatchObject({
      dragonSpawned: false,
    });
    expect(promotion.events).toContainEqual({
      type: "encounter-promoted",
      encounter: {
        kind: "battle",
        enemy: {
          id: "goblin",
          maximumHp: 3_060,
        },
        x: 600,
      },
    });
  });

  it("keeps queued enemy identity hidden until the battle is current", () => {
    const state = gameplayEngine.createRun({
      ruleset: ORIGINAL_V13_RULESET_ID,
      seed: "hidden-queued-enemy",
      initialProfile: { schemaVersion: 1, scoreMultiplier: 1 },
    });
    const battleIndex = state.encounters.upcoming.findIndex(
      (encounter) => encounter.kind === "battle",
    );
    const queuedBattle = state.encounters.upcoming[battleIndex];
    const observedBattle =
      gameplayEngine.observe(state).encounters.upcoming[battleIndex];

    expect(battleIndex).toBeGreaterThanOrEqual(0);
    expect(queuedBattle).toHaveProperty("enemy");
    if (queuedBattle?.kind !== "battle") {
      throw new Error("Expected an authoritative queued battle");
    }
    expect(Object.isFrozen(queuedBattle.enemy)).toBe(true);
    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
    expect(observedBattle).toEqual({ kind: "battle" });
    const currentState: RunState = {
      ...state,
      encounters: {
        ...state.encounters,
        current: { ...queuedBattle, x: 600 },
      },
    };
    expect(gameplayEngine.observe(currentState).encounters.current).toEqual({
      kind: "battle",
      enemy: {
        id: queuedBattle.enemy.id,
        maximumHp: queuedBattle.enemy.maximumHp,
      },
      x: 600,
    });
    expect(state.encounters.generation).not.toHaveProperty("enemy");
    expect(gameplayEngine.observe(state).encounters).not.toHaveProperty(
      "generation",
    );
  });

  it("refreezes enemy snapshots after stepping a restored checkpoint", () => {
    const state = gameplayEngine.createRun({
      ruleset: ORIGINAL_V13_RULESET_ID,
      seed: "restored-enemy-snapshot",
      initialProfile: { schemaVersion: 1, scoreMultiplier: 1 },
    });
    const restored = JSON.parse(JSON.stringify(state)) as RunState;

    const stepped = gameplayEngine.step(restored, []).state;
    const battle = stepped.encounters.upcoming.find(
      (encounter) => encounter.kind === "battle",
    );

    expect(stepped).toEqual(gameplayEngine.step(state, []).state);
    expect(battle?.kind).toBe("battle");
    if (battle?.kind !== "battle") {
      throw new Error("Expected a restored queued battle");
    }
    expect(Object.isFrozen(battle)).toBe(true);
    expect(Object.isFrozen(battle.enemy)).toBe(true);
    expect(Object.isFrozen(stepped.encounters.generation)).toBe(true);
    expect(Object.isFrozen(stepped.encounters.generation.seenSinceBattle)).toBe(
      true,
    );
  });
});
