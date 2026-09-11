import { describe, expect, it } from "vitest";

import { createGameplayEngine } from "../../src/application/gameplay-engine.js";
import type {
  GameCommand,
  ProfileInput,
  RunState,
  SimulationManifest,
  SimulationReplayInput,
} from "../../src/application/contracts.js";
import {
  createRuleSetRegistry,
  originalV13RuleSet,
} from "../../src/domain/rulesets.js";
import { simulationPolicyRegistry } from "../../src/simulation/policy-registry.js";
import {
  createSimulationExperiment,
  normalizeSimulationBatchExport,
} from "../../src/simulation/simulation-experiment.js";
import {
  createSimulationReplay,
  normalizeSimulationReplayInput,
} from "../../src/simulation/simulation-replay.js";
import { createSimulationRunner } from "../../src/simulation/simulation-runner.js";

const profile = { schemaVersion: 1, scoreMultiplier: 1 } as const;

function manifest(ruleset: string, seed = "replay"): SimulationManifest {
  return {
    schemaVersion: 1,
    requests: [
      {
        config: { ruleset, seed, initialProfile: profile },
        policy: { id: "non-progressing", version: "1", config: {} },
        maxSteps: 3,
      },
    ],
  };
}

function candidateRuleSet(id: string, scoreDelta = 0) {
  return Object.freeze({
    ...originalV13RuleSet,
    id,
    createRun(seed: string, initialProfile: Readonly<ProfileInput>) {
      const state = originalV13RuleSet.createRun(seed, initialProfile);
      return Object.freeze({ ...state, ruleset: id });
    },
    step(state: Readonly<RunState>, commands: readonly GameCommand[]) {
      const result = originalV13RuleSet.step(state, commands);
      return Object.freeze({
        ...result,
        state: Object.freeze({
          ...result.state,
          score: result.state.score + scoreDelta,
          ruleset: id,
        }),
      });
    },
  });
}

async function retained(
  engine: ReturnType<typeof createGameplayEngine>,
  input: SimulationManifest,
) {
  return createSimulationExperiment(
    createSimulationRunner(engine),
    simulationPolicyRegistry,
  ).run(input);
}

describe("simulation replay", () => {
  it("replays a retained case with a fresh policy agent and matches its result identity", async () => {
    const engine = createGameplayEngine(
      createRuleSetRegistry([originalV13RuleSet]),
    );
    const experiment = await retained(engine, manifest("original-v1.3"));

    const report = await createSimulationReplay(engine).run({
      schemaVersion: 1,
      mode: "case",
      experiment,
      requestIndex: 0,
    });

    expect(report.mode).toBe("case");
    if (report.mode !== "case") {
      throw new Error("Expected a case replay report");
    }
    expect(report.run.resultMatches).toBe(true);
    expect(report.run.traceIdentityMatches).toBe(true);
    expect(report.run.replayedTraceHash).toMatch(/^sha256-v1:/);

    const stale = {
      ...experiment,
      results: experiment.results.map((entry) => ({
        ...entry,
        result: { ...entry.result, score: entry.result.score + 1 },
      })),
    };
    const staleReport = await createSimulationReplay(engine).run({
      schemaVersion: 1,
      mode: "case",
      experiment: stale,
      requestIndex: 0,
    });
    if (staleReport.mode !== "case") {
      throw new Error("Expected a case replay report");
    }
    expect(staleReport.run.resultMatches).toBe(false);
  });

  it("replays a pair and reports ruleset identity separately from behavior", async () => {
    const candidate = candidateRuleSet("identity-only-v1");
    const engine = createGameplayEngine(
      createRuleSetRegistry([originalV13RuleSet, candidate]),
    );
    const baseline = await retained(engine, manifest("original-v1.3"));
    const candidateExport = await retained(
      engine,
      manifest("identity-only-v1"),
    );

    const report = await createSimulationReplay(engine).run({
      schemaVersion: 1,
      mode: "pair",
      policyComparison: "same-policy",
      baseline,
      candidate: candidateExport,
      baselineRequestIndex: 0,
      candidateRequestIndex: 0,
    });

    if (report.mode !== "pair") {
      throw new Error("Expected a pair replay report");
    }
    expect(report.baseline.resultMatches).toBe(true);
    expect(report.candidate.resultMatches).toBe(true);
    expect(report.comparison.identityDifferences).toEqual([
      {
        path: "config.ruleset",
        expected: "original-v1.3",
        actual: "identity-only-v1",
      },
    ]);
    expect(report.comparison.behavioralDifference).toBeNull();
  });

  it("reports a state divergence from a retained pair", async () => {
    const candidate = candidateRuleSet("state-difference-v1", 1);
    const engine = createGameplayEngine(
      createRuleSetRegistry([originalV13RuleSet, candidate]),
    );
    const baseline = await retained(engine, manifest("original-v1.3"));
    const candidateExport = await retained(
      engine,
      manifest("state-difference-v1"),
    );

    const report = await createSimulationReplay(engine).run({
      schemaVersion: 1,
      mode: "pair",
      policyComparison: "same-policy",
      baseline,
      candidate: candidateExport,
      baselineRequestIndex: 0,
      candidateRequestIndex: 0,
    });

    if (report.mode !== "pair") {
      throw new Error("Expected a pair replay report");
    }
    expect(report.comparison.behavioralDifference).toMatchObject({
      step: 1,
      kind: "state",
      path: "checkpoints[1].state.score",
      expected: 0,
      actual: 1,
    });
  });

  it("rejects incompatible pair selections and unsupported replay versions", async () => {
    const engine = createGameplayEngine(
      createRuleSetRegistry([originalV13RuleSet]),
    );
    const first = await retained(engine, manifest("original-v1.3", "first"));
    const second = await retained(engine, manifest("original-v1.3", "second"));

    await expect(
      createSimulationReplay(engine).run({
        schemaVersion: 1,
        mode: "pair",
        policyComparison: "same-policy",
        baseline: first,
        candidate: second,
        baselineRequestIndex: 0,
        candidateRequestIndex: 0,
      }),
    ).rejects.toThrowError(/incompatible.*seed/i);

    expect(() =>
      normalizeSimulationReplayInput({
        schemaVersion: 2,
        mode: "case",
        experiment: first,
        requestIndex: 0,
      }),
    ).toThrowError(/unsupported.*replay.*schemaVersion/i);
    expect(() =>
      normalizeSimulationBatchExport({
        schemaVersion: 1,
        manifest: first.manifest,
        results: [],
      }),
    ).toThrowError(/results|request/i);
  });

  it("accepts only explicit case or pair selections", () => {
    const invalid = {
      schemaVersion: 1,
      mode: "case",
      requestIndex: 0,
    } as unknown as SimulationReplayInput;

    expect(() => normalizeSimulationReplayInput(invalid)).toThrowError(
      /experiment/i,
    );
  });
});
