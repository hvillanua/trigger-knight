import { expect, it } from "vitest";

import {
  createHudView,
  describeAccessibleGameEvent,
  describeGameEvent,
} from "../../src/browser/hud.js";
import type { GameEvent } from "../../src/application/contracts.js";
import { ORIGINAL_V13_RULESET_ID } from "../../src/domain/rulesets.js";
import { createTestGameplayEngine } from "../helpers/gameplay-engine.js";

it("projects public player values and generic queued battles into readable HUD data", () => {
  const engine = createTestGameplayEngine();
  const state = engine.createRun({
    ruleset: ORIGINAL_V13_RULESET_ID,
    seed: "hud-projection",
    initialProfile: { schemaVersion: 1, scoreMultiplier: 1 },
  });
  const observation = engine.observe(state);
  const view = createHudView(observation);

  expect(Object.keys(view)).toEqual([
    "player",
    "currentEncounter",
    "upcomingEncounters",
    "context",
    "battle",
  ]);
  expect(view.player).toEqual({
    hp: "1,908/1,908",
    lifespan: "99.99%",
    gold: "300",
    weapon: "Dagger · ATK 216",
    armor: "Clothing",
    item: "Elixir",
    score: "0",
    day: "1",
  });
  expect(view.currentEncounter).toEqual({
    label: "No current encounter",
    detail: "The next encounter is ahead.",
  });
  expect(view.upcomingEncounters).toHaveLength(3);
  expect(
    view.upcomingEncounters.some((entry) => entry.label === "Battle"),
  ).toBe(true);
  expect(
    view.upcomingEncounters.map(({ label }) => label).join(" "),
  ).not.toContain("goblin");
  expect(view.battle).toBeNull();
});

it("communicates an ineligible max-tier shop without making it purchasable", () => {
  const engine = createTestGameplayEngine();
  const state = engine.createRun({
    ruleset: ORIGINAL_V13_RULESET_ID,
    seed: "hud-max-tier",
    initialProfile: { schemaVersion: 1, scoreMultiplier: 1 },
  });
  const observation = engine.observe({
    ...state,
    player: {
      ...state.player,
      weapon: { ...state.player.weapon, tier: 10, name: "Astral Sword" },
    },
    encounters: {
      ...state.encounters,
      current: {
        kind: "shop",
        shop: "bladesmith",
        cachedPrice: 524,
        x: 200,
        used: false,
      },
    },
    lifecycle: {
      ...state.lifecycle,
      tutorialPage: null,
      pregameStepsRemaining: 0,
    },
  });
  const view = createHudView(observation);

  expect(observation.actions.canPurchaseCurrentEncounter).toBe(false);
  expect(view.context.warning).toContain("maximum tier");
  expect(view.context.actionEnabled).toBe(false);
});

it("keeps repeated combat updates out of the live accessibility announcement", () => {
  const hit: GameEvent = {
    type: "combat-hit",
    attacker: "hero",
    target: "enemy",
    damage: 216,
    critical: false,
    remainingHp: 784,
  };
  const purchase: GameEvent = {
    type: "shop-purchased",
    shop: "bladesmith",
    price: 300,
  };

  expect(describeGameEvent(hit)).toContain("hit");
  expect(describeAccessibleGameEvent(hit)).toBe("");
  expect(describeAccessibleGameEvent(purchase)).toContain("Purchased");
});
