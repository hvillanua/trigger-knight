import { describe, expect, it } from "vitest";

import type { RunConfig, RunState } from "../../src/application/contracts.js";
import { ORIGINAL_V13_RULESET_ID } from "../../src/domain/rulesets.js";
import { createTestGameplayEngine } from "../helpers/gameplay-engine.js";

const gameplayEngine = createTestGameplayEngine();

function config(): RunConfig {
  return {
    ruleset: ORIGINAL_V13_RULESET_ID,
    seed: "battle-entry-seed",
    initialProfile: { schemaVersion: 1, scoreMultiplier: 1 },
  };
}

function activeBattleState(): {
  readonly state: RunState;
  readonly enemyMaximumHp: number;
} {
  const initial = gameplayEngine.createRun(config());
  const queuedBattle = initial.encounters.upcoming.find(
    (encounter) => encounter.kind === "battle",
  );

  if (queuedBattle === undefined || queuedBattle.kind !== "battle") {
    throw new Error("Expected a queued battle fixture");
  }

  return {
    state: {
      ...initial,
      movementSpeed: 15,
      encounters: {
        ...initial.encounters,
        current: { ...queuedBattle, x: 421 },
        distanceUntilNext: 500,
      },
      lifecycle: {
        ...initial.lifecycle,
        tutorialPage: null,
        pregameStepsRemaining: 0,
      },
    },
    enemyMaximumHp: queuedBattle.enemy.maximumHp,
  };
}

describe("original-v1.3 battle entry", () => {
  it("starts active combat with initialized actors and a safe public projection", () => {
    const { state, enemyMaximumHp } = activeBattleState();
    const result = gameplayEngine.step(state, []);

    expect(result.state).toMatchObject({
      movementSpeed: 15,
      distance: state.distance + 15,
      lifecycle: { phase: "battling" },
      battle: {
        enemyHp: enemyMaximumHp,
        enemyGoldMultiplier: 1,
        hero: {
          phase: "idle",
          x: 50,
          attackDelay: 0,
          attackFactor: 1,
          attackCount: 0,
          alpha: 100,
        },
        enemy: {
          phase: "idle",
          x: 406,
          attackDelay: 0,
          attackFactor: 1,
          attackCount: 0,
          alpha: 100,
        },
      },
    });
    expect(result.events).toContainEqual({
      type: "battle-started",
      enemy: {
        id:
          result.state.encounters.current?.kind === "battle"
            ? result.state.encounters.current.enemy.id
            : "goblin",
        maximumHp: enemyMaximumHp,
        currentHp: enemyMaximumHp,
      },
    });

    const observation = gameplayEngine.observe(result.state);
    expect(observation.lifecycle.phase).toBe("battling");
    expect(observation.battle).toEqual({
      enemy: {
        id:
          result.state.encounters.current?.kind === "battle"
            ? result.state.encounters.current.enemy.id
            : "goblin",
        maximumHp: enemyMaximumHp,
        currentHp: enemyMaximumHp,
      },
      actors: {
        hero: { phase: "idle", x: 50 },
        enemy: { phase: "idle", x: 406 },
      },
    });
    expect(Object.keys(observation.battle ?? {})).toEqual(["enemy", "actors"]);
    expect(Object.keys(observation.battle?.enemy ?? {})).toEqual([
      "id",
      "maximumHp",
      "currentHp",
    ]);
    expect(Object.keys(observation.battle?.actors.hero ?? {})).toEqual([
      "phase",
      "x",
    ]);
    expect(Object.keys(observation.battle?.actors.enemy ?? {})).toEqual([
      "phase",
      "x",
    ]);
    expect(observation).not.toHaveProperty("random");
    expect(observation.battle).not.toHaveProperty("enemy.attack");
  });

  it("decays running speed during battle without advancing running systems", () => {
    const { state } = activeBattleState();
    const started = gameplayEngine.step(state, []).state;
    const next = gameplayEngine.step(started, []);

    expect(next.state).toMatchObject({
      movementSpeed: 14,
      distance: started.distance,
      day: started.day,
      score: started.score,
      encounters: started.encounters,
      lifecycle: { phase: "battling" },
    });
    expect(next.state.activeTicks).toBe(started.activeTicks + 1);
    expect(next.state.lifespan).not.toEqual(started.lifespan);
  });

  it("freezes combat, speed decay, and lifespan behind pause and tutorial gates", () => {
    const { state } = activeBattleState();
    const started = gameplayEngine.step(state, []).state;
    const paused = gameplayEngine.step(started, [
      { type: "toggle-pause" },
    ]).state;
    const pausedTick = gameplayEngine.step(paused, []).state;
    const tutorial = {
      ...started,
      lifecycle: { ...started.lifecycle, tutorialPage: 0 as const },
    };
    const tutorialTick = gameplayEngine.step(tutorial, []).state;

    expect(pausedTick).toMatchObject({
      movementSpeed: started.movementSpeed,
      activeTicks: started.activeTicks,
      lifespan: started.lifespan,
      battle: started.battle,
      lifecycle: { phase: "battling", paused: true },
    });
    expect(tutorialTick).toMatchObject({
      movementSpeed: started.movementSpeed,
      activeTicks: started.activeTicks,
      lifespan: started.lifespan,
      battle: started.battle,
      lifecycle: { phase: "battling", tutorialPage: 0 },
    });

    const dismissed = gameplayEngine.step(tutorial, [
      { type: "dismiss-tutorial" },
    ]);
    expect(dismissed.events).toContainEqual({
      type: "tutorial-dismissed",
      page: 0,
    });
  });
});
