import js from "@eslint/js";
import { defineConfig } from "eslint/config";
import globals from "globals";
import tseslint from "typescript-eslint";

const productionImportRestrictions = [
  "error",
  {
    patterns: [
      {
        group: [
          "**/original/**",
          "**/decompiled/**",
          "**/exports/**",
          "**/research/**",
          "**/tooling/**",
          "**/clean-room/**",
        ],
        message:
          "Production code cannot import original, decompiled, generated research, tooling, or specification inputs.",
      },
    ],
  },
];

const unclassifiedSourcePlugin = {
  rules: {
    "reject-unclassified-module": {
      meta: {
        type: "problem",
        docs: {
          description: "Require production modules to belong to a named layer",
        },
        schema: [],
        messages: {
          unclassified:
            "Move this module into domain, application, browser, persistence, sound, simulation, assets, or generated. Only main.ts is a composition root.",
        },
      },
      create(context) {
        return {
          Program(node) {
            const fileName = context.filename.replaceAll("\\", "/");
            const classified =
              /(?:^|\/)src\/(?:domain|application|browser|persistence|sound|simulation|assets|generated)\//u.test(
                fileName,
              );
            const compositionRoot =
              /(?:^|\/)src\/(?:main\.ts|vite-env\.d\.ts)$/u.test(fileName);

            if (!classified && !compositionRoot) {
              context.report({ node, messageId: "unclassified" });
            }
          },
        };
      },
    },
  },
};

export default defineConfig(
  {
    ignores: [
      "coverage/**",
      "decompiled/**",
      "dist/**",
      "exports/**",
      "node_modules/**",
      "original/**",
      "playwright-report/**",
      "test-results/**",
      "tests/architecture/fixtures/**",
      "tooling/**",
    ],
  },
  {
    files: ["**/*.{js,mjs,cjs,ts,mts,cts}"],
    extends: [js.configs.recommended, tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    linterOptions: {
      reportUnusedDisableDirectives: "error",
    },
    rules: {
      "no-restricted-imports": productionImportRestrictions,
    },
  },
  {
    files: ["**/*.{js,mjs,cjs}"],
    extends: [tseslint.configs.disableTypeChecked],
  },
  {
    files: ["src/domain/**/*.{js,mjs,cjs,ts,mts,cts}"],
    rules: {
      "no-restricted-globals": [
        "error",
        ...[
          "Audio",
          "AudioContext",
          "BroadcastChannel",
          "Date",
          "SharedWorker",
          "WebSocket",
          "Worker",
          "XMLHttpRequest",
          "Buffer",
          "caches",
          "cancelAnimationFrame",
          "crypto",
          "document",
          "fetch",
          "global",
          "globalThis",
          "indexedDB",
          "localStorage",
          "location",
          "navigator",
          "performance",
          "process",
          "requestAnimationFrame",
          "sessionStorage",
          "setInterval",
          "setTimeout",
          "window",
        ].map((name) => ({
          name,
          message:
            "Authoritative domain code must receive host state through an explicit input.",
        })),
      ],
      "no-restricted-properties": [
        "error",
        {
          object: "Math",
          property: "random",
          message:
            "Authoritative domain code must receive an explicit seeded random source.",
        },
        {
          object: "Date",
          property: "now",
          message:
            "Authoritative domain code must not read the ambient wall clock.",
        },
        {
          object: "performance",
          property: "now",
          message:
            "Authoritative domain code must not read the ambient wall clock.",
        },
        {
          object: "crypto",
          property: "getRandomValues",
          message:
            "Authoritative domain code must receive an explicit seeded random source.",
        },
        {
          object: "crypto",
          property: "randomUUID",
          message:
            "Authoritative domain code must receive deterministic identifiers explicitly.",
        },
      ],
    },
  },
  {
    files: ["src/**/*.{js,mjs,cjs,ts,mts,cts}"],
    plugins: {
      architecture: unclassifiedSourcePlugin,
    },
    rules: {
      "architecture/reject-unclassified-module": "error",
    },
  },
);
