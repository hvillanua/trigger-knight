import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

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
});
