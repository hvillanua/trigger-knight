import { availableParallelism } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

import { originalAssetCatalog } from "./build/original-image-catalog.js";

export default defineConfig({
  plugins: [originalAssetCatalog(path.dirname(fileURLToPath(import.meta.url)))],
  test: {
    environment: "node",
    // VITEST_MAX_WORKERS and --maxWorkers can override this measured default.
    maxWorkers: Math.min(
      4,
      Math.max(1, Math.floor(availableParallelism() / 2)),
    ),
    include: ["tests/unit/**/*.test.ts"],
  },
});
