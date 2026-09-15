import { describe, expect, it } from "vitest";
import {
  actorFrameNumber,
  ACTOR_CLIPS,
  ActorAnimation,
} from "../../src/browser/sprite-animation.js";
import { createTestGameplayEngine } from "../helpers/gameplay-engine.js";
import { ORIGINAL_V13_RULESET_ID } from "../../src/domain/rulesets.js";

describe("original sprite playback", () => {
  it("plays numeric running frames and loops only within the movement clip", () => {
    expect(
      Array.from({ length: 19 }, (_, tick) =>
        actorFrameNumber("hero", "running", tick),
      ),
    ).toEqual([...Array.from({ length: 17 }, (_, i) => i + 17), 17, 18]);
    expect(actorFrameNumber("hero", "attack", 100)).toBe(55);
  });
  it("anchors phase clips to public transition ticks when renders are batched", () => {
    const engine = createTestGameplayEngine();
    const base = engine.observe(
      engine.createRun({
        ruleset: ORIGINAL_V13_RULESET_ID,
        seed: "batched-animation",
        initialProfile: { schemaVersion: 1, scoreMultiplier: 1 },
      }),
    );
    const active = {
      ...base,
      lifecycle: { ...base.lifecycle, paused: false, tutorialPage: null },
    };
    const attackAtTwo = {
      ...active,
      steps: 2,
      activeTicks: 2,
      lifecycle: { ...active.lifecycle, phase: "battling" as const },
      battle: {
        enemy: { id: "goblin" as const, maximumHp: 900, currentHp: 900 },
        actors: {
          hero: { phase: "attack" as const, x: 190 },
          enemy: { phase: "idle" as const, x: 250 },
        },
      },
    };
    const flinchAtThree = {
      ...attackAtTwo,
      steps: 3,
      activeTicks: 3,
      battle: {
        ...attackAtTwo.battle,
        actors: {
          ...attackAtTwo.battle.actors,
          hero: { phase: "flinch" as const, x: 190 },
        },
      },
    };
    const attackAtFour = {
      ...flinchAtThree,
      steps: 4,
      activeTicks: 4,
      battle: {
        ...flinchAtThree.battle,
        actors: {
          ...flinchAtThree.battle.actors,
          hero: { phase: "attack" as const, x: 190 },
        },
      },
    };
    const everyTransition = new ActorAnimation();
    everyTransition.present(active);
    everyTransition.presentTransition(active, attackAtTwo);
    everyTransition.present(attackAtTwo);
    everyTransition.presentTransition(attackAtTwo, flinchAtThree);
    everyTransition.presentTransition(flinchAtThree, attackAtFour);
    everyTransition.present(attackAtFour);

    const batchedTransition = new ActorAnimation();
    batchedTransition.present(active);
    batchedTransition.presentTransition(active, attackAtTwo);
    batchedTransition.presentTransition(attackAtTwo, flinchAtThree);
    batchedTransition.presentTransition(flinchAtThree, attackAtFour);
    batchedTransition.present(attackAtFour);

    expect(everyTransition.hero.frame).toBe(34);
    expect(batchedTransition.hero.frame).toBe(everyTransition.hero.frame);

    const paused = {
      ...attackAtFour,
      steps: 5,
      lifecycle: { ...attackAtFour.lifecycle, paused: true },
    };
    batchedTransition.presentTransition(attackAtFour, paused);
    batchedTransition.present(paused);
    expect(batchedTransition.hero.frame).toBe(34);

    const resumed = {
      ...paused,
      steps: 6,
      activeTicks: 5,
      lifecycle: { ...paused.lifecycle, paused: false },
    };
    batchedTransition.presentTransition(paused, resumed);
    batchedTransition.present(resumed);
    expect(batchedTransition.hero.frame).toBe(35);
  });
  it("never plays the hero contamination in the wolf export", () => {
    for (const phase of Object.keys(ACTOR_CLIPS.wolf) as Array<
      keyof typeof ACTOR_CLIPS.wolf
    >) {
      for (let tick = 0; tick < 100; tick++) {
        expect([42, 43, 44, 45, 46, 47, 48]).not.toContain(
          actorFrameNumber("wolf", phase, tick),
        );
      }
    }
  });
  it("advances once per public step, freezes while paused, and resets on a new run", () => {
    const engine = createTestGameplayEngine();
    const base = engine.observe(
      engine.createRun({
        ruleset: ORIGINAL_V13_RULESET_ID,
        seed: "animation",
        initialProfile: { schemaVersion: 1, scoreMultiplier: 1 },
      }),
    );
    const active = {
      ...base,
      lifecycle: { ...base.lifecycle, paused: false, tutorialPage: null },
    };
    const animation = new ActorAnimation();
    const present = (current: typeof active) => animation.present(current);
    present(active);
    present({ ...active, steps: 3, activeTicks: 3 });
    expect(animation.hero.frame).toBe(20);
    present({ ...active, steps: 3, activeTicks: 3 });
    expect(animation.hero.frame).toBe(20);
    present({
      ...active,
      steps: 4,
      activeTicks: 3,
      lifecycle: { ...active.lifecycle, paused: true },
    });
    const frozen = animation.hero.frame;
    present({
      ...active,
      steps: 30,
      activeTicks: 3,
      lifecycle: { ...active.lifecycle, paused: true },
    });
    expect(animation.hero.frame).toBe(frozen);
    present(active);
    expect(animation.hero.frame).toBe(17);
  });
  it("adds a small source-shaped vertical wander from public active ticks", () => {
    const engine = createTestGameplayEngine();
    const base = engine.observe(
      engine.createRun({
        ruleset: ORIGINAL_V13_RULESET_ID,
        seed: "vertical-animation",
        initialProfile: { schemaVersion: 1, scoreMultiplier: 1 },
      }),
    );
    const active = {
      ...base,
      lifecycle: { ...base.lifecycle, paused: false, tutorialPage: null },
    };
    const animation = new ActorAnimation();
    animation.present(active);
    const offsets = [animation.runningY()];
    for (let tick = 1; tick <= 180; tick += 1) {
      animation.present({ ...active, steps: tick, activeTicks: tick });
      offsets.push(animation.runningY());
    }

    expect(offsets[0]).toBe(0);
    expect(Math.max(...offsets)).toBeGreaterThan(0);
    expect(Math.max(...offsets)).toBeLessThanOrEqual(14);
    expect(
      new Set(offsets.map((offset) => offset.toFixed(4))).size,
    ).toBeGreaterThan(2);

    const frozen = animation.runningY();
    animation.present({
      ...active,
      steps: 181,
      activeTicks: 180,
      lifecycle: { ...active.lifecycle, paused: true },
    });
    expect(animation.runningY()).toBe(frozen);
  });
  it("keeps the last battle position when running resumes, then scrolls back with travel", () => {
    const engine = createTestGameplayEngine();
    const base = engine.observe(
      engine.createRun({
        ruleset: ORIGINAL_V13_RULESET_ID,
        seed: "position",
        initialProfile: { schemaVersion: 1, scoreMultiplier: 1 },
      }),
    );
    const animation = new ActorAnimation();
    animation.present(base);
    expect(animation.runningX(base.distance)).toBe(50);
    animation.present({
      ...base,
      steps: 1,
      battle: {
        enemy: { id: "goblin", maximumHp: 10, currentHp: 0 },
        actors: {
          hero: { x: 190, phase: "idle" },
          enemy: { x: 250, phase: "dead" },
        },
      },
    });
    animation.present({ ...base, steps: 2 });
    expect(animation.runningX(base.distance)).toBe(190);
    expect(animation.runningX(base.distance + 20)).toBe(170);
    expect(animation.runningX(base.distance + 200)).toBe(50);
  });
  it("fades the public dead pose without changing the battle outcome", () => {
    const engine = createTestGameplayEngine();
    const base = engine.observe(
      engine.createRun({
        ruleset: ORIGINAL_V13_RULESET_ID,
        seed: "death-fade",
        initialProfile: { schemaVersion: 1, scoreMultiplier: 1 },
      }),
    );
    const animation = new ActorAnimation();
    const battle = {
      enemy: { id: "goblin" as const, maximumHp: 10, currentHp: 0 },
      actors: {
        hero: { phase: "idle" as const, x: 190 },
        enemy: { phase: "dead" as const, x: 250 },
      },
    };
    animation.present(base);
    animation.present({
      ...base,
      steps: 1,
      activeTicks: 1,
      lifecycle: { ...base.lifecycle, phase: "battling" as const },
      battle,
    });
    expect(animation.enemy?.phase).toBe("dead");
    expect(animation.enemy?.alpha).toBe(1);
    animation.present({
      ...base,
      steps: 7,
      activeTicks: 7,
      lifecycle: { ...base.lifecycle, phase: "battling" as const },
      battle,
    });
    expect(animation.enemy?.alpha).toBeCloseTo(0.5);
    animation.present({
      ...base,
      steps: 13,
      activeTicks: 13,
      lifecycle: { ...base.lifecycle, phase: "battling" as const },
      battle,
    });
    expect(animation.enemy?.alpha).toBe(0);
  });
});
