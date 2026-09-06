import { createBattleState, type BattleLifecycleStepResult } from "./battle.js";
import type { RunState } from "./contracts.js";
import { createEncounterQueueState } from "./encounters.js";
import { createPlayerState } from "./player-state.js";

export interface BattleResolutionRules {
  readonly fadePerActiveTick: number;
  readonly killScorePerMaximumHp: number;
  readonly killScorePerAttack: number;
}

/** Advances dead actors and commits completed battle outcomes exactly once. */
export function advanceBattleResolution(
  previous: Readonly<RunState>,
  stepped: Readonly<RunState>,
  rules: Readonly<BattleResolutionRules>,
): BattleLifecycleStepResult {
  const battle = stepped.battle;
  const current = stepped.encounters.current;
  if (
    previous.activeTicks === stepped.activeTicks ||
    stepped.lifecycle.phase !== "battling" ||
    battle === null ||
    current?.kind !== "battle"
  )
    return Object.freeze({ state: stepped, events: Object.freeze([]) });

  const target =
    previous.battle?.hero.phase === "dead"
      ? "hero"
      : previous.battle?.enemy.phase === "dead"
        ? "enemy"
        : null;
  if (target === null)
    return Object.freeze({ state: stepped, events: Object.freeze([]) });

  const alpha = Math.max(0, battle[target].alpha - rules.fadePerActiveTick);
  const faded = Object.freeze({
    ...stepped,
    battle: createBattleState({
      ...battle,
      [target]: { ...battle[target], alpha },
    }),
  });
  if (alpha > 0)
    return Object.freeze({ state: faded, events: Object.freeze([]) });

  if (target === "hero") {
    return Object.freeze({
      state: Object.freeze({
        ...faded,
        lifecycle: Object.freeze({
          ...faded.lifecycle,
          phase: "ended",
          terminalReason: "combat",
        }),
      }),
      events: Object.freeze([
        Object.freeze({ type: "run-ended", reason: "combat" }),
      ]),
    });
  }

  const enemy = current.enemy;
  const gold = enemy.goldReward * battle.enemyGoldMultiplier;
  const score =
    enemy.maximumHp * rules.killScorePerMaximumHp +
    enemy.attack * rules.killScorePerAttack * stepped.scoreMultiplier;
  const dragonKilled = enemy.id === "dragon";
  return Object.freeze({
    state: Object.freeze({
      ...stepped,
      score: stepped.score + score,
      profileExpEarned: stepped.profileExpEarned + enemy.profileExp,
      dragonKills: stepped.dragonKills + (dragonKilled ? 1 : 0),
      player: createPlayerState({
        ...stepped.player,
        gold: stepped.player.gold + gold,
      }),
      battle: null,
      movementSpeed: 0,
      encounters: createEncounterQueueState({
        ...stepped.encounters,
        current: null,
      }),
      lifecycle: Object.freeze({ ...stepped.lifecycle, phase: "running" }),
    }),
    events: Object.freeze([
      Object.freeze({
        type: "battle-reward",
        enemy: enemy.id,
        gold,
        score,
        profileExp: enemy.profileExp,
        dragonKilled,
      }),
    ]),
  });
}
