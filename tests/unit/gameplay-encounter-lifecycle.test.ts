import { describe, expect, it } from "vitest";

import type {
  CurrentEncounter,
  EncounterQueueState,
  RunState,
} from "../../src/application/contracts.js";
import {
  ORIGINAL_V13_RULESET_ID,
  originalV13RuleSet,
} from "../../src/domain/rulesets.js";
import { createTestGameplayEngine } from "../helpers/gameplay-engine.js";

const gameplayEngine = createTestGameplayEngine();
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

function createRun(): RunState {
  return gameplayEngine.createRun({
    ruleset: ORIGINAL_V13_RULESET_ID,
    seed: "encounter-lifecycle-seed",
    initialProfile: { schemaVersion: 1, scoreMultiplier: 1 },
  });
}

function stepMany(state: RunState, count: number): RunState {
  let current = state;

  for (let index = 0; index < count; index += 1) {
    current = gameplayEngine.step(current, []).state;
  }

  return current;
}

function readyRun(): RunState {
  const dismissed = gameplayEngine.step(createRun(), [
    { type: "dismiss-tutorial" },
  ]).state;

  return stepMany(dismissed, 59);
}

function withEncounterState(
  state: RunState,
  encounterState: Partial<EncounterQueueState>,
): RunState {
  return {
    ...state,
    encounters: {
      ...state.encounters,
      ...encounterState,
    },
  };
}

function currentShop(x: number): CurrentEncounter {
  return {
    kind: "shop",
    shop: "pharmacy",
    cachedPrice: 150,
    x,
    used: false,
  };
}

describe("original-v1.3 encounter world lifecycle", () => {
  it("owns the confirmed initial and later distance ranges", () => {
    expect(originalV13RuleSet.constants.encounters).toMatchObject({
      initialDistanceBase: 1_000,
      initialDistanceUpperBound: 1_000,
      laterDistanceBase: 1_500,
      laterDistanceUpperBound: 300,
    });
  });

  it("promotes the first queued encounter at x=600 and refills the lookahead", () => {
    const ready = withEncounterState(readyRun(), {
      current: null,
      distanceUntilNext: 1,
      upcoming: [
        { kind: "shop", shop: "pharmacy", cachedPrice: 150 },
        goblinBattle,
        { kind: "shop", shop: "grims-shop", cachedPrice: 200 },
      ],
    });

    const result = gameplayEngine.step(ready, []);

    expect(result.state.encounters.current).toEqual({
      kind: "shop",
      shop: "pharmacy",
      cachedPrice: 150,
      x: 600,
      used: false,
    });
    expect(result.state.encounters.upcoming).toHaveLength(3);
    expect(result.state.encounters.upcoming.slice(0, 2)).toEqual([
      goblinBattle,
      { kind: "shop", shop: "grims-shop", cachedPrice: 200 },
    ]);
    expect(result.state.encounters.distanceUntilNext).toBeGreaterThanOrEqual(
      1_500,
    );
    expect(result.state.encounters.distanceUntilNext).toBeLessThanOrEqual(
      1_799,
    );
    expect(result.events).toContainEqual({
      type: "encounter-promoted",
      encounter: {
        kind: "shop",
        shop: "pharmacy",
        cachedPrice: 150,
        x: 600,
        used: false,
      },
    });
  });

  it("moves shops at half running speed and uses strict action bounds", () => {
    const ready = withEncounterState(
      { ...readyRun(), movementSpeed: 15 },
      { current: currentShop(420), distanceUntilNext: 500 },
    );
    const result = gameplayEngine.step(ready, []);

    expect(result.state.encounters).toMatchObject({
      current: { x: 412.5 },
      distanceUntilNext: 485,
    });
    expect(gameplayEngine.observe(result.state)).toMatchObject({
      encounters: {
        current: {
          kind: "shop",
          shop: "pharmacy",
          cachedPrice: 150,
          x: 412.5,
        },
      },
      actions: { canPurchaseCurrentEncounter: true },
    });

    for (const x of [0, 420]) {
      const boundary = withEncounterState(result.state, {
        current: currentShop(x),
      });
      expect(
        gameplayEngine.observe(boundary).actions.canPurchaseCurrentEncounter,
      ).toBe(false);
    }
  });

  it("removes shops only below x=-100 and emits their departure", () => {
    const atBoundary = withEncounterState(readyRun(), {
      current: currentShop(-100),
      distanceUntilNext: 500,
    });

    expect(gameplayEngine.observe(atBoundary).encounters.current).toMatchObject(
      {
        x: -100,
      },
    );

    const reachesBoundary = gameplayEngine.step(
      withEncounterState(atBoundary, { current: currentShop(-99.5) }),
      [],
    );
    expect(reachesBoundary.state.encounters.current).toMatchObject({ x: -100 });

    const departed = gameplayEngine.step(reachesBoundary.state, []);

    expect(departed.state.encounters.current).toBeNull();
    expect(departed.events).toContainEqual({
      type: "shop-departed",
      shop: "pharmacy",
    });
  });

  it("hands battles off below x=420 and freezes running systems afterward", () => {
    const ready = withEncounterState(readyRun(), {
      current: { ...goblinBattle, x: 421 },
      distanceUntilNext: 500,
    });
    const atBoundary = gameplayEngine.step(ready, []);

    expect(atBoundary.state).toMatchObject({
      distance: ready.distance + 1,
      encounters: {
        current: { kind: "battle", x: 420 },
        distanceUntilNext: 499,
      },
      lifecycle: { phase: "running" },
    });
    expect(atBoundary.events).not.toContainEqual({ type: "battle-handoff" });

    const handoff = gameplayEngine.step(atBoundary.state, []);

    expect(handoff.state).toMatchObject({
      distance: ready.distance + 3,
      activeTicks: ready.activeTicks + 2,
      encounters: {
        current: { kind: "battle", x: 418 },
        distanceUntilNext: 497,
      },
      lifecycle: { phase: "battle-handoff" },
    });
    expect(handoff.events).toContainEqual({ type: "battle-handoff" });

    const held = gameplayEngine.step(handoff.state, []).state;

    expect(held).toMatchObject({
      distance: handoff.state.distance,
      day: handoff.state.day,
      activeTicks: handoff.state.activeTicks + 1,
      encounters: handoff.state.encounters,
    });
    expect(held.lifespan).not.toEqual(handoff.state.lifespan);
  });

  it("freezes countdowns and positions behind tutorial and pause gates", () => {
    const encounterState = {
      current: currentShop(300),
      distanceUntilNext: 500,
    } as const;
    const tutorialGated = withEncounterState(createRun(), encounterState);
    const pauseReady = withEncounterState(readyRun(), encounterState);
    const paused = gameplayEngine.step(pauseReady, [
      { type: "toggle-pause" },
    ]).state;

    expect(gameplayEngine.step(tutorialGated, []).state.encounters).toEqual(
      tutorialGated.encounters,
    );
    expect(gameplayEngine.step(paused, []).state.encounters).toEqual(
      paused.encounters,
    );
    expect(
      gameplayEngine.observe(tutorialGated).actions.canPurchaseCurrentEncounter,
    ).toBe(false);
    expect(
      gameplayEngine.observe(paused).actions.canPurchaseCurrentEncounter,
    ).toBe(false);
  });
});
