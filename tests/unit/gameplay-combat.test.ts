import { describe, expect, it } from "vitest";
import type {
  CombatActorState,
  EnemyId,
  RunState,
} from "../../src/domain/contracts.js";
import {
  createRandomState,
  nextRandomInteger,
} from "../../src/domain/random.js";
import { createTestGameplayEngine } from "../helpers/gameplay-engine.js";

const engine = createTestGameplayEngine();
function actor(
  x: number,
  overrides: Partial<CombatActorState> = {},
): CombatActorState {
  return {
    phase: "idle",
    x,
    attackDelay: 0,
    attackFactor: 1,
    attackCount: 0,
    alpha: 100,
    attackTicks: 0,
    knockback: 0,
    ...overrides,
  };
}
function battle(id: EnemyId = "goblin"): RunState {
  const initial = engine.createRun({
    ruleset: "original-v1.3",
    seed: "combat",
    initialProfile: { schemaVersion: 1, scoreMultiplier: 1 },
  });
  return {
    ...initial,
    random: createRandomState("combat-draws"),
    lifecycle: {
      ...initial.lifecycle,
      phase: "battling",
      tutorialPage: null,
      pregameStepsRemaining: 0,
    },
    encounters: {
      ...initial.encounters,
      current: {
        kind: "battle",
        x: 400,
        enemy: {
          id,
          maximumHp: 10000,
          attack: 122,
          goldReward: 82,
          profileExp: 13,
        },
      },
    },
    battle: {
      enemyHp: 10000,
      enemyGoldMultiplier: 1,
      hero: actor(50),
      enemy: actor(400, { attackDelay: 100 }),
    },
  };
}
function withActors(
  state: RunState,
  hero: Partial<CombatActorState>,
  enemy: Partial<CombatActorState> = {},
): RunState {
  return {
    ...state,
    battle: {
      ...state.battle!,
      hero: { ...state.battle!.hero, ...hero },
      enemy: { ...state.battle!.enemy, ...enemy },
    },
  };
}
function ticks(state: RunState, count: number): RunState {
  for (let i = 0; i < count; i++) state = engine.step(state, []).state;
  return state;
}

describe("automatic combat", () => {
  it("decrements idle delay and uses strict horizontal range and ten-unit movement", () => {
    const initial = withActors(battle(), { attackDelay: 2, x: 370 });
    const delayed = engine.step(initial, []);
    expect(delayed.state.battle!.hero).toMatchObject({
      phase: "idle",
      attackDelay: 1,
    });
    const moving = engine.step(delayed.state, []);
    expect(moving.events).toEqual([
      { type: "step-advanced", step: 2 },
      { type: "combat-phase-changed", actor: "hero", phase: "move" },
    ]);
    const atRange = engine.step(moving.state, []);
    expect(atRange.state.battle!.hero).toMatchObject({ phase: "move", x: 380 });
    const attacking = engine.step(atRange.state, []);
    expect(attacking.state.battle!.hero).toMatchObject({
      phase: "attack",
      x: 380,
      attackTicks: 0,
    });
    expect(attacking.state.random).toEqual(initial.random);
  });

  it.each(["hero", "goblin", "golem", "wolf", "dragon"] as const)(
    "hits at offset six and finishes at the researched offset for %s",
    (id) => {
      const hero = id === "hero";
      const initial = withActors(
        battle(hero ? "goblin" : id),
        hero ? { phase: "attack" } : { attackDelay: 100 },
        hero ? { attackDelay: 100 } : { phase: "attack" },
      );
      const before = ticks(initial, 5);
      expect(before.random).toEqual(initial.random);
      const hit = engine.step(before, []);
      const bonus = nextRandomInteger(initial.random, 20);
      const critical = hero ? nextRandomInteger(bonus.state, 100) : null;
      const knockback = nextRandomInteger(critical?.state ?? bonus.state, 7);
      const damage =
        ((hero ? 216 : 122) +
          Math.round((bonus.value / 100) * (hero ? 216 : 122))) *
        (critical !== null && critical.value >= 90 ? 2 : 1);
      expect(hit.events).toEqual([
        { type: "step-advanced", step: 6 },
        {
          type: "combat-hit",
          attacker: hero ? "hero" : "enemy",
          target: hero ? "enemy" : "hero",
          damage,
          critical: critical !== null && critical.value >= 90,
          remainingHp: (hero ? 10000 : 1908) - damage,
        },
        {
          type: "combat-phase-changed",
          actor: hero ? "enemy" : "hero",
          phase: "flinch",
        },
      ]);
      expect(hit.state.random).toEqual(knockback.state);
      const attacker = hero ? "hero" : "enemy";
      expect(hit.state.battle![attacker].attackCount).toBe(1);
      const finishOffset = hero ? 14 : id === "wolf" ? 10 : 12;
      const beforeFinish = ticks(hit.state, finishOffset - 7);
      expect(beforeFinish.battle![attacker].phase).toBe("attack");
      const finished = engine.step(beforeFinish, []);
      const delay = nextRandomInteger(knockback.state, 24);
      expect(finished.state.battle![attacker]).toMatchObject({
        phase: "idle",
        attackDelay: delay.value + (hero ? 4 : 12),
      });
      expect(finished.state.random).toEqual(delay.state);
    },
  );

  it("locks rounded bonuses, exact critical threshold, and uncapped Divine Edge damage", () => {
    const seen = new Set<number>();
    const thresholds = new Set<number>();
    for (let seed = 0; seed < 1000; seed++) {
      const initial = {
        ...withActors(battle(), {
          phase: "attack",
          attackTicks: 5,
          attackFactor: 100,
        }),
        random: createRandomState(String(seed)),
      };
      const bonus = nextRandomInteger(initial.random, 20);
      const critical = nextRandomInteger(bonus.state, 100);
      seen.add(bonus.value);
      thresholds.add(critical.value);
      const hit = engine
        .step(initial, [])
        .events.find((event) => event.type === "combat-hit");
      expect(hit).toEqual({
        type: "combat-hit",
        attacker: "hero",
        target: "enemy",
        damage:
          (21600 + Math.round((bonus.value / 100) * 21600)) *
          (critical.value >= 90 ? 2 : 1),
        critical: critical.value >= 90,
        remainingHp: 0,
      });
    }
    expect(seen.size).toBe(20);
    expect(thresholds.size).toBe(100);
  });

  it("interrupts simultaneous enemy hits, resets its counter, and applies flinch on later ticks", () => {
    const initial = withActors(
      battle(),
      { phase: "attack", attackTicks: 5, attackCount: 2 },
      { phase: "attack", attackTicks: 5, attackCount: 3 },
    );
    const result = engine.step(initial, []);
    expect(
      result.events.filter((event) => event.type === "combat-hit"),
    ).toHaveLength(1);
    expect(result.state.player.hp).toEqual(initial.player.hp);
    expect(result.state.battle!.hero.attackCount).toBe(3);
    expect(result.state.battle!.enemy).toMatchObject({
      phase: "flinch",
      x: 400,
      attackCount: 0,
      attackTicks: 0,
    });
    const knockback = result.state.battle!.enemy.knockback;
    expect(knockback).toBeGreaterThanOrEqual(10);
    expect(knockback).toBeLessThanOrEqual(16);
    const next = engine.step(result.state, []);
    expect(next.state.battle!.enemy).toMatchObject({
      x: 400 + knockback,
      knockback: knockback * 0.8,
    });
    const recovered = ticks(result.state, 14);
    expect(recovered.battle!.enemy.phase).toBe("idle");
  });

  it("knocks the hero left and freezes dead targets without paying rewards", () => {
    const initial = withActors(
      battle(),
      { attackDelay: 100 },
      { phase: "attack", attackTicks: 5 },
    );
    const hit = engine.step(initial, []).state;
    expect(engine.step(hit, []).state.battle!.hero.x).toBe(
      50 - hit.battle!.hero.knockback,
    );
    const lethal = {
      ...initial,
      player: { ...initial.player, hp: { ...initial.player.hp, current: 1 } },
    };
    const killed = engine.step(lethal, []);
    expect(killed.events.slice(-2)).toEqual([
      { type: "combat-phase-changed", actor: "hero", phase: "dead" },
      { type: "combat-lethal-hit", attacker: "enemy", target: "hero" },
    ]);
    expect(killed.state.battle!.enemy.attackDelay).toBe(600);
    const later = ticks(killed.state, 20);
    expect(later.battle).toEqual(killed.state.battle);
    expect(later.player.gold).toBe(initial.player.gold);
    expect(later.player.hp.current).toBe(0);
  });

  it("freezes timing and RNG behind gates and replays immutable checkpoints", () => {
    const initial = withActors(battle(), { phase: "attack", attackTicks: 5 });
    for (const gate of [{ paused: true }, { tutorialPage: 0 as const }]) {
      const gated = {
        ...initial,
        lifecycle: { ...initial.lifecycle, ...gate },
      };
      const result = ticks(gated, 20);
      expect(result.battle).toEqual(gated.battle);
      expect(result.random).toEqual(gated.random);
      expect(result.lifespan).toEqual(gated.lifespan);
    }
    const restored = JSON.parse(JSON.stringify(initial)) as RunState;
    const snapshot = JSON.stringify(restored);
    expect(ticks(restored, 40)).toEqual(ticks(initial, 40));
    expect(JSON.stringify(restored)).toBe(snapshot);
    expect(Object.isFrozen(ticks(restored, 1).battle!.hero)).toBe(true);
  });
});
