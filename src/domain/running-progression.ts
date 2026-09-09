import type { GameEvent, RunState } from "./contracts.js";
import { unlockAchievement } from "./achievements.js";

export interface RunningProgressionRules {
  readonly accelerationPerActiveTick: number;
  readonly maximumSpeed: number;
  readonly distancePerSpeedUnit: number;
  readonly distancePerDay: number;
  readonly scorePerSpeedUnit: number;
}

export interface RunningProgressionStepResult {
  readonly state: RunState;
  readonly events: readonly GameEvent[];
}

/** Advances original running values when the lifecycle consumed an active tick. */
export function advanceRunningProgression(
  previous: Readonly<RunState>,
  stepped: Readonly<RunState>,
  rules: Readonly<RunningProgressionRules>,
): RunningProgressionStepResult {
  if (
    stepped.activeTicks === previous.activeTicks ||
    stepped.lifecycle.phase !== "running"
  ) {
    return Object.freeze({ state: stepped, events: Object.freeze([]) });
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

  const events: GameEvent[] = [];
  let achievementSlots = stepped.achievementSlots;
  if (previous.day < 10 && day >= 10) {
    const unlocked = unlockAchievement(achievementSlots, 2);
    achievementSlots = unlocked.achievementSlots;
    events.push(...unlocked.events);
  }

  return Object.freeze({
    state: Object.freeze({
      ...stepped,
      movementSpeed,
      distance,
      day,
      score,
      achievementSlots,
    }),
    events: Object.freeze(events),
  });
}
