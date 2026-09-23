import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  assertProductionModuleAllowed,
  PROHIBITED_PRODUCTION_ROOTS,
} from "../../build/clean-room-boundary.js";

describe("production implementation boundary", () => {
  const projectRoot = path.resolve("/trigger-knight");

  it.each(PROHIBITED_PRODUCTION_ROOTS)(
    "rejects modules loaded from %s",
    (directory) => {
      const file = path.join(projectRoot, directory, "copied-artifact.js");

      expect(() => assertProductionModuleAllowed(file, projectRoot)).toThrow(
        "prohibited production input",
      );
    },
  );

  it("accepts an approved runtime asset location", () => {
    const file = path.join(projectRoot, "src/assets/hero.svg");

    expect(() =>
      assertProductionModuleAllowed(file, projectRoot),
    ).not.toThrow();
  });

  it("still protects prohibited roots in a symlinked checkout", () => {
    const target = mkdtempSync(path.join(os.tmpdir(), "trigger-knight-"));
    const projectRoot = path.join(target, "checkout");
    const prohibited = path.join(target, "original");
    mkdirSync(prohibited);
    writeFileSync(path.join(prohibited, "copied-artifact.js"), "");
    symlinkSync(target, projectRoot, "dir");

    try {
      expect(() =>
        assertProductionModuleAllowed(
          path.join(projectRoot, "original", "copied-artifact.js"),
          projectRoot,
        ),
      ).toThrow("prohibited production input");
    } finally {
      rmSync(target, { recursive: true, force: true });
    }
  });
});
