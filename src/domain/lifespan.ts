import type { GameEvent, LifespanState, RunState } from "./contracts.js";

export interface LifespanRules {
  readonly drainPerActiveTick: number;
  readonly fractionReset: number;
  readonly deathBelowWhole: number;
}

export interface LifespanStepResult {
  readonly state: RunState;
  readonly events: readonly GameEvent[];
}

/** Drains integer lifespan when the lifecycle consumed an active tick. */
export function advanceLifespan(
  previous: Readonly<RunState>,
  stepped: Readonly<RunState>,
  rules: Readonly<LifespanRules>,
): LifespanStepResult {
  if (
    stepped.activeTicks === previous.activeTicks ||
    stepped.lifecycle.phase === "ended"
  ) {
    return Object.freeze({ state: stepped, events: Object.freeze([]) });
  }

  const drainedFraction = previous.lifespan.fraction - rules.drainPerActiveTick;
  const lifespan: LifespanState = Object.freeze(
    drainedFraction <= 0
      ? {
          whole: previous.lifespan.whole - 1,
          fraction: rules.fractionReset,
        }
      : {
          whole: previous.lifespan.whole,
          fraction: drainedFraction,
        },
  );

  if (lifespan.whole >= rules.deathBelowWhole) {
    return Object.freeze({
      state: Object.freeze({ ...stepped, lifespan }),
      events: Object.freeze([]),
    });
  }

  return Object.freeze({
    state: Object.freeze({
      ...stepped,
      lifespan,
      lifecycle: Object.freeze({
        ...stepped.lifecycle,
        phase: "ended",
        terminalReason: "lifespan",
      }),
    }),
    events: Object.freeze([
      Object.freeze({ type: "lifespan-death" }),
      Object.freeze({ type: "run-ended", reason: "lifespan" }),
    ]),
  });
}
