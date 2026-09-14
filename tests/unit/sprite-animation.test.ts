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
