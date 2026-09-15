import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { beforeAll, describe, expect, it } from "vitest";

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const runner = path.join(repositoryRoot, "build/run-validation.mjs");
const fixture = path.join(repositoryRoot, "tests/fixtures/validation-runner");

interface ValidationResult {
  status: number;
  stderr: string;
  stdout: string;
}

interface ValidationRunnerModule {
  runValidation(
    gate: "fast" | "full",
    options?: {
      cwd?: string;
      runCommand?: (
        command: string,
        arguments_: string[],
        options: { cwd: string; encoding: "utf8"; maxBuffer: number },
      ) => {
        error?: Error;
        status: number | null;
        stderr: string;
        stdout: string;
      };
    },
  ): ValidationResult;
}

let validationRunner: ValidationRunnerModule | undefined;

beforeAll(async () => {
  validationRunner = (await import(
    pathToFileURL(runner).href
  )) as ValidationRunnerModule;
});

function runValidationInProcess(gate: "fast" | "full", failingGate?: string) {
  if (!validationRunner) {
    throw new Error("validation runner was not initialized");
  }

  const calls: string[] = [];
  const result = validationRunner.runValidation(gate, {
    cwd: fixture,
    runCommand: (_command, arguments_) => {
      const script = arguments_.at(-1);
      if (!script) {
        throw new Error("validation command did not include a script");
      }
      calls.push(script);

      const failed = script === failingGate;
      return {
        status: failed ? 7 : 0,
        stdout: `fixture stdout: ${script}\n`,
        stderr: `fixture stderr: ${script}\n`,
      };
    },
  });

  return { ...result, calls };
}

function runValidationCli(gate: "fast" | "full") {
  return spawnSync(process.execPath, [runner, gate], {
    cwd: fixture,
    encoding: "utf8",
  });
}

describe("validation runner", () => {
  it("prints concise success lines in gate order", () => {
    const result = runValidationInProcess("full");

    expect(result.status).toBe(0);
    expect(result.stdout).toBe(
      [
        "format:check",
        "lint",
        "check:architecture",
        "typecheck",
        "test:unit",
        "test:browser",
        "build",
      ]
        .map((gate) => `PASS ${gate}\n`)
        .join(""),
    );
    expect(result.stderr).toBe("");
    expect(result.calls).toEqual([
      "format:check",
      "lint",
      "check:architecture",
      "typecheck",
      "test:unit",
      "test:browser",
      "build",
    ]);
  });

  it("prints failure diagnostics, preserves the status, and stops", () => {
    const result = runValidationInProcess("fast", "lint");

    expect(result.status).toBe(7);
    expect(result.stdout).toBe("PASS format:check\nfixture stdout: lint\n");
    expect(result.stderr).toBe("fixture stderr: lint\n");
    expect(result.stdout).not.toContain("PASS lint");
    expect(result.stdout).not.toContain("check:architecture");
    expect(result.calls).toEqual(["format:check", "lint"]);
  });

  it("keeps the CLI runner path covered", () => {
    const result = runValidationCli("full");

    expect(result.status).toBe(0);
    expect(result.stdout).toBe(
      [
        "format:check",
        "lint",
        "check:architecture",
        "typecheck",
        "test:unit",
        "test:browser",
        "build",
      ]
        .map((gate) => `PASS ${gate}\n`)
        .join(""),
    );
    expect(result.stderr).toBe("");
  });
});
