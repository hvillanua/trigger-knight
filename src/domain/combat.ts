import type {
  CombatActorId,
  CombatActorPhase,
  EnemyId,
  GameEvent,
  RunState,
} from "./contracts.js";
import { createBattleState, type BattleLifecycleStepResult } from "./battle.js";
import { createPlayerState } from "./player-state.js";
import { nextRandomInteger } from "./random.js";
import { unlockAchievement } from "./achievements.js";

export interface CombatRules {
  readonly movementPerTick: number;
  readonly attackRange: number;
  readonly hitOffset: number;
  readonly finishOffsets: Readonly<Record<"hero" | EnemyId, number>>;
  readonly delayRollBound: number;
  readonly heroDelayPerAttack: number;
  readonly enemyDelayPerAttack: number;
  readonly damageBonusRollBound: number;
  readonly criticalRollBound: number;
  readonly criticalMinimum: number;
  readonly criticalMultiplier: number;
  readonly knockbackBase: number;
  readonly knockbackRollBound: number;
  readonly knockbackDecay: number;
  readonly knockbackStopBelow: number;
  readonly lethalAttackDelay: number;
}

/** Advances automatic combat once, with explicit hero-before-enemy precedence. */
export function advanceCombat(
  previous: Readonly<RunState>,
  stepped: Readonly<RunState>,
  rules: Readonly<CombatRules>,
): BattleLifecycleStepResult {
  const battle = stepped.battle;
  const current = stepped.encounters.current;
  if (
    previous.activeTicks === stepped.activeTicks ||
    previous.lifecycle.phase !== "battling" ||
    stepped.lifecycle.phase !== "battling" ||
    battle === null ||
    current?.kind !== "battle" ||
    battle.hero.phase === "dead" ||
    battle.enemy.phase === "dead"
  ) {
    return Object.freeze({ state: stepped, events: Object.freeze([]) });
  }

  const actors = { hero: { ...battle.hero }, enemy: { ...battle.enemy } };
  const enemy = current.enemy;
  let random = stepped.random;
  let heroHp = stepped.player.hp.current;
  let enemyHp = battle.enemyHp;
  let achievementSlots = stepped.achievementSlots;
  const events: GameEvent[] = [];
  const interrupted = new Set<CombatActorId>();
  function draw(bound: number): number {
    const result = nextRandomInteger(random, bound);
    random = result.state;
    return result.value;
  }
  function changePhase(id: CombatActorId, phase: CombatActorPhase): void {
    actors[id].phase = phase;
    actors[id].attackTicks = 0;
    events.push(
      Object.freeze({ type: "combat-phase-changed", actor: id, phase }),
    );
  }
  function hit(id: CombatActorId, target: CombatActorId): void {
    const attacker = actors[id];
    const defender = actors[target];
    const base =
      (id === "hero" ? stepped.player.weapon.attack : enemy.attack) *
      attacker.attackFactor;
    let damage =
      base + Math.round((draw(rules.damageBonusRollBound) / 100) * base);
    const critical =
      id === "hero" && draw(rules.criticalRollBound) >= rules.criticalMinimum;
    if (critical) damage *= rules.criticalMultiplier;
    const remainingHp = Math.max(
      0,
      (target === "hero" ? heroHp : enemyHp) - damage,
    );
    if (target === "hero") heroHp = remainingHp;
    else enemyHp = remainingHp;
    attacker.attackCount++;
    defender.attackCount = 0;
    events.push(
      Object.freeze({
        type: "combat-hit",
        attacker: id,
        target,
        damage,
        critical,
        remainingHp,
      }),
    );
    if (damage >= 70_000) {
      const unlocked = unlockAchievement(achievementSlots, 4);
      achievementSlots = unlocked.achievementSlots;
      events.push(...unlocked.events);
    }
    if (target === "enemy" && remainingHp === 0 && enemy.id === "dragon") {
      const unlocked = unlockAchievement(achievementSlots, 0);
      achievementSlots = unlocked.achievementSlots;
      events.push(...unlocked.events);
    }
    interrupted.add(target);
    if (remainingHp === 0) {
      attacker.attackDelay = rules.lethalAttackDelay;
      defender.knockback = 0;
      changePhase(target, "dead");
      events.push(
        Object.freeze({ type: "combat-lethal-hit", attacker: id, target }),
      );
    } else {
      defender.knockback = rules.knockbackBase + draw(rules.knockbackRollBound);
      changePhase(target, "flinch");
    }
  }
  function advanceActor(id: CombatActorId): void {
    const actor = actors[id];
    const target = id === "hero" ? "enemy" : "hero";
    if (interrupted.has(id) || actors[target].phase === "dead") return;
    const direction = id === "hero" ? 1 : -1;
    switch (actor.phase) {
      case "idle":
        actor.attackDelay--;
        if (actor.attackDelay <= 0) changePhase(id, "move");
        break;
      case "move":
        if (Math.abs(actors.enemy.x - actors.hero.x) < rules.attackRange)
          changePhase(id, "attack");
        else actor.x += direction * rules.movementPerTick;
        break;
      case "attack": {
        actor.attackTicks++;
        if (actor.attackTicks === rules.hitOffset) hit(id, target);
        const finish = rules.finishOffsets[id === "hero" ? "hero" : enemy.id];
        if (actor.attackTicks === finish) {
          actor.attackDelay =
            draw(rules.delayRollBound) +
            actor.attackCount *
              (id === "hero"
                ? rules.heroDelayPerAttack
                : rules.enemyDelayPerAttack);
          changePhase(id, "idle");
        }
        break;
      }
      case "flinch":
        actor.x -= direction * actor.knockback;
        actor.knockback *= rules.knockbackDecay;
        if (actor.knockback < rules.knockbackStopBelow) {
          actor.knockback = 0;
          changePhase(id, "idle");
        }
        break;
      case "dead":
        break;
    }
  }
  advanceActor("hero");
  advanceActor("enemy");
  return Object.freeze({
    state: Object.freeze({
      ...stepped,
      random,
      achievementSlots,
      player: createPlayerState({
        ...stepped.player,
        hp: { ...stepped.player.hp, current: heroHp },
      }),
      battle: createBattleState({
        ...battle,
        enemyHp,
        hero: actors.hero,
        enemy: actors.enemy,
      }),
    }),
    events: Object.freeze(events),
  });
}
