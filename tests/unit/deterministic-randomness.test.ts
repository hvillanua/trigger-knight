import { describe, expect, it } from "vitest";

import type { RandomState, RunState } from "../../src/domain/contracts.js";
import {
  createRandomState,
  nextRandom,
  nextRandomInteger,
} from "../../src/domain/random.js";
import { ORIGINAL_V13_RULESET_ID } from "../../src/domain/rulesets.js";
import { createRunState } from "../../src/domain/run-state.js";

const player = Object.freeze({
  gold: 300,
  weapon: Object.freeze({ tier: 1, name: "Dagger", attack: 216 }),
  armor: Object.freeze({ tier: 1, name: "Clothing" }),
  hp: Object.freeze({ current: 1_908, maximum: 1_908 }),
  inventory: Object.freeze({ item: "elixir" as const }),
});
const encounters = Object.freeze({
  current: null,
  distanceUntilNext: 1_500,
  upcoming: Object.freeze([
    Object.freeze({ kind: "battle" as const }),
    Object.freeze({ kind: "battle" as const }),
    Object.freeze({ kind: "battle" as const }),
  ]),
  generation: Object.freeze({
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
  }),
});

function drawSequence(
  initialState: Readonly<RandomState>,
  length: number,
): { readonly state: RandomState; readonly values: readonly number[] } {
  let state = initialState;
  const values: number[] = [];

  for (let index = 0; index < length; index += 1) {
    const draw = nextRandom(state);
    state = draw.state;
    values.push(draw.value);
  }

  return { state, values };
}

function drawIntegerSequence(
  initialState: Readonly<RandomState>,
  bounds: readonly number[],
): { readonly state: RandomState; readonly values: readonly number[] } {
  let state = initialState;
  const values: number[] = [];

  for (const bound of bounds) {
    const draw = nextRandomInteger(state, bound);
    state = draw.state;
    values.push(draw.value);
  }

  return { state, values };
}

describe("deterministic randomness", () => {
  it("reproduces the versioned sequence for an equal seed", () => {
    const expected = [
      0.04703454626724124, 0.5048810059670359, 0.8992407298646867,
      0.5932981998194009, 0.4280949376989156,
    ];

    const first = drawSequence(createRandomState("trigger-knight"), 5);
    const second = drawSequence(createRandomState("trigger-knight"), 5);

    expect(first.values).toEqual(expected);
    expect(second).toEqual(first);
  });

  it("maps each random(n) draw to an integer from zero through n - 1", () => {
    let state = createRandomState("trigger-knight");
    const bounds = [3, 100, 24, 7, 1_000] as const;
    const values: number[] = [];

    for (const bound of bounds) {
      const draw = nextRandomInteger(state, bound);
      state = draw.state;
      values.push(draw.value);

      expect(Number.isInteger(draw.value)).toBe(true);
      expect(draw.value).toBeGreaterThanOrEqual(0);
      expect(draw.value).toBeLessThan(bound);
    }

    expect(values).toEqual([0, 50, 21, 4, 428]);
  });

  it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    "rejects invalid random(n) bound %s without advancing state",
    (bound) => {
      const state = createRandomState("invalid-bound");

      expect(() => nextRandomInteger(state, bound)).toThrowError(
        "Random integer bound must be a positive safe integer",
      );
      expect(state).toEqual(createRandomState("invalid-bound"));
    },
  );

  it("continues identically after a run-state serialization round trip", () => {
    const initial = createRunState(
      ORIGINAL_V13_RULESET_ID,
      createRandomState("checkpoint-seed"),
      60,
      1,
      0,
      { whole: 99, fraction: 99 },
      player,
      encounters,
    );
    const beforeCheckpoint = drawSequence(initial.random, 3);
    const checkpoint: RunState = {
      ...initial,
      random: beforeCheckpoint.state,
    };
    const restored = JSON.parse(JSON.stringify(checkpoint)) as RunState;

    expect(restored).toEqual(checkpoint);
    const bounds = [3, 100, 24, 7, 1_000, 3, 100, 24] as const;

    expect(drawIntegerSequence(restored.random, bounds)).toEqual(
      drawIntegerSequence(checkpoint.random, bounds),
    );
  });

  it("keeps independent runs free of shared mutable random state", () => {
    const first = createRunState(
      ORIGINAL_V13_RULESET_ID,
      createRandomState("shared-seed"),
      60,
      1,
      0,
      { whole: 99, fraction: 99 },
      player,
      encounters,
    );
    const second = createRunState(
      ORIGINAL_V13_RULESET_ID,
      createRandomState("shared-seed"),
      60,
      1,
      0,
      { whole: 99, fraction: 99 },
      player,
      encounters,
    );
    const firstDraw = nextRandom(first.random);

    expect(first.random).not.toBe(second.random);
    expect(first.random).toEqual(second.random);
    expect(firstDraw.state).not.toEqual(second.random);
    expect(nextRandom(second.random)).toEqual(firstDraw);
  });
});
