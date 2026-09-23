import { realpathSync } from "node:fs";
import path from "node:path";

import type { Plugin } from "vite";

export const PROHIBITED_PRODUCTION_ROOTS = [
  "original",
  "decompiled",
  "exports",
  "research",
  "tooling",
  "clean-room",
] as const;

function isInside(candidate: string, directory: string): boolean {
  const relative = path.relative(directory, candidate);

  return (
    relative === "" ||
    (!relative.startsWith(`..${path.sep}`) && relative !== "..")
  );
}

function resolveExistingPath(candidate: string): string {
  try {
    return realpathSync(candidate);
  } catch {
    // Vite also asks plugins about virtual and not-yet-created module IDs.
    return candidate;
  }
}

export function assertProductionModuleAllowed(
  moduleId: string,
  projectRoot: string,
): void {
  const fileName = moduleId.split("?", 1)[0];

  if (fileName === undefined || !path.isAbsolute(fileName)) {
    return;
  }

  const resolvedFileName = resolveExistingPath(fileName);
  const resolvedProjectRoot = resolveExistingPath(projectRoot);

  for (const root of PROHIBITED_PRODUCTION_ROOTS) {
    if (isInside(resolvedFileName, path.join(resolvedProjectRoot, root))) {
      throw new Error(
        `Refusing prohibited production input from ${root}: ${resolvedFileName}`,
      );
    }
  }
}

export function cleanRoomBoundary(projectRoot: string): Plugin {
  return {
    name: "trigger-knight-clean-room-boundary",
    enforce: "pre",
    load(moduleId) {
      assertProductionModuleAllowed(moduleId, projectRoot);
      return null;
    },
  };
}
