import type { RunState } from "./contracts.js";

export interface RunningProgressionRules {
  readonly accelerationPerActiveTick: number;
  readonly maximumSpeed: number;
  readonly distancePerSpeedUnit: number;
  readonly distancePerDay: number;
  readonly scorePerSpeedUnit: number;
}

/** Advances original running values when the lifecycle consumed an active tick. */
export function advanceRunningProgression(
  previous: Readonly<RunState>,
  stepped: Readonly<RunState>,
  rules: Readonly<RunningProgressionRules>,
): RunState {
  if (
    stepped.activeTicks === previous.activeTicks ||
    stepped.lifecycle.phase !== "running"
  ) {
    return stepped;
  }

  const movementSpeed = Math.min(
    previous.movementSpeed + rules.accelerationPerActiveTick,
    rules.maximumSpeed,
  );
  const distance =
    previous.distance + movementSpeed * rules.distancePerSpeedUnit;
  const day = Math.floor(distance / rules.distancePerDay) + 1;
  const score =
    previous.score +
    movementSpeed * rules.scorePerSpeedUnit * previous.scoreMultiplier;

  return Object.freeze({
    ...stepped,
    movementSpeed,
    distance,
    day,
    score,
  });
}
