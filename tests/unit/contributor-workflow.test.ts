import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);

function readRepositoryFile(relativePath: string) {
  return readFileSync(path.join(repositoryRoot, relativePath), "utf8");
}

describe("agent workflow", () => {
  it("documents authoritative sources, boundaries, TDD, and validation at the root", () => {
    const instructionsPath = path.join(repositoryRoot, "AGENTS.md");

    expect(existsSync(instructionsPath)).toBe(true);

    const instructions = readFileSync(instructionsPath, "utf8");

    for (const source of [
      "clean-room/PRD.md",
      "clean-room/TDD.md",
      "clean-room/TODO.md",
      "research/README.md",
    ]) {
      expect(instructions).toContain(source);
    }

    for (const boundary of [
      "original/",
      "decompiled/",
      "exports/",
      "src/",
      "tests/",
    ]) {
      expect(instructions).toContain(boundary);
    }

    expect(instructions).toMatch(/red.+green.+refactor/isu);
    expect(instructions).toContain("npm run validate:fast");
    expect(instructions).toContain("npm run validate");
  });
});

describe("contribution templates", () => {
  it.each([
    ".github/ISSUE_TEMPLATE/implementation.yml",
    ".github/ISSUE_TEMPLATE/milestone.yml",
    ".github/pull_request_template.md",
  ])("provides %s", (relativePath) => {
    expect(existsSync(path.join(repositoryRoot, relativePath))).toBe(true);
  });

  it("requires implementation tickets to state scope and context", () => {
    const template = readRepositoryFile(
      ".github/ISSUE_TEMPLATE/implementation.yml",
    );

    for (const section of [
      "Why",
      "What",
      "Acceptance criteria",
      "Non-goals",
      "Dependencies",
      "Required context",
    ]) {
      expect(template).toContain(`label: ${section}`);
    }

    expect(template).toContain("clean-room/PRD.md");
    expect(template).toContain("clean-room/TDD.md");
  });

  it("makes milestone outcomes and completion evidence explicit", () => {
    const template = readRepositoryFile(".github/ISSUE_TEMPLATE/milestone.yml");

    expect(template).toContain("label: Why");
    expect(template).toContain("label: Builds");
    expect(template).toContain("label: Complete when");
    expect(template).toContain("label: Dependencies");
    expect(template).toContain("clean-room/TODO.md");
  });

  it("requires pull requests to identify their ticket and TDD evidence", () => {
    const template = readRepositoryFile(".github/pull_request_template.md");

    expect(template).toMatch(/(?:close[sd]?|fixe?[sd]?|resolve[sd]?)\s+#/iu);
    expect(template).toContain("## Red-green-refactor evidence");
    expect(template).toContain("### Red");
    expect(template).toContain("### Green");
    expect(template).toContain("### Refactor");
    expect(template).toContain("npm run validate:fast");
    expect(template).toContain("npm run validate");
  });
});
