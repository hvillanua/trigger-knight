import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const runner = path.join(repositoryRoot, "build/run-validation.mjs");
const fixture = path.join(repositoryRoot, "tests/fixtures/validation-runner");

function runValidation(gate: "fast" | "full", failingGate?: string) {
  const environment = { ...process.env };

  if (failingGate) {
    environment.VALIDATION_FIXTURE_FAILURE = failingGate;
  } else {
    delete environment.VALIDATION_FIXTURE_FAILURE;
  }

  return spawnSync(process.execPath, [runner, gate], {
    cwd: fixture,
    encoding: "utf8",
    env: environment,
  });
}

describe("validation runner", () => {
  it("prints concise success lines in gate order", () => {
    const result = runValidation("full");

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

  it("prints failure diagnostics, preserves the status, and stops", () => {
    const result = runValidation("fast", "lint");

    expect(result.status).toBe(7);
    expect(result.stdout).toBe("PASS format:check\nfixture stdout: lint\n");
    expect(result.stderr).toBe("fixture stderr: lint\n");
    expect(result.stdout).not.toContain("PASS lint");
    expect(result.stdout).not.toContain("check:architecture");
  });
});
