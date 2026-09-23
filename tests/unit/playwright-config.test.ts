import { spawnSync } from "node:child_process";
import process from "node:process";

import { describe, expect, it } from "vitest";

describe("Playwright configuration", () => {
  it("rejects a zero percentage before Playwright loads the config", () => {
    const result = spawnSync(
      process.execPath,
      ["node_modules/@playwright/test/cli.js", "test", "--list"],
      {
        cwd: process.cwd(),
        encoding: "utf8",
        env: { ...process.env, PLAYWRIGHT_WORKERS: "0%" },
      },
    );

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain(
      "PLAYWRIGHT_WORKERS must be a positive integer or a percentage from 1% to 100%",
    );
  });
});
