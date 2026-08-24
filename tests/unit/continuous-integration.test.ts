import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const workflowPath = path.join(
  repositoryRoot,
  ".github/workflows/continuous-integration.yml",
);

function readWorkflow() {
  return readFileSync(workflowPath, "utf8");
}

describe("continuous integration", () => {
  it("runs for pull requests and pushes to main with read-only access", () => {
    const workflow = readWorkflow();

    expect(workflow).toMatch(/push:\n\s+branches: \[main\]/u);
    expect(workflow).toMatch(/pull_request:\n\s+branches: \[main\]/u);
    expect(workflow).toMatch(/permissions:\n\s+contents: read/u);
  });

  it("uses the pinned repository runtime and immutable dependency graph", () => {
    const workflow = readWorkflow();

    expect(workflow).toContain(
      "actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1",
    );
    expect(workflow).toContain(
      "actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7.0.0",
    );
    expect(workflow).toContain("node-version-file: .node-version");
    expect(workflow).toContain("cache-dependency-path: package-lock.json");
    expect(workflow).toContain("run: corepack enable npm");
    expect(workflow).toContain("run: npm ci");
    expect(workflow).not.toMatch(/run: npm install\s*$/mu);
  });

  it("prepares Chromium before invoking the repository validation gate", () => {
    const workflow = readWorkflow();
    const cleanInstall = workflow.indexOf("run: npm ci");
    const browserSetup = workflow.indexOf(
      "run: npm run setup:browser -- --with-deps",
    );
    const validation = workflow.indexOf("run: npm run validate");

    expect(cleanInstall).toBeGreaterThan(-1);
    expect(browserSetup).toBeGreaterThan(cleanInstall);
    expect(validation).toBeGreaterThan(browserSetup);
  });

  it("delegates all checks to the same complete gate used by pre-push", () => {
    const workflow = readWorkflow();
    const prePushHook = readFileSync(
      path.join(repositoryRoot, ".githooks/pre-push"),
      "utf8",
    );
    const workflowValidationCommands = workflow.match(
      /^\s*run: npm run validate\s*$/gmu,
    );

    expect(workflowValidationCommands).toHaveLength(1);
    expect(prePushHook).toContain("npm run validate");
    expect(workflow).not.toMatch(
      /run: npm run (?:format:check|lint|check:architecture|typecheck|test|test:unit|test:browser|build)\s*$/mu,
    );
  });
});
