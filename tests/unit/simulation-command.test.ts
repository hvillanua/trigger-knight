import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { describe, expect, it } from "vitest";

import type {
  GameCommand,
  ProfileInput,
  RunState,
  SimulationComparisonInput,
} from "../../src/application/contracts.js";
import {
  createRuleSetRegistry,
  originalV13RuleSet,
} from "../../src/domain/rulesets.js";
import type { RuleSetRegistry } from "../../src/domain/rulesets.js";

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const command = path.join(repositoryRoot, "build/run-simulation.mjs");
const minimalRequest = path.join(
  repositoryRoot,
  "tests/fixtures/simulation/minimal-request.json",
);
const manifest = path.join(
  repositoryRoot,
  "tests/fixtures/simulation/manifest.json",
);
const comparison = path.join(
  repositoryRoot,
  "tests/fixtures/simulation/comparison.json",
);

interface SimulationCommandModule {
  runSimulationCommand(
    mode: "batch" | "compare" | "replay",
    input: unknown,
    options?: { ruleSetRegistry?: RuleSetRegistry },
  ): Promise<string>;
}

function runCommand(...arguments_: string[]) {
  return spawnSync(process.execPath, [command, ...arguments_], {
    cwd: repositoryRoot,
    encoding: "utf8",
    env: { ...process.env },
    timeout: 30_000,
  });
}

describe("simulation command", () => {
  it("executes one retained request through the public simulator contract", () => {
    const result = runCommand("single", minimalRequest);

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    const output = JSON.parse(result.stdout) as {
      seed: string;
      terminalReason: string;
      steps: number;
    };
    expect(output).toMatchObject({
      seed: "cli-minimal",
      terminalReason: "step-limit",
      steps: 3,
    });
  });

  it("executes a manifest and emits only a canonical machine-readable export", () => {
    const result = runCommand("batch", manifest);

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    const output = result.stdout;
    const parsed = JSON.parse(output) as {
      schemaVersion: number;
      manifest: { schemaVersion: number; requests: unknown[] };
      results: Array<{
        requestIndex: number;
        result: { terminalReason: string };
      }>;
    };
    expect(output).toBe(`${output.trim()}\n`);
    expect(parsed.schemaVersion).toBe(1);
    expect(parsed.manifest).toMatchObject({ schemaVersion: 1 });
    expect(parsed.manifest.requests).toHaveLength(2);
    expect(parsed.results).toHaveLength(2);
    expect(parsed.results.map((entry) => entry.result.terminalReason)).toEqual([
      "step-limit",
      "step-limit",
    ]);
  });

  it("reports invalid input on stderr with a failing exit status", () => {
    const result = runCommand(
      "batch",
      path.join(repositoryRoot, "missing.json"),
    );

    expect(result.status).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("Simulation command failed");
  });

  it("compares retained baseline and candidate manifests", () => {
    const result = runCommand("compare", comparison);

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    const output = JSON.parse(result.stdout) as {
      schemaVersion: number;
      pairs: Array<{ behavioralDifference: boolean }>;
      aggregateDifferences: { behavioralDifferenceCount: number };
    };
    expect(output.schemaVersion).toBe(1);
    expect(output.pairs).toHaveLength(1);
    expect(output.pairs[0]?.behavioralDifference).toBe(false);
    expect(output.aggregateDifferences.behavioralDifferenceCount).toBe(0);
    expect(result.stdout).toBe(`${result.stdout.trim()}\n`);
  });

  it("replays a retained case and emits host diagnostics", async () => {
    const batch = runCommand("batch", manifest);
    expect(batch.status).toBe(0);

    const commandModule = (await import(
      pathToFileURL(command).href
    )) as unknown as SimulationCommandModule;
    const retained = JSON.parse(batch.stdout) as unknown;
    const output = await commandModule.runSimulationCommand("replay", {
      schemaVersion: 1,
      mode: "case",
      experiment: retained,
      requestIndex: 0,
    });
    const parsed = JSON.parse(output) as {
      mode: string;
      run: {
        resultMatches: boolean;
        traceIdentityMatches: boolean;
      };
    };

    expect(parsed).toMatchObject({
      mode: "case",
      run: { resultMatches: true, traceIdentityMatches: true },
    });

    const pairOutput = await commandModule.runSimulationCommand("replay", {
      schemaVersion: 1,
      mode: "pair",
      policyComparison: "same-policy",
      baseline: retained,
      candidate: retained,
      baselineRequestIndex: 0,
      candidateRequestIndex: 0,
    });
    const pair = JSON.parse(pairOutput) as {
      mode: string;
      comparison: { behavioralDifference: unknown };
    };
    expect(pair).toMatchObject({
      mode: "pair",
      comparison: { behavioralDifference: null },
    });
  });

  it("dispatches a test-only candidate through the command integration", async () => {
    const candidateRuleset = Object.freeze({
      ...originalV13RuleSet,
      id: "test-command-candidate-v1",
      createRun(seed: string, initialProfile: Readonly<ProfileInput>) {
        const state = originalV13RuleSet.createRun(seed, initialProfile);
        return Object.freeze({
          ...state,
          ruleset: "test-command-candidate-v1",
        });
      },
      step(state: Readonly<RunState>, commands: readonly GameCommand[]) {
        const result = originalV13RuleSet.step(state, commands);
        return Object.freeze({
          ...result,
          state: Object.freeze({
            ...result.state,
            score: result.state.score + 1,
          }),
        });
      },
    });
    const input: SimulationComparisonInput = {
      schemaVersion: 1,
      policyComparison: "same-policy",
      baseline: {
        schemaVersion: 1,
        requests: [
          {
            config: {
              ruleset: "original-v1.3",
              seed: "command-candidate",
              initialProfile: { schemaVersion: 1, scoreMultiplier: 1 },
            },
            policy: { id: "non-progressing", version: "1", config: {} },
            maxSteps: 3,
          },
        ],
      },
      candidate: {
        schemaVersion: 1,
        requests: [
          {
            config: {
              ruleset: "test-command-candidate-v1",
              seed: "command-candidate",
              initialProfile: { schemaVersion: 1, scoreMultiplier: 1 },
            },
            policy: { id: "non-progressing", version: "1", config: {} },
            maxSteps: 3,
          },
        ],
      },
    };
    const commandModule = (await import(
      pathToFileURL(command).href
    )) as unknown as SimulationCommandModule;

    const output = await commandModule.runSimulationCommand("compare", input, {
      ruleSetRegistry: createRuleSetRegistry([
        originalV13RuleSet,
        candidateRuleset,
      ]),
    });
    const parsed = JSON.parse(output) as {
      pairs: Array<{
        candidate: { ruleset: string };
        deltas: { score: number };
      }>;
      aggregateDifferences: { behavioralDifferenceCount: number };
    };

    expect(parsed.pairs[0]?.candidate.ruleset).toBe(
      "test-command-candidate-v1",
    );
    expect(parsed.pairs[0]?.deltas.score).toBe(3);
    expect(parsed.aggregateDifferences.behavioralDifferenceCount).toBe(1);
  });
});
