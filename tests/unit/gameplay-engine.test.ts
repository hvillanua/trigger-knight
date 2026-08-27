import { describe, expect, it } from "vitest";

import type {
  GameCommand,
  RunConfig,
  RunState,
} from "../../src/application/contracts.js";
import { ORIGINAL_V13_RULESET_ID } from "../../src/domain/rulesets.js";
import { createTestGameplayEngine } from "../helpers/gameplay-engine.js";

const gameplayEngine = createTestGameplayEngine();

const config: RunConfig = Object.freeze({
  ruleset: ORIGINAL_V13_RULESET_ID,
  seed: "engine-seed",
  initialProfile: Object.freeze({ schemaVersion: 1, scoreMultiplier: 1 }),
});

function createUnsupportedState(): RunState {
  return Object.freeze({
    ...gameplayEngine.createRun(config),
    ruleset: "walking-skeleton-v1",
  });
}

describe("gameplay engine", () => {
  it("rejects a ruleset identity with no matching implementation", () => {
    expect(() =>
      gameplayEngine.createRun({
        ...config,
        ruleset: "walking-skeleton-v1",
      }),
    ).toThrowError('Unsupported ruleset "walking-skeleton-v1"');
  });

  it("rejects an unsupported ruleset before stepping restored state", () => {
    expect(() =>
      gameplayEngine.step(createUnsupportedState(), []),
    ).toThrowError('Unsupported ruleset "walking-skeleton-v1"');
  });

  it("rejects an unsupported ruleset before observing restored state", () => {
    expect(() => gameplayEngine.observe(createUnsupportedState())).toThrowError(
      'Unsupported ruleset "walking-skeleton-v1"',
    );
  });

  it("creates and observes a minimal run without exposing hidden state", () => {
    const state = gameplayEngine.createRun(config);
    const repeated = gameplayEngine.createRun(config);
    const observation = gameplayEngine.observe(state);

    expect(repeated).toEqual(state);
    expect(repeated).not.toBe(state);
    expect(state).toMatchObject({
      schemaVersion: 6,
      ruleset: "original-v1.3",
      steps: 0,
      activeTicks: 0,
      scoreMultiplier: 1,
      movementSpeed: 0,
      distance: 0,
      day: 1,
      score: 0,
      lifespan: {
        whole: 99,
        fraction: 99,
      },
      player: {
        gold: 300,
        weapon: { tier: 1, attack: 216 },
        armor: { tier: 1 },
        hp: { current: 1_908, maximum: 1_908 },
        inventory: { item: "elixir" },
      },
      lifecycle: {
        phase: "running",
        terminalReason: null,
        paused: false,
        tutorialPage: 0,
        pregameStepsRemaining: 60,
      },
    });
    expect(observation).toEqual({
      ruleset: "original-v1.3",
      camera: {
        x: 0,
        y: 0,
        width: 480,
        height: 320,
      },
      steps: 0,
      activeTicks: 0,
      movementSpeed: 0,
      distance: 0,
      day: 1,
      score: 0,
      lifespan: {
        whole: 99,
        fraction: 99,
      },
      player: {
        gold: 300,
        weapon: { tier: 1, attack: 216 },
        armor: { tier: 1 },
        hp: { current: 1_908, maximum: 1_908 },
        inventory: { item: "elixir" },
      },
      lifecycle: {
        phase: "running",
        terminalReason: null,
        paused: false,
        tutorialPage: 0,
        pregameStepsRemaining: 60,
        activeGameplay: false,
      },
      actions: {
        canTogglePause: true,
        canDismissTutorial: true,
      },
    });
    expect(observation).not.toHaveProperty("random");
    expect(observation).not.toHaveProperty("scoreMultiplier");
    expect(Object.isFrozen(state)).toBe(true);
    expect(Object.isFrozen(state.random)).toBe(true);
    expect(Object.isFrozen(observation)).toBe(true);
    expect(Object.isFrozen(observation.camera)).toBe(true);
  });

  it("repeats one authoritative transition without mutating its inputs", () => {
    const state = gameplayEngine.createRun(config);
    const commands: readonly GameCommand[] = Object.freeze([
      Object.freeze({ type: "dismiss-tutorial" }),
    ]);
    const stateBefore = JSON.stringify(state);
    const commandsBefore = JSON.stringify(commands);

    const first = gameplayEngine.step(state, commands);
    const repeated = gameplayEngine.step(state, commands);

    expect(repeated).toEqual(first);
    expect(JSON.stringify(state)).toBe(stateBefore);
    expect(JSON.stringify(commands)).toBe(commandsBefore);
    expect(first.state).not.toBe(state);
    expect(first.state.random).not.toBe(state.random);
    expect(first.state.random).toEqual(state.random);
    expect(first.state).toMatchObject({
      steps: 1,
      activeTicks: 0,
      lifecycle: {
        tutorialPage: null,
        pregameStepsRemaining: 59,
      },
    });
    expect(first.events).toEqual([
      { type: "tutorial-dismissed", page: 0 },
      { type: "step-advanced", step: 1 },
    ]);
    expect(gameplayEngine.observe(first.state)).toEqual({
      ruleset: "original-v1.3",
      camera: {
        x: 0,
        y: 0,
        width: 480,
        height: 320,
      },
      steps: 1,
      activeTicks: 0,
      movementSpeed: 0,
      distance: 0,
      day: 1,
      score: 0,
      lifespan: {
        whole: 99,
        fraction: 99,
      },
      player: {
        gold: 300,
        weapon: { tier: 1, attack: 216 },
        armor: { tier: 1 },
        hp: { current: 1_908, maximum: 1_908 },
        inventory: { item: "elixir" },
      },
      lifecycle: {
        phase: "running",
        terminalReason: null,
        paused: false,
        tutorialPage: null,
        pregameStepsRemaining: 59,
        activeGameplay: false,
      },
      actions: {
        canTogglePause: true,
        canDismissTutorial: false,
      },
    });
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first.state)).toBe(true);
    expect(Object.isFrozen(first.state.lifecycle)).toBe(true);
    expect(Object.isFrozen(first.events)).toBe(true);
    expect(Object.isFrozen(first.events[0])).toBe(true);
  });

  it("continues identically after an authoritative checkpoint round trip", () => {
    const initial = gameplayEngine.createRun(config);
    const checkpoint = gameplayEngine.step(initial, []).state;
    const restored = JSON.parse(JSON.stringify(checkpoint)) as RunState;
    const commands = Object.freeze([Object.freeze({ type: "toggle-pause" })]);

    const uninterrupted = gameplayEngine.step(checkpoint, commands);
    const resumed = gameplayEngine.step(restored, commands);

    expect(resumed).toEqual(uninterrupted);
    expect(gameplayEngine.observe(resumed.state)).toEqual(
      gameplayEngine.observe(uninterrupted.state),
    );
  });
});
