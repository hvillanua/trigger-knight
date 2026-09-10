import { describe, expect, it } from "vitest";
import type {
  CombatActorState,
  EnemyId,
  RunState,
} from "../../src/domain/contracts.js";
import { createTestGameplayEngine } from "../helpers/gameplay-engine.js";

const engine = createTestGameplayEngine();
function actor(x: number): CombatActorState {
  return {
    phase: "idle",
    x,
    attackDelay: 100,
    attackFactor: 1,
    attackCount: 0,
    alpha: 100,
    attackTicks: 0,
    knockback: 0,
  };
}
function lethal(
  target: "hero" | "enemy" = "enemy",
  id: EnemyId = "goblin",
): RunState {
  const initial = engine.createRun({
    ruleset: "original-v1.3",
    seed: "resolution",
    initialProfile: {
      schemaVersion: 1,
      scoreMultiplier: 1.5,
      tutorialPreference: "disabled",
    },
  });
  const enemy = {
    goblin: { maximumHp: 660, attack: 122, goldReward: 82, profileExp: 13 },
    golem: { maximumHp: 980, attack: 68, goldReward: 92, profileExp: 13 },
    wolf: { maximumHp: 494, attack: 150, goldReward: 92, profileExp: 13 },
    dragon: { maximumHp: 2700, attack: 240, goldReward: 410, profileExp: 65 },
  }[id];
  return {
    ...initial,
    lifecycle: {
      ...initial.lifecycle,
      phase: "battling",
      tutorialPage: null,
      pregameStepsRemaining: 0,
    },
    player: {
      ...initial.player,
      hp: { ...initial.player.hp, current: target === "hero" ? 1 : 1908 },
    },
    encounters: {
      ...initial.encounters,
      current: { kind: "battle", x: 400, enemy: { id, ...enemy } },
    },
    battle: {
      enemyHp: target === "enemy" ? 1 : enemy.maximumHp,
      enemyGoldMultiplier: 1,
      hero: {
        ...actor(380),
        ...(target === "enemy"
          ? { phase: "attack" as const, attackTicks: 5 }
          : {}),
      },
      enemy: {
        ...actor(400),
        ...(target === "hero"
          ? { phase: "attack" as const, attackTicks: 5 }
          : {}),
      },
    },
  };
}
function ticks(state: RunState, count: number): RunState {
  for (let i = 0; i < count; i++) state = engine.step(state, []).state;
  return state;
}

describe("battle death and reward settlement", () => {
  it.each(["goblin", "golem", "wolf", "dragon"] as const)(
    "settles %s once after ten subsequent active fade ticks",
    (id) => {
      const expected = {
        goblin: { gold: 82, score: 17580, profileExp: 13 },
        golem: { gold: 92, score: 15920, profileExp: 13 },
        wolf: { gold: 92, score: 18440, profileExp: 13 },
        dragon: { gold: 410, score: 48600, profileExp: 65 },
      }[id];
      const initial = lethal("enemy", id);
      const killed = engine.step(initial, []);
      expect(killed.state.battle!.enemy.alpha).toBe(100);
      let state = killed.state;
      for (let i = 1; i <= 9; i++) {
        const result = engine.step(state, []);
        state = result.state;
        expect(state.battle!.enemy.alpha).toBe(100 - i * 10);
        expect(state.player.gold).toBe(300);
        expect(state.score).toBe(0);
        expect(state.profileExpEarned).toBe(0);
        expect(result.events).toEqual([{ type: "step-advanced", step: i + 1 }]);
      }
      const reward = engine.step(state, []);
      expect(reward.events).toEqual([
        { type: "step-advanced", step: 11 },
        {
          type: "battle-reward",
          enemy: id,
          ...expected,
          dragonKilled: id === "dragon",
        },
      ]);
      expect(reward.state).toMatchObject({
        score: expected.score,
        profileExpEarned: expected.profileExp,
        dragonKills: id === "dragon" ? 1 : 0,
        movementSpeed: 0,
        battle: null,
        player: { gold: 300 + expected.gold },
        lifecycle: { phase: "running", terminalReason: null },
        encounters: { current: null },
      });
      expect(reward.state.encounters.upcoming).toEqual(
        initial.encounters.upcoming,
      );
      expect(reward.state.encounters.distanceUntilNext).toBe(
        initial.encounters.distanceUntilNext,
      );
      expect(reward.state.random).toEqual(killed.state.random);
      expect(engine.observe(reward.state).battle).toBeNull();
      const next = engine.step(reward.state, []);
      expect(next.state.movementSpeed).toBe(1);
      expect(next.state.distance).toBe(1);
      expect(next.state.player.gold).toBe(300 + expected.gold);
      expect(next.state.profileExpEarned).toBe(expected.profileExp);
      expect(next.events).toEqual([{ type: "step-advanced", step: 12 }]);
    },
  );

  it("accumulates run earnings and starts the next queued battle with fresh modifiers", () => {
    const initial = lethal("enemy", "dragon");
    const boosted: RunState = {
      ...initial,
      profileExpEarned: 20,
      dragonKills: 2,
      battle: {
        ...initial.battle!,
        enemyGoldMultiplier: 10,
        hero: { ...initial.battle!.hero, attackFactor: 100 },
      },
    };
    const restored = JSON.parse(JSON.stringify(boosted)) as RunState;
    const snapshot = JSON.stringify(restored);
    const won = ticks(boosted, 11);
    expect(ticks(restored, 11)).toEqual(won);
    expect(JSON.stringify(restored)).toBe(snapshot);
    expect(won.profileExpEarned).toBe(85);
    expect(won.dragonKills).toBe(3);
    expect(won.player.gold).toBe(4400);
    let next = won;
    for (let i = 0; i < 1000 && next.lifecycle.phase === "running"; i++)
      next = engine.step(next, []).state;
    expect(next.lifecycle.phase).toBe("battling");
    expect(next.battle!.enemyGoldMultiplier).toBe(1);
    expect(next.battle!.hero.attackFactor).toBe(1);
    expect(next.encounters.upcoming).toHaveLength(3);
    expect(next.profileExpEarned).toBe(85);
  });

  it("applies a consumed voucher once and drops battle modifiers at victory", () => {
    const initial = lethal();
    const carried = {
      ...initial,
      player: {
        ...initial.player,
        inventory: { item: "gold-voucher" as const },
      },
    };
    const killed = engine.step(carried, [
      { type: "use-carried-item" },
      { type: "use-carried-item" },
    ]).state;
    const result = ticks(killed, 10);
    expect(result.player.gold).toBe(1120);
    expect(result.player.inventory.item).toBeNull();
    expect(result.battle).toBeNull();
    expect(result.score).toBe(17580);
  });

  it.each(["hero", "enemy"] as const)(
    "freezes %s fade behind pause and tutorial gates",
    (target) => {
      const killed = engine.step(lethal(target), []).state;
      for (const gate of [{ paused: true }, { tutorialPage: 0 as const }]) {
        const gated = {
          ...killed,
          lifecycle: { ...killed.lifecycle, ...gate },
        };
        const frozen = ticks(gated, 20);
        expect(frozen.battle).toEqual(killed.battle);
        expect(frozen.random).toEqual(killed.random);
        expect(frozen.lifespan).toEqual(killed.lifespan);
        expect(frozen.player.gold).toBe(300);
      }
    },
  );

  it("ends hero death at fade completion without rewards and keeps terminal gameplay final", () => {
    const killed = engine.step(lethal("hero"), []).state;
    const before = ticks(killed, 9);
    expect(before.battle!.hero.alpha).toBe(10);
    expect(before.lifecycle.phase).toBe("battling");
    const ended = engine.step(before, []);
    expect(ended.events).toEqual([
      { type: "step-advanced", step: 11 },
      { type: "run-ended", reason: "combat" },
    ]);
    expect(ended.state.battle!.hero.alpha).toBe(0);
    expect(ended.state.lifecycle.terminalReason).toBe("combat");
    expect(ended.state.player.gold).toBe(300);
    expect(ended.state.profileExpEarned).toBe(0);
    const later = ticks(ended.state, 20);
    expect({ ...later, steps: ended.state.steps }).toEqual(ended.state);
  });

  it("lets lifespan end a fade and settles completed deaths before lifespan", () => {
    for (const target of ["hero", "enemy"] as const) {
      const killed = engine.step(lethal(target), []).state;
      const expires = { ...killed, lifespan: { whole: 0, fraction: 3 } };
      const early = engine.step(expires, []).state;
      expect(early.lifecycle.terminalReason).toBe("lifespan");
      expect(ticks(early, 20).player.gold).toBe(300);
      const before = ticks(killed, 9);
      const final = engine.step(
        { ...before, lifespan: { whole: 0, fraction: 3 } },
        [],
      );
      expect(final.state.lifecycle.terminalReason).toBe(
        target === "hero" ? "combat" : "lifespan",
      );
      expect(final.state.player.gold).toBe(target === "hero" ? 300 : 382);
      expect(
        final.events.filter((event) => event.type === "run-ended"),
      ).toHaveLength(1);
    }
  });
});
