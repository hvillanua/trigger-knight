import { describe, expect, it } from "vitest";

import type { RandomState, RunState } from "../../src/domain/contracts.js";
import { createRandomState, nextRandom } from "../../src/domain/random.js";
import { createRunState } from "../../src/domain/run-state.js";

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

  it("continues identically after a run-state serialization round trip", () => {
    const initial = createRunState("walking-skeleton-v1", "checkpoint-seed");
    const beforeCheckpoint = drawSequence(initial.random, 3);
    const checkpoint: RunState = {
      ...initial,
      random: beforeCheckpoint.state,
    };
    const restored = JSON.parse(JSON.stringify(checkpoint)) as RunState;

    expect(restored).toEqual(checkpoint);
    expect(drawSequence(restored.random, 8)).toEqual(
      drawSequence(checkpoint.random, 8),
    );
  });

  it("keeps independent runs free of shared mutable random state", () => {
    const first = createRunState("walking-skeleton-v1", "shared-seed");
    const second = createRunState("walking-skeleton-v1", "shared-seed");
    const firstDraw = nextRandom(first.random);

    expect(first.random).not.toBe(second.random);
    expect(first.random).toEqual(second.random);
    expect(firstDraw.state).not.toEqual(second.random);
    expect(nextRandom(second.random)).toEqual(firstDraw);
  });
});
