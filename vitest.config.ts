import { availableParallelism } from "node:os";
import { defineConfig } from "vitest/config";

export default defineConfig({
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
