import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { shouldSkipCodeValidation } from "../../build/run-push-validation.mjs";

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);

describe("local validation hooks", () => {
  it("runs the complete validation gate only before pushes", () => {
    const hooksDirectory = path.join(repositoryRoot, ".githooks");

    const hook = readFileSync(path.join(hooksDirectory, "pre-push"), "utf8");
    expect(hook).toContain("node build/run-push-validation.mjs");
    expect(hook).toContain("--no-renames");
    expect(hook).toContain("code-affecting-unknown-range");
    expect(existsSync(path.join(hooksDirectory, "pre-commit"))).toBe(false);
  });

  it("skips code validation only for documentation-only changes", () => {
    expect(
      shouldSkipCodeValidation(["README.md", "docs/test-performance.md"]),
    ).toBe(true);
    expect(shouldSkipCodeValidation(["README.md", "src/main.ts"])).toBe(false);
    expect(shouldSkipCodeValidation(["src/main.ts", "docs/example.md"])).toBe(
      false,
    );
    expect(shouldSkipCodeValidation([])).toBe(false);
  });

  it("keeps hook activation available without adding another validation trigger", () => {
    const packageManifest = JSON.parse(
      readFileSync(path.join(repositoryRoot, "package.json"), "utf8"),
    ) as { scripts: Record<string, string> };

    expect(packageManifest.scripts.prepare).toBe("npm run setup:hooks");
    expect(packageManifest.scripts["setup:hooks"]).toBe(
      "node build/install-git-hooks.mjs",
    );
  });
});
