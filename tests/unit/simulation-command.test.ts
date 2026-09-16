import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { beforeAll, describe, expect, it } from "vitest";

import type {
  GameCommand,
  ProfileInput,
  QueuedBattleEncounter,
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
const benchmark = path.join(
  repositoryRoot,
  "tests/fixtures/simulation/benchmark.json",
);

interface SimulationCommandModule {
  runSimulationCommand(
    mode: "batch" | "benchmark" | "compare" | "replay",
    input: unknown,
    options?: { ruleSetRegistry?: RuleSetRegistry },
  ): Promise<string>;
}

interface SimulationCommandDispatchModule {
  dispatchSimulationCommand(
    mode: string,
    input: unknown,
    dependencies: unknown,
  ): Promise<string>;
  loadSimulationCommandModules(
    mode: string,
    loadModule: (modulePath: string) => Promise<unknown>,
  ): Promise<unknown>;
}

let commandDispatchModule: SimulationCommandDispatchModule | undefined;

beforeAll(async () => {
  const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
  const build = spawnSync(npmCommand, ["run", "--silent", "build:simulation"], {
    cwd: repositoryRoot,
    encoding: "utf8",
  });
  if (build.status !== 0) {
    throw new Error(
      `Simulation Node build failed:\n${build.stdout}\n${build.stderr}`,
    );
  }

  commandDispatchModule = (await import(
    pathToFileURL(path.join(repositoryRoot, "build/simulation-command.mjs"))
      .href
  )) as SimulationCommandDispatchModule;
});

function runCommand(...arguments_: string[]) {
  return spawnSync(process.execPath, ["--expose-gc", command, ...arguments_], {
    cwd: repositoryRoot,
    encoding: "utf8",
    env: { ...process.env },
    timeout: 30_000,
  });
}

function runCommandWithInput(input: string, ...arguments_: string[]) {
  return spawnSync(process.execPath, ["--expose-gc", command, ...arguments_], {
    cwd: repositoryRoot,
    encoding: "utf8",
    env: { ...process.env },
    input,
    timeout: 30_000,
  });
}

function runNpmSimulation(...arguments_: string[]) {
  const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
  return spawnSync(
    npmCommand,
    ["run", "--silent", "simulate", "--", ...arguments_],
    {
      cwd: repositoryRoot,
      encoding: "utf8",
      env: { ...process.env },
      timeout: 30_000,
    },
  );
}

describe("simulation command", () => {
  it("dispatches every command through injected modules", async () => {
    if (!commandDispatchModule) {
      throw new Error("Simulation command dispatch was not initialized");
    }

    const canonical = {
      stringifyCanonicalJson(value: unknown) {
        return (value as { route: string }).route;
      },
    };
    const experiment = {
      normalizeSimulationRequestInput(input: unknown) {
        return input;
      },
      resolveSimulationRequest(input: unknown) {
        return input;
      },
      createSimulationExperiment() {
        return { run: () => ({ route: "batch" }) };
      },
      stringifySimulationBatchExport(value: unknown) {
        return (value as { route: string }).route;
      },
    };
    const dependencies = {
      canonical,
      engine: {},
      runner: {
        run: () => ({ route: "single" }),
      },
      experiment,
      comparison: {
        createSimulationComparison: () => ({
          run: () => ({ route: "compare" }),
        }),
      },
      replay: {
        createSimulationReplay: () => ({
          run: () => ({ route: "replay" }),
        }),
      },
      benchmark: {
        createSimulationBenchmark: () => ({
          run: () => ({ route: "benchmark" }),
        }),
      },
      benchmarkEnvironment: {},
    };

    await expect(
      commandDispatchModule.dispatchSimulationCommand(
        "single",
        {},
        dependencies,
      ),
    ).resolves.toBe("single");
    await expect(
      commandDispatchModule.dispatchSimulationCommand(
        "batch",
        {},
        dependencies,
      ),
    ).resolves.toBe("batch");
    await expect(
      commandDispatchModule.dispatchSimulationCommand(
        "compare",
        {},
        dependencies,
      ),
    ).resolves.toBe("compare");
    await expect(
      commandDispatchModule.dispatchSimulationCommand(
        "replay",
        {},
        dependencies,
      ),
    ).resolves.toBe("replay");
    await expect(
      commandDispatchModule.dispatchSimulationCommand(
        "benchmark",
        {},
        dependencies,
      ),
    ).resolves.toBe("benchmark");
  });

  it.each([
    [
      "single",
      [
        "application/gameplay-engine.js",
        "domain/rulesets.js",
        "simulation/canonical-json.js",
        "simulation/simulation-runner.js",
        "simulation/simulation-experiment.js",
      ],
    ],
    [
      "batch",
      [
        "application/gameplay-engine.js",
        "domain/rulesets.js",
        "simulation/canonical-json.js",
        "simulation/simulation-runner.js",
        "simulation/simulation-experiment.js",
      ],
    ],
    [
      "compare",
      [
        "application/gameplay-engine.js",
        "domain/rulesets.js",
        "simulation/canonical-json.js",
        "simulation/simulation-runner.js",
        "simulation/simulation-comparison.js",
      ],
    ],
    [
      "replay",
      [
        "application/gameplay-engine.js",
        "domain/rulesets.js",
        "simulation/canonical-json.js",
        "simulation/simulation-replay.js",
      ],
    ],
    [
      "benchmark",
      [
        "application/gameplay-engine.js",
        "domain/rulesets.js",
        "simulation/canonical-json.js",
        "simulation/simulation-runner.js",
        "simulation/simulation-benchmark.js",
      ],
    ],
  ])(
    "loads only the modules needed by %s",
    async (mode, expectedModulePaths) => {
      if (!commandDispatchModule) {
        throw new Error("Simulation command dispatch was not initialized");
      }

      const loadedModulePaths: string[] = [];
      await commandDispatchModule.loadSimulationCommandModules(
        mode,
        (modulePath) => {
          loadedModulePaths.push(modulePath);
          return Promise.resolve({});
        },
      );

      expect([...new Set(loadedModulePaths)].sort()).toEqual(
        [...expectedModulePaths].sort(),
      );
    },
  );

  it("keeps the npm script wired to the compiled entry point", () => {
    const result = runNpmSimulation("single", minimalRequest);

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    expect(JSON.parse(result.stdout)).toMatchObject({
      seed: "cli-minimal",
      terminalReason: "step-limit",
    });
  });

  it("executes one retained request through the public simulator contract", () => {
    const result = runCommand("single", minimalRequest);

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    const output = JSON.parse(result.stdout) as unknown as {
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

  it("reads a single request from stdin", () => {
    const result = runCommandWithInput(
      readFileSync(minimalRequest, "utf8"),
      "single",
      "-",
    );

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    expect(JSON.parse(result.stdout)).toMatchObject({
      seed: "cli-minimal",
      terminalReason: "step-limit",
      steps: 3,
    });
  });

  it("reports usage for an unsupported command", () => {
    const result = runCommand();

    expect(result.status).toBe(2);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("Usage: npm run simulate");
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

  it("executes the configured benchmark and separates operational metadata", () => {
    const result = runCommand("benchmark", benchmark);

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    const output = JSON.parse(result.stdout) as {
      schemaVersion: number;
      deterministic: {
        stable: boolean;
        resultCases: Array<{
          progressingRunCount: number;
          terminalReasons: { "step-limit": number };
        }>;
        comparisons: unknown[];
      };
      measurements: unknown[];
      host: { nodeVersion: string };
      targets: { met: boolean };
    };
    expect(output).toMatchObject({
      schemaVersion: 1,
      deterministic: { stable: true },
      targets: { met: true },
    });
    expect(typeof output.host.nodeVersion).toBe("string");
    expect(output.deterministic.resultCases.length).toBeGreaterThan(0);
    expect(
      output.deterministic.resultCases.some(
        ({ progressingRunCount }) => progressingRunCount > 0,
      ),
    ).toBe(true);
    expect(
      output.deterministic.resultCases.some(
        ({ terminalReasons }) => terminalReasons["step-limit"] > 0,
      ),
    ).toBe(true);
    expect(output.deterministic.comparisons.length).toBeGreaterThan(0);
    expect(output.measurements.length).toBeGreaterThan(0);
    expect(result.stdout).toBe(`${result.stdout.trim()}\n`);
  });

  it("serializes missing fields in a shop-versus-battle divergence", async () => {
    const candidateId = "missing-field-candidate-v1";
    const candidateRuleset = Object.freeze({
      ...originalV13RuleSet,
      id: candidateId,
      createRun(seed: string, initialProfile: Readonly<ProfileInput>) {
        const state = originalV13RuleSet.createRun(seed, initialProfile);
        const shopIndex = state.encounters.upcoming.findIndex(
          (encounter) => encounter.kind === "shop",
        );
        const battle = state.encounters.upcoming.find(
          (encounter): encounter is QueuedBattleEncounter =>
            encounter.kind === "battle",
        );
        if (shopIndex === -1 || battle === undefined) {
          throw new Error("Expected a shop and battle in the initial queue");
        }

        return Object.freeze({
          ...state,
          ruleset: candidateId,
          encounters: Object.freeze({
            ...state.encounters,
            upcoming: Object.freeze(
              state.encounters.upcoming.map((encounter, index) =>
                index === shopIndex ? battle : encounter,
              ),
            ),
          }),
        });
      },
      step(state: Readonly<RunState>, commands: readonly GameCommand[]) {
        const result = originalV13RuleSet.step(state, commands);
        return Object.freeze({
          ...result,
          state: Object.freeze({
            ...result.state,
            ruleset: candidateId,
          }),
        });
      },
    });
    const registry = createRuleSetRegistry([
      originalV13RuleSet,
      candidateRuleset,
    ]);
    const commandModule = (await import(
      pathToFileURL(command).href
    )) as unknown as SimulationCommandModule;
    const retainedInput = {
      schemaVersion: 1,
      requests: [
        {
          config: {
            ruleset: "original-v1.3",
            seed: "simulation-seed",
            initialProfile: { schemaVersion: 1, scoreMultiplier: 1 },
          },
          policy: { id: "non-progressing", version: "1", config: {} },
          maxSteps: 1,
        },
      ],
    };
    const retainedRequest = retainedInput.requests[0]!;
    const baseline = JSON.parse(
      await commandModule.runSimulationCommand("batch", retainedInput, {
        ruleSetRegistry: registry,
      }),
    ) as unknown;
    const candidate = JSON.parse(
      await commandModule.runSimulationCommand(
        "batch",
        {
          ...retainedInput,
          requests: [
            {
              ...retainedRequest,
              config: {
                ...retainedRequest.config,
                ruleset: candidateId,
              },
            },
          ],
        },
        {
          ruleSetRegistry: registry,
        },
      ),
    ) as unknown;

    const output = await commandModule.runSimulationCommand(
      "replay",
      {
        schemaVersion: 1,
        mode: "pair",
        policyComparison: "same-policy",
        baseline,
        candidate,
        baselineRequestIndex: 0,
        candidateRequestIndex: 0,
      },
      { ruleSetRegistry: registry },
    );
    const parsed = JSON.parse(output) as {
      comparison: {
        behavioralDifference: {
          path: string;
          actual: unknown;
        } | null;
      };
    };

    const difference = parsed.comparison.behavioralDifference;
    expect(difference).not.toBeNull();
    if (difference === null) {
      throw new Error("Expected a serialized missing-field divergence");
    }
    expect(difference.path).toContain(".cachedPrice");
    expect(difference.actual).toEqual({ kind: "missing" });
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
