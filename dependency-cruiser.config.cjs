/** @type {import("dependency-cruiser").IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: "no-circular-dependencies",
      severity: "error",
      comment: "Cycles obscure the inward dependency direction.",
      from: {},
      to: { circular: true },
    },
    {
      name: "no-unresolved-dependencies",
      severity: "error",
      comment: "Every production dependency must resolve during validation.",
      from: { path: "(^|/)src/" },
      to: { couldNotResolve: true, pathNot: "^vite/client$" },
    },
    {
      name: "layers-do-not-depend-on-composition-root",
      severity: "error",
      comment:
        "The composition root wires layers together; no production layer may import it.",
      from: {
        path: "(^|/)src/(domain|application|browser|persistence|sound|simulation|assets|generated)/",
      },
      to: { path: "(^|/)src/main\\.ts$" },
    },
    {
      name: "domain-does-not-depend-outward",
      severity: "error",
      comment: "Authoritative domain code is the innermost layer.",
      from: { path: "(^|/)src/domain/" },
      to: {
        path: "(^|/)src/(application|browser|persistence|sound|simulation|assets|generated)/",
      },
    },
    {
      name: "application-does-not-depend-on-adapters",
      severity: "error",
      comment: "Application code may depend on the domain, never adapters.",
      from: { path: "(^|/)src/application/" },
      to: {
        path: "(^|/)src/(browser|persistence|sound|simulation|assets|generated)/",
      },
    },
    {
      name: "application-does-not-compose-ruleset-registry",
      severity: "error",
      comment:
        "The application layer may use the registry contract, but main.ts selects the concrete rulesets.",
      from: { path: "(^|/)src/application/" },
      to: {
        path: "(^|/)src/domain/rulesets\\.ts$",
        dependencyTypesNot: ["type-only"],
      },
    },
    {
      name: "browser-does-not-depend-on-peer-adapters",
      severity: "error",
      from: { path: "(^|/)src/browser/" },
      to: { path: "(^|/)src/(persistence|sound|simulation)/" },
    },
    {
      name: "persistence-does-not-depend-on-peer-adapters",
      severity: "error",
      from: { path: "(^|/)src/persistence/" },
      to: {
        path: "(^|/)src/(browser|sound|simulation|assets|generated)/",
      },
    },
    {
      name: "sound-does-not-depend-on-peer-adapters",
      severity: "error",
      from: { path: "(^|/)src/sound/" },
      to: { path: "(^|/)src/(browser|persistence|simulation)/" },
    },
    {
      name: "simulation-does-not-depend-on-adapters",
      severity: "error",
      from: { path: "(^|/)src/simulation/" },
      to: {
        path: "(^|/)src/(browser|persistence|sound|assets|generated)/",
      },
    },
    {
      name: "generated-source-is-a-leaf",
      severity: "error",
      comment:
        "Generated clean-room outputs cannot reach into handwritten implementation layers.",
      from: { path: "(^|/)src/generated/" },
      to: {
        path: "(^|/)src/(domain|application|browser|persistence|sound|simulation|assets)/",
      },
    },
    {
      name: "domain-does-not-use-runtime-builtins",
      severity: "error",
      comment:
        "The authoritative domain must not access filesystem or host runtime APIs.",
      from: { path: "(^|/)src/domain/" },
      to: { dependencyTypes: ["core"] },
    },
    {
      name: "production-does-not-import-prohibited-inputs",
      severity: "error",
      comment:
        "Archival original, decompiled, exported, research, and tooling roots are not direct production imports; reviewed assets must be staged under src/assets/.",
      from: { path: "(^|/)src/" },
      to: {
        path: "(^|/)(original|decompiled|exports|research|tooling|clean-room)/",
      },
    },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    tsPreCompilationDeps: true,
    enhancedResolveOptions: {
      extensions: [".js", ".mjs", ".cjs", ".ts", ".mts", ".cts", ".json"],
    },
  },
};
