import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);

describe("local validation hooks", () => {
  it("runs the complete validation gate only before pushes", () => {
    const hooksDirectory = path.join(repositoryRoot, ".githooks");

    expect(readFileSync(path.join(hooksDirectory, "pre-push"), "utf8")).toBe(
      "#!/bin/sh\n\nnpm run validate\n",
    );
    expect(existsSync(path.join(hooksDirectory, "pre-commit"))).toBe(false);
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
