import type { RandomState } from "./contracts.js";

export const RANDOM_ALGORITHM = "mulberry32-fnv1a32-v1" as const;

const FNV_OFFSET_BASIS = 0x811c9dc5;
const FNV_PRIME = 0x01000193;
const MULBERRY_INCREMENT = 0x6d2b79f5;
const UINT32_RANGE = 0x1_0000_0000;

export interface RandomDraw {
  readonly value: number;
  readonly state: RandomState;
}

export interface RandomIntegerDraw {
  readonly value: number;
  readonly state: RandomState;
}

/** Expands a string seed into the complete state needed by the random source. */
export function createRandomState(seed: string): RandomState {
  let state = FNV_OFFSET_BASIS;

  for (let index = 0; index < seed.length; index += 1) {
    state = Math.imul(state ^ seed.charCodeAt(index), FNV_PRIME) >>> 0;
  }

  return Object.freeze({ algorithm: RANDOM_ALGORITHM, state });
}

/** Returns one unit-interval draw and a new state without mutating the input. */
export function nextRandom(random: Readonly<RandomState>): RandomDraw {
  if (
    random.algorithm !== RANDOM_ALGORITHM ||
    !Number.isInteger(random.state) ||
    random.state < 0 ||
    random.state >= UINT32_RANGE
  ) {
    throw new RangeError("Unsupported or invalid random state");
  }

  const nextState = (random.state + MULBERRY_INCREMENT) >>> 0;
  let mixed = nextState;
  mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
  mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
  const value = ((mixed ^ (mixed >>> 14)) >>> 0) / UINT32_RANGE;

  return Object.freeze({
    value,
    state: Object.freeze({
      algorithm: RANDOM_ALGORITHM,
      state: nextState,
    }),
  });
}

/** Returns one random(n) integer draw and advances the source exactly once. */
export function nextRandomInteger(
  random: Readonly<RandomState>,
  exclusiveUpperBound: number,
): RandomIntegerDraw {
  if (!Number.isSafeInteger(exclusiveUpperBound) || exclusiveUpperBound <= 0) {
    throw new RangeError(
      "Random integer bound must be a positive safe integer",
    );
  }

  const draw = nextRandom(random);

  return Object.freeze({
    value: Math.floor(draw.value * exclusiveUpperBound),
    state: draw.state,
  });
}
