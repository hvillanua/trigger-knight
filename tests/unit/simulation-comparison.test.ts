import { describe, expect, it } from "vitest";

import { createGameplayEngine } from "../../src/application/gameplay-engine.js";
import { stringifyCanonicalJson } from "../../src/application/canonical-json.js";
import type {
  ProfileInput,
  RunState,
  SimulationComparisonInput,
} from "../../src/application/contracts.js";
import {
  createRuleSetRegistry,
  originalV13RuleSet,
} from "../../src/domain/rulesets.js";
import { createSimulationComparison } from "../../src/simulation/simulation-comparison.js";
import { createSimulationRunner } from "../../src/simulation/simulation-runner.js";
import { createTestGameplayEngine } from "../helpers/gameplay-engine.js";

const profile = { schemaVersion: 1, scoreMultiplier: 1 } as const;

function manifest(
  ruleset: string,
  seed = "comparison",
  policy = { id: "non-progressing", version: "1", config: {} },
): SimulationComparisonInput["baseline"] {
  return {
    schemaVersion: 1,
    requests: [
      {
        config: { ruleset, seed, initialProfile: profile },
        policy,
        maxSteps: 3,
      },
    ],
  };
}

function input(
  baseline: SimulationComparisonInput["baseline"],
  candidate: SimulationComparisonInput["candidate"],
  policyComparison: SimulationComparisonInput["policyComparison"] = "same-policy",
): SimulationComparisonInput {
  return { schemaVersion: 1, baseline, candidate, policyComparison };
}

describe("simulation comparisons", () => {
  it("pairs identical inputs and reports zero deltas for self-comparison", async () => {
    const engine = createTestGameplayEngine();
    const report = await createSimulationComparison(
      createSimulationRunner(engine),
    ).run(input(manifest("original-v1.3"), manifest("original-v1.3")));

    expect(report.schemaVersion).toBe(1);
    expect(report.pairs).toHaveLength(1);
    expect(report.pairs[0]!.behavioralDifference).toBe(false);
    expect(report.pairs[0]!.deltas).toEqual({
      activeTicks: 0,
      day: 0,
      distance: 0,
      gold: 0,
      score: 0,
      steps: 0,
      metrics: Object.fromEntries(
        Object.keys(report.pairs[0]!.deltas.metrics).map((key) => [key, 0]),
      ),
    });
    expect(report.aggregateDifferences.score).toMatchObject({
      count: 1,
      sum: 0,
      mean: 0,
      minimum: 0,
      maximum: 0,
    });
    expect(report.aggregateDifferences.behavioralDifferenceCount).toBe(0);
  });

  it("detects a test-only candidate ruleset through engine dispatch", async () => {
    const candidateRuleset = Object.freeze({
      ...originalV13RuleSet,
      id: "test-candidate-v1",
      createRun(seed: string, initialProfile: Readonly<ProfileInput>) {
        const state = originalV13RuleSet.createRun(seed, initialProfile);
        return Object.freeze({ ...state, ruleset: "test-candidate-v1" });
      },
      step(state: Readonly<RunState>, commands: readonly { type: string }[]) {
        const result = originalV13RuleSet.step(
          state,
          commands as Parameters<typeof originalV13RuleSet.step>[1],
        );
        return Object.freeze({
          ...result,
          state: Object.freeze({
            ...result.state,
            score: result.state.score + 1,
          }),
        });
      },
    });
    const engine = createGameplayEngine(
      createRuleSetRegistry([originalV13RuleSet, candidateRuleset]),
    );
    const report = await createSimulationComparison(
      createSimulationRunner(engine),
    ).run(input(manifest("original-v1.3"), manifest("test-candidate-v1")));

    expect(report.pairs[0]!.behavioralDifference).toBe(true);
    expect(report.pairs[0]!.deltas.score).toBe(3);
    expect(report.aggregateDifferences.score.sum).toBe(3);
  });

  it("does not call different ruleset identities alone a behavioral difference", async () => {
    const candidateRuleset = Object.freeze({
      ...originalV13RuleSet,
      id: "identity-only-v1",
      createRun(seed: string, initialProfile: Readonly<ProfileInput>) {
        const state = originalV13RuleSet.createRun(seed, initialProfile);
        return Object.freeze({ ...state, ruleset: "identity-only-v1" });
      },
    });
    const engine = createGameplayEngine(
      createRuleSetRegistry([originalV13RuleSet, candidateRuleset]),
    );
    const report = await createSimulationComparison(
      createSimulationRunner(engine),
    ).run(input(manifest("original-v1.3"), manifest("identity-only-v1")));

    expect(report.pairs[0]!.baseline.ruleset).not.toBe(
      report.pairs[0]!.candidate.ruleset,
    );
    expect(report.pairs[0]!.baseline.traceHash).not.toBe(
      report.pairs[0]!.candidate.traceHash,
    );
    expect(report.pairs[0]!.behavioralDifference).toBe(false);
    expect(report.pairs[0]!.deltas.score).toBe(0);
  });

  it("requires exact pair keys unless policy comparison is explicitly allowed", async () => {
    const runner = createSimulationRunner(createTestGameplayEngine());
    const comparison = createSimulationComparison(runner);

    await expect(
      comparison.run(
        input(manifest("original-v1.3", "a"), manifest("original-v1.3", "b")),
      ),
    ).rejects.toThrowError(/missing|ambiguous/i);

    await expect(
      comparison.run(
        input(
          manifest("original-v1.3", "same", {
            id: "non-progressing",
            version: "1",
            config: {},
          }),
          manifest("original-v1.3", "same", {
            id: "purchase-reachable-shops",
            version: "2",
            config: {},
          }),
        ),
      ),
    ).rejects.toThrowError(/policy comparison|policy/i);

    await expect(
      comparison.run(
        input(
          manifest("original-v1.3", "same", {
            id: "non-progressing",
            version: "1",
            config: {},
          }),
          manifest("original-v1.3", "same", {
            id: "purchase-reachable-shops",
            version: "2",
            config: {},
          }),
          "allow-different",
        ),
      ),
    ).resolves.toMatchObject({ pairs: [{ behavioralDifference: false }] });
  });

  it("serializes repeated comparisons byte-for-byte", async () => {
    const comparison = createSimulationComparison(
      createSimulationRunner(createTestGameplayEngine()),
    );
    const comparisonInput = input(
      manifest("original-v1.3", "stable"),
      manifest("original-v1.3", "stable"),
    );

    const first = await comparison.run(comparisonInput);
    const second = await comparison.run(comparisonInput);

    expect(stringifyCanonicalJson(second)).toBe(stringifyCanonicalJson(first));
  });

  it("rejects ambiguous duplicate requests", async () => {
    const runner = createSimulationRunner(createTestGameplayEngine());
    const duplicate = manifest("original-v1.3", "duplicate");

    await expect(
      createSimulationComparison(runner).run(
        input(
          {
            schemaVersion: 1,
            requests: [...duplicate.requests, ...duplicate.requests],
          },
          duplicate,
        ),
      ),
    ).rejects.toThrowError(/ambiguous/i);
  });
});
