import { describe, expect, it, vi } from "vitest";

import type {
  GameCommand,
  GameEvent,
  GameObservation,
  GameplayEngine,
  PlayerPolicy,
  RunConfig,
  SimulationRequest,
} from "../../src/application/contracts.js";
import { ORIGINAL_V13_RULESET_ID } from "../../src/domain/rulesets.js";
import { nonProgressingPolicy } from "../../src/simulation/non-progressing-policy.js";
import { createSimulationRunner } from "../../src/simulation/simulation-runner.js";
import { createTestGameplayEngine } from "../helpers/gameplay-engine.js";

const gameplayEngine = createTestGameplayEngine();

const config: RunConfig = Object.freeze({
  ruleset: ORIGINAL_V13_RULESET_ID,
  seed: "simulation-seed",
  initialProfile: Object.freeze({ schemaVersion: 1, scoreMultiplier: 1 }),
});

function request(
  policy: PlayerPolicy = nonProgressingPolicy,
  overrides: Partial<SimulationRequest> = {},
): SimulationRequest {
  return {
    config,
    policy,
    maxSteps: 3,
    ...overrides,
  };
}

function tutorialGatedObservation(steps: number): GameObservation {
  return {
    ruleset: ORIGINAL_V13_RULESET_ID,
    camera: {
      x: 0,
      y: 0,
      width: 480,
      height: 320,
    },
    steps,
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
      weapon: { tier: 1, name: "Dagger", attack: 216 },
      armor: { tier: 1, name: "Clothing" },
      hp: { current: 1_908, maximum: 1_908 },
      inventory: { item: "elixir" },
    },
    battle: null,
    encounters: {
      current: null,
      upcoming: [
        { kind: "battle" },
        { kind: "shop", shop: "bladesmith", cachedPrice: 236 },
        { kind: "shop", shop: "armorsmith", cachedPrice: 204 },
      ],
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
      canPurchaseCurrentEncounter: false,
      canUseCarriedItem: false,
    },
  };
}

describe("headless simulation runner", () => {
  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY, 1.5])(
    "rejects invalid step limit %s",
    (maxSteps) => {
      const runner = createSimulationRunner(gameplayEngine);

      expect(() =>
        runner.run(request(nonProgressingPolicy, { maxSteps })),
      ).toThrowError("maxSteps must be a positive safe integer");
    },
  );

  it("terminates a non-progressing run at its finite step limit", () => {
    const runner = createSimulationRunner(gameplayEngine);
    const firstAgent = nonProgressingPolicy.createAgent();
    const secondAgent = nonProgressingPolicy.createAgent();

    const result = runner.run(request());

    expect(secondAgent).not.toBe(firstAgent);
    expect(result).toEqual({
      schemaVersion: 2,
      ruleset: ORIGINAL_V13_RULESET_ID,
      seed: "simulation-seed",
      initialProfileFingerprint:
        "sha256-v1:16560d87b48392edba4291a11362cae68bf8a4e7f8c60c226a6f62f37330f211",
      policy: {
        id: "non-progressing",
        version: "1",
        config: {},
      },
      maxSteps: 3,
      steps: 3,
      activeTicks: 0,
      terminalReason: "step-limit",
      score: 0,
      day: 1,
      distance: 0,
      gold: 300,
      traceHash:
        "sha256-v1:c2cf401f3c2b8aa0f860b57362d53c9ab1566b455ecb68b4e08dedaba83550f2",
      metrics: {},
    });
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.policy)).toBe(true);
    expect(Object.isFrozen(result.policy.config)).toBe(true);
    expect(Object.isFrozen(result.metrics)).toBe(true);
  });

  it("passes the current public observation and only preceding-step events to policy decisions", () => {
    const inputs: Array<{
      observation: Readonly<GameObservation>;
      events: readonly GameEvent[];
    }> = [];
    const policy: PlayerPolicy = {
      descriptor: { id: "record-inputs", version: "1", config: {} },
      createAgent: () => ({
        decide(observation, events) {
          inputs.push({ observation, events });
          return Object.freeze([]);
        },
      }),
    };
    const runner = createSimulationRunner(gameplayEngine);

    runner.run(request(policy));

    expect(inputs).toEqual([
      {
        observation: tutorialGatedObservation(0),
        events: [],
      },
      {
        observation: tutorialGatedObservation(1),
        events: [{ type: "step-advanced", step: 1 }],
      },
      {
        observation: tutorialGatedObservation(2),
        events: [{ type: "step-advanced", step: 2 }],
      },
    ]);
  });

  it("reports active ticks from authoritative lifecycle state", () => {
    const dismissTutorialPolicy: PlayerPolicy = {
      descriptor: { id: "dismiss-tutorial", version: "1", config: {} },
      createAgent: () => ({
        decide: () => [{ type: "dismiss-tutorial" }],
      }),
    };
    const runner = createSimulationRunner(gameplayEngine);

    const result = runner.run(request(dismissTutorialPolicy, { maxSteps: 62 }));

    expect(result).toMatchObject({
      steps: 62,
      activeTicks: 2,
      score: 30,
      day: 1,
      distance: 3,
    });
  });

  it("reads result gold from authoritative run state", () => {
    const authoritativeGoldEngine: GameplayEngine = {
      ...gameplayEngine,
      createRun(runConfig) {
        const state = gameplayEngine.createRun(runConfig);

        return Object.freeze({
          ...state,
          player: Object.freeze({ ...state.player, gold: 271 }),
        });
      },
    };
    const runner = createSimulationRunner(authoritativeGoldEngine);

    expect(runner.run(request()).gold).toBe(271);
  });

  it("stops at lifespan death and reports the actual run totals", () => {
    const dismissTutorialPolicy: PlayerPolicy = {
      descriptor: { id: "dismiss-tutorial", version: "1", config: {} },
      createAgent: () => {
        let firstDecision = true;

        return {
          decide: () => {
            if (firstDecision) {
              firstDecision = false;
              return [{ type: "dismiss-tutorial" }];
            }

            return [];
          },
        };
      },
    };
    const runner = createSimulationRunner(gameplayEngine);

    const result = runner.run(
      request(dismissTutorialPolicy, { maxSteps: 3_000 }),
    );

    expect(result).toMatchObject({
      maxSteps: 3_000,
      steps: 2_560,
      activeTicks: 2_500,
      terminalReason: "lifespan",
      score: 14_400,
      day: 1,
      distance: 1_440,
    });
  });

  it("returns step-limit when the budget is reached before lifespan death", () => {
    const dismissTutorialPolicy: PlayerPolicy = {
      descriptor: { id: "dismiss-tutorial", version: "1", config: {} },
      createAgent: () => ({
        decide: (observation) =>
          observation.actions.canDismissTutorial
            ? [{ type: "dismiss-tutorial" }]
            : [],
      }),
    };
    const runner = createSimulationRunner(gameplayEngine);

    const result = runner.run(
      request(dismissTutorialPolicy, { maxSteps: 2_559 }),
    );

    expect(result).toMatchObject({
      steps: 2_559,
      activeTicks: 2_499,
      terminalReason: "step-limit",
      score: 14_400,
      day: 1,
      distance: 1_440,
    });
  });

  it("repeats normalized results and isolates mutable agent memory by run", () => {
    const createAgent = vi.fn(() => {
      let decisions = 0;

      return {
        decide(): readonly GameCommand[] {
          decisions += 1;
          return Object.freeze([
            Object.freeze({
              type: decisions % 2 === 0 ? "dismiss-tutorial" : "toggle-pause",
            }),
          ]);
        },
      };
    });
    const policy: PlayerPolicy = {
      descriptor: {
        id: "stateful-test",
        version: "1",
        config: { zeta: 2, alpha: { enabled: true } },
      },
      createAgent,
    };
    const runner = createSimulationRunner(gameplayEngine);
    const simulationRequest = request(policy);

    const first = runner.run(simulationRequest);
    const repeated = runner.run(simulationRequest);

    expect(repeated).toEqual(first);
    expect(repeated.traceHash).toBe(first.traceHash);
    expect(createAgent).toHaveBeenCalledTimes(2);
    expect(Object.keys(first.policy.config)).toEqual(["alpha", "zeta"]);
  });

  it("fingerprints equivalent profile records canonically", () => {
    const runner = createSimulationRunner(gameplayEngine);
    const profileWithFirstOrder = {
      schemaVersion: 1,
      scoreMultiplier: 1,
      progress: { level: 2, achievements: ["first-step"] },
    };
    const profileWithSecondOrder = {
      progress: { achievements: ["first-step"], level: 2 },
      scoreMultiplier: 1,
      schemaVersion: 1,
    };

    const first = runner.run(
      request(nonProgressingPolicy, {
        config: { ...config, initialProfile: profileWithFirstOrder },
      }),
    );
    const second = runner.run(
      request(nonProgressingPolicy, {
        config: { ...config, initialProfile: profileWithSecondOrder },
      }),
    );

    expect(second.initialProfileFingerprint).toBe(
      first.initialProfileFingerprint,
    );
    expect(second.traceHash).toBe(first.traceHash);
  });

  it("distinguishes profiles that collide under the former 32-bit fingerprint", () => {
    const runner = createSimulationRunner(gameplayEngine);
    const firstProfile = {
      schemaVersion: 1,
      scoreMultiplier: 1,
      nonce: 51_828,
    };
    const secondProfile = {
      schemaVersion: 1,
      scoreMultiplier: 1,
      nonce: 301_880,
    };
    const first = runner.run(
      request(nonProgressingPolicy, {
        config: {
          ...config,
          initialProfile: firstProfile,
        },
      }),
    );
    const second = runner.run(
      request(nonProgressingPolicy, {
        config: {
          ...config,
          initialProfile: secondProfile,
        },
      }),
    );

    expect(second.initialProfileFingerprint).not.toBe(
      first.initialProfileFingerprint,
    );
  });

  it("returns batch results in request order without sharing run state", async () => {
    const runner = createSimulationRunner(gameplayEngine);
    const first = request(nonProgressingPolicy, {
      config: { ...config, seed: "batch-first" },
      maxSteps: 1,
    });
    const second = request(nonProgressingPolicy, {
      config: { ...config, seed: "batch-second" },
      maxSteps: 2,
    });

    const results = await runner.runBatch([first, second]);

    expect(results).toEqual([runner.run(first), runner.run(second)]);
    expect(results.map((result) => result.seed)).toEqual([
      "batch-first",
      "batch-second",
    ]);
    expect(Object.isFrozen(results)).toBe(true);
  });
});
