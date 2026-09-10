import { describe, expect, it } from "vitest";

import type {
  BattleState,
  RunConfig,
  RunState,
} from "../../src/application/contracts.js";
import { ORIGINAL_V13_RULESET_ID } from "../../src/domain/rulesets.js";
import { createTestGameplayEngine } from "../helpers/gameplay-engine.js";

const gameplayEngine = createTestGameplayEngine();

function createRun(
  tutorialPreference: "enabled" | "disabled" = "enabled",
): RunState {
  const config: RunConfig = {
    ruleset: ORIGINAL_V13_RULESET_ID,
    seed: "tutorial-gates-seed",
    initialProfile: {
      schemaVersion: 1,
      scoreMultiplier: 1,
      tutorialPreference,
    },
  };

  return gameplayEngine.createRun(config);
}

function activeRun(state: RunState, patch: Partial<RunState> = {}): RunState {
  return {
    ...state,
    ...patch,
    lifecycle: {
      ...state.lifecycle,
      ...patch.lifecycle,
      tutorialPage: null,
      pregameStepsRemaining: 0,
    },
  };
}

function withShop(
  state: RunState,
  shop: "pharmacy" | "soul-shrine",
  x = 100,
): RunState {
  return activeRun(state, {
    encounters: {
      ...state.encounters,
      current: {
        kind: "shop",
        shop,
        cachedPrice: shop === "pharmacy" ? 150 : 50,
        x,
        used: false,
      },
    },
  });
}

function withPromotableBattle(state: RunState): RunState {
  const queuedBattle = {
    kind: "battle" as const,
    enemy: {
      id: "goblin" as const,
      maximumHp: 660,
      attack: 122,
      goldReward: 82,
      profileExp: 13,
    },
  };

  return activeRun(state, {
    encounters: {
      ...state.encounters,
      current: null,
      distanceUntilNext: 0,
      upcoming: [queuedBattle, ...state.encounters.upcoming.slice(1)],
    },
  });
}

function withLowHpBattle(state: RunState): RunState {
  const current = {
    kind: "battle" as const,
    enemy: {
      id: "goblin" as const,
      maximumHp: 660,
      attack: 122,
      goldReward: 82,
      profileExp: 13,
    },
    x: 50,
  };
  const battle: BattleState = {
    enemyHp: 660,
    enemyGoldMultiplier: 1,
    hero: {
      phase: "idle",
      x: 50,
      attackDelay: 100,
      attackFactor: 1,
      attackCount: 0,
      alpha: 100,
      attackTicks: 0,
      knockback: 0,
    },
    enemy: {
      phase: "attack",
      x: 50,
      attackDelay: 0,
      attackFactor: 1,
      attackCount: 0,
      alpha: 100,
      attackTicks: 5,
      knockback: 0,
    },
  };

  return activeRun(state, {
    player: {
      ...state.player,
      hp: { current: 500, maximum: 1_908 },
    },
    battle,
    encounters: { ...state.encounters, current },
    lifecycle: {
      ...state.lifecycle,
      phase: "battling",
    },
  });
}

describe("original-v1.3 contextual tutorial gates", () => {
  it("opens page 1 when an unused shop enters the strict purchase window", () => {
    const state = withShop(createRun(), "pharmacy");

    const result = gameplayEngine.step(state, []);

    expect(result.state.lifecycle.tutorialPage).toBe(1);
    expect(result.state.activeTicks).toBe(state.activeTicks + 1);
    expect(result.state.encounters.current).toMatchObject({
      kind: "shop",
      shop: "pharmacy",
      used: false,
    });
    expect(result.state.tutorials).toMatchObject({
      preference: "enabled",
      page1Shown: true,
      page2Shown: false,
      page3Shown: false,
      page4Shown: false,
      page5Shown: false,
    });
    expect(Object.isFrozen(result.state.tutorials)).toBe(true);
  });

  it("skips contextual pages when the initial profile disables tutorials", () => {
    const state = withShop(createRun("disabled"), "pharmacy");

    const result = gameplayEngine.step(state, []);

    expect(result.state.lifecycle.tutorialPage).toBeNull();
    expect(result.state.activeTicks).toBe(state.activeTicks + 1);
    expect(result.state.random).toEqual(state.random);
    expect(result.state.tutorials).toMatchObject({
      preference: "disabled",
      page1Shown: false,
      page2Shown: false,
      page3Shown: false,
      page4Shown: false,
      page5Shown: false,
    });
  });

  it("shows the Shrine lesson after the general building lesson on the same persistent shop", () => {
    const first = gameplayEngine.step(withShop(createRun(), "soul-shrine"), []);
    const second = gameplayEngine.step(first.state, [
      { type: "dismiss-tutorial" },
    ]);

    expect(first.state.lifecycle.tutorialPage).toBe(1);
    expect(second.state.lifecycle.tutorialPage).toBe(2);
    expect(second.state.tutorials).toMatchObject({
      page1Shown: true,
      page2Shown: true,
    });
    expect(second.events).toContainEqual({
      type: "tutorial-dismissed",
      page: 1,
    });
  });

  it("keeps all active systems and randomness frozen while a contextual page is open", () => {
    const opened = gameplayEngine.step(withShop(createRun(), "pharmacy"), []);
    const held = gameplayEngine.step(opened.state, []);

    expect(held.state).toMatchObject({
      steps: opened.state.steps + 1,
      activeTicks: opened.state.activeTicks,
      distance: opened.state.distance,
      lifespan: opened.state.lifespan,
      movementSpeed: opened.state.movementSpeed,
      encounters: opened.state.encounters,
      battle: opened.state.battle,
      random: opened.state.random,
      lifecycle: { tutorialPage: 1 },
    });
    expect(held.events).toEqual([
      { type: "step-advanced", step: opened.state.steps + 1 },
    ]);
  });

  it("keeps pause active after dismissing a contextual page", () => {
    const opened = gameplayEngine.step(withShop(createRun(), "pharmacy"), []);
    const paused = gameplayEngine.step(opened.state, [
      { type: "toggle-pause" },
    ]);
    const dismissed = gameplayEngine.step(paused.state, [
      { type: "dismiss-tutorial" },
    ]);
    const resumed = gameplayEngine.step(dismissed.state, [
      { type: "toggle-pause" },
    ]);

    expect(paused.state).toMatchObject({
      activeTicks: opened.state.activeTicks,
      lifecycle: { paused: true, tutorialPage: 1 },
    });
    expect(dismissed.state).toMatchObject({
      activeTicks: opened.state.activeTicks,
      lifecycle: { paused: true, tutorialPage: null },
    });
    expect(resumed.state).toMatchObject({
      activeTicks: opened.state.activeTicks + 1,
      lifecycle: { paused: false, tutorialPage: null },
    });
  });

  it("uses strict shop boundaries before opening page 1", () => {
    const atUpperBoundary = gameplayEngine.step(
      withShop(createRun(), "pharmacy", 420.5),
      [],
    );
    const entersWindow = gameplayEngine.step(atUpperBoundary.state, []);
    const belowLowerBoundary = gameplayEngine.step(
      withShop(createRun(), "pharmacy", 0),
      [],
    );

    expect(atUpperBoundary.state.lifecycle.tutorialPage).toBeNull();
    expect(atUpperBoundary.state.encounters.current).toMatchObject({
      x: 420,
    });
    expect(entersWindow.state.lifecycle.tutorialPage).toBe(1);
    expect(belowLowerBoundary.state.lifecycle.tutorialPage).toBeNull();
  });

  it("opens page 3 when a battle is promoted to the current encounter", () => {
    const state = withPromotableBattle(createRun());

    const result = gameplayEngine.step(state, []);

    expect(result.state.lifecycle.tutorialPage).toBe(3);
    expect(result.events).toContainEqual({
      type: "encounter-promoted",
      encounter: {
        kind: "battle",
        enemy: { id: "goblin", maximumHp: 660 },
        x: 600,
      },
    });
  });

  it("opens page 4 when an active update reaches the 25.00% lifespan boundary", () => {
    const state = activeRun(createRun(), {
      lifespan: { whole: 25, fraction: 3 },
    });

    const result = gameplayEngine.step(state, []);

    expect(result.state.lifecycle.tutorialPage).toBe(4);
    expect(result.state.lifespan).toEqual({ whole: 24, fraction: 99 });
  });

  it("opens page 5 after a nonlethal combat update leaves the hero below 25% HP", () => {
    const state = withLowHpBattle(createRun());

    const result = gameplayEngine.step(state, []);

    expect(result.state.lifecycle.tutorialPage).toBe(5);
    expect(result.state.player.hp.current).toBeGreaterThan(0);
    expect(
      result.events.some(
        (event) =>
          event.type === "combat-hit" &&
          event.attacker === "enemy" &&
          event.target === "hero" &&
          !event.critical &&
          event.remainingHp > 0,
      ),
    ).toBe(true);
  });

  it("gives the lower page index priority when lifespan and HP warnings overlap", () => {
    const state = withLowHpBattle(createRun());
    const lowLifespan = { ...state, lifespan: { whole: 25, fraction: 3 } };

    const first = gameplayEngine.step(lowLifespan, []);
    const second = gameplayEngine.step(first.state, [
      { type: "dismiss-tutorial" },
    ]);

    expect(first.state.lifecycle.tutorialPage).toBe(4);
    expect(first.state.tutorials).toMatchObject({
      page4Shown: true,
      page5Shown: false,
    });
    expect(second.state.lifecycle.tutorialPage).toBe(5);
    expect(second.state.tutorials.page5Shown).toBe(true);
  });

  it("keeps tutorial markers out of the exact player-facing observation shape", () => {
    const result = gameplayEngine.step(withShop(createRun(), "pharmacy"), []);
    const observation = gameplayEngine.observe(result.state);

    expect(observation.lifecycle).toEqual({
      phase: "running",
      terminalReason: null,
      paused: false,
      tutorialPage: 1,
      pregameStepsRemaining: 0,
      activeGameplay: false,
    });
    expect(observation.lifecycle).not.toHaveProperty("tutorials");
    expect(observation).not.toHaveProperty("tutorials");
    expect(observation).not.toHaveProperty("page1Shown");
  });
});
