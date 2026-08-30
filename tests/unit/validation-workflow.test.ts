import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);

function readPackageScripts() {
  return (
    JSON.parse(
      readFileSync(path.join(repositoryRoot, "package.json"), "utf8"),
    ) as { scripts: Record<string, string> }
  ).scripts;
}

function inTemporaryDirectory(run: (directory: string) => void) {
  const directory = mkdtempSync(
    path.join(os.tmpdir(), "trigger-knight-validation-"),
  );

  try {
    run(directory);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

function writeFixturePackage(directory: string, lintFails: boolean) {
  const passingScript = "node -e \"console.log('DETAIL')\"";
  const scripts = Object.fromEntries(
    [
      "format:check",
      "lint",
      "check:architecture",
      "typecheck",
      "test:unit",
      "test:browser",
      "build",
    ].map((name) => [name, passingScript]),
  );
  scripts.lint = lintFails
    ? "node -e \"console.error('LINT_DETAIL'); process.exit(1)\""
    : passingScript;

  writeFileSync(
    path.join(directory, "package.json"),
    `${JSON.stringify({ private: true, scripts }, null, 2)}\n`,
  );
}

function installValidationRunner(directory: string) {
  mkdirSync(path.join(directory, "build"));
  copyFileSync(
    path.join(repositoryRoot, "build/run-validation.mjs"),
    path.join(directory, "build/run-validation.mjs"),
  );
}

function runValidation(directory: string, gate: "fast" | "full") {
  return spawnSync(
    process.execPath,
    [path.join(directory, "build/run-validation.mjs"), gate],
    { cwd: directory, encoding: "utf8" },
  );
}

describe("validation workflow", () => {
  it("leaves commits and pushes free of repository-owned validation hooks", () => {
    const scripts = readPackageScripts();

    expect(scripts.prepare).toBeUndefined();
    expect(scripts["setup:hooks"]).toBeUndefined();
    expect(existsSync(path.join(repositoryRoot, ".githooks/pre-commit"))).toBe(
      false,
    );
    expect(existsSync(path.join(repositoryRoot, ".githooks/pre-push"))).toBe(
      false,
    );
    expect(
      existsSync(path.join(repositoryRoot, "build/install-git-hooks.mjs")),
    ).toBe(false);
  });

  it("keeps repository-wide Prettier formatting", () => {
    const scripts = readPackageScripts();

    expect(scripts.format).toBe("prettier --write . --ignore-unknown");
    expect(scripts["format:check"]).toBe("prettier --check . --ignore-unknown");
  });

  it("prints one concise line per successful validation step", () => {
    inTemporaryDirectory((directory) => {
      writeFixturePackage(directory, false);
      installValidationRunner(directory);

      const validation = runValidation(directory, "fast");

      expect(validation.status).toBe(0);
      expect(validation.stderr).toBe("");
      expect(validation.stdout).not.toContain("DETAIL");
      expect(validation.stdout.trim().split("\n")).toEqual([
        "PASS format:check",
        "PASS lint",
        "PASS check:architecture",
        "PASS typecheck",
        "PASS test:unit",
      ]);
    });
  });

  it("prints the failing step output and stops the gate", () => {
    inTemporaryDirectory((directory) => {
      writeFixturePackage(directory, true);
      installValidationRunner(directory);

      const validation = runValidation(directory, "fast");

      expect(validation.status).toBe(1);
      expect(validation.stdout).toContain("PASS format:check");
      expect(validation.stderr).toContain("LINT_DETAIL");
      expect(validation.stdout).not.toContain("PASS check:architecture");
    });
  });
});
