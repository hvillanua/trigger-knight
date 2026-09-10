import { describe, expect, it } from "vitest";

import type { RunConfig, RunState } from "../../src/application/contracts.js";
import { ORIGINAL_V13_RULESET_ID } from "../../src/domain/rulesets.js";
import { createTestGameplayEngine } from "../helpers/gameplay-engine.js";

const gameplayEngine = createTestGameplayEngine();

const config: RunConfig = Object.freeze({
  ruleset: ORIGINAL_V13_RULESET_ID,
  seed: "economy-loadout-seed",
  initialProfile: Object.freeze({ schemaVersion: 1, scoreMultiplier: 1 }),
});

const initialPlayer = {
  gold: 300,
  weapon: {
    tier: 1,
    name: "Dagger",
    attack: 216,
  },
  armor: {
    tier: 1,
    name: "Clothing",
  },
  hp: {
    current: 1_908,
    maximum: 1_908,
  },
  inventory: {
    item: "elixir",
  },
} as const;

describe("original-v1.3 economy and loadout", () => {
  it("starts and observes the confirmed player-facing values", () => {
    const state = gameplayEngine.createRun(config);
    const observation = gameplayEngine.observe(state);

    expect(state).toMatchObject({
      schemaVersion: 17,
      player: initialPlayer,
    });
    expect(observation.player).toEqual(initialPlayer);
    expect(Object.isFrozen(observation.player)).toBe(true);
    expect(Object.isFrozen(observation.player.inventory)).toBe(true);
    expect(observation).not.toHaveProperty("random");
    expect(observation).not.toHaveProperty("encounterQueue");
  });

  it("keeps authoritative player state immutable, serializable, and deterministic", () => {
    const initial = gameplayEngine.createRun(config);
    const repeated = gameplayEngine.createRun(config);
    const restored = JSON.parse(JSON.stringify(initial)) as RunState;

    expect(repeated).toEqual(initial);
    expect(restored).toEqual(initial);
    expect(Object.isFrozen(initial.player)).toBe(true);
    expect(Object.isFrozen(initial.player.weapon)).toBe(true);
    expect(Object.isFrozen(initial.player.armor)).toBe(true);
    expect(Object.isFrozen(initial.player.hp)).toBe(true);
    expect(Object.isFrozen(initial.player.inventory)).toBe(true);

    const uninterrupted = gameplayEngine.step(initial, []);
    const resumed = gameplayEngine.step(restored, []);

    expect(resumed).toEqual(uninterrupted);
    expect(uninterrupted.state.player).toEqual(initialPlayer);
    expect(gameplayEngine.observe(resumed.state)).toEqual(
      gameplayEngine.observe(uninterrupted.state),
    );
  });
});
