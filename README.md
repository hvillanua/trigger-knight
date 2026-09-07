# Trigger Knight browser reimplementation and research archive

This workspace preserves and documents the original 480x320 AVM1 Flash game
**Trigger Knight v1.3** by Mintsphere and hosts its clean-room browser
reimplementation.

## Browser project

The implementation uses TypeScript, Vite, Canvas 2D, Vitest, and Playwright.
Install the pinned toolchain and run the minimal browser application with:

```sh
npm ci
npm run setup:browser
npm run dev
```

Runtime and package versions are pinned in [`.node-version`](.node-version),
[`package.json`](package.json), and [`package-lock.json`](package-lock.json).
Code and tests define implemented behavior. Product scope and
durable architecture live in [`clean-room/PRD.md`](clean-room/PRD.md) and
[`clean-room/TDD.md`](clean-room/TDD.md).

## Validation

Run validation from the repository root. Each concern has a stable,
non-interactive command:

| Concern                                            | Command                      |
| -------------------------------------------------- | ---------------------------- |
| Apply repository formatting                        | `npm run format`             |
| Check repository formatting without changing files | `npm run format:check`       |
| Lint TypeScript and JavaScript                     | `npm run lint`               |
| Check architecture and clean-room imports          | `npm run check:architecture` |
| Type-check with native TypeScript 7                | `npm run typecheck`          |
| Run unit tests                                     | `npm run test:unit`          |
| Run browser tests                                  | `npm run test:browser`       |
| Build the production application                   | `npm run build`              |

During implementation, run the smallest focused tests and checks that cover the
changed code. Markdown and plain-text-only changes do not require code
validation. The formatting commands continue to cover the whole repository. The
aggregate commands below are concise CI gates: successful steps print one line,
while a failing step prints its diagnostic output.

```sh
npm run validate:fast
```

The complete CI gate includes every code check:

```sh
npm run validate
```

Commits and pushes have no repository-owned validation hooks. GitHub Actions runs
the complete gate only when code, tests, runtime assets, build scripts, or
configuration change. Local aggregate validation is reserved for reproducing CI
failures or explicit requests.

The repository currently installs two TypeScript packages. `@typescript/native`
aliases TypeScript 7 and supplies `tsc`; `typescript` aliases TypeScript 6's
compiler API for `typescript-eslint` and
[`check-public-contracts.mjs`](build/check-public-contracts.mjs). Use
`npm run typecheck`, not `tsc6`. Remove the compatibility arrangement when the
native compiler API supports both consumers. Versions belong in the manifests.

## Simulation and diagnostics

Use [`createSimulationRunner`](src/simulation/simulation-runner.ts) with an
engine, run configuration, policy, and finite `maxSteps`. See the
[runner tests](tests/unit/simulation-runner.test.ts) for runnable examples.
Supply its optional `onTrace` callback to retain a diagnostic trace.

For continuous shopping and combat runs, pass
[`createCombatPolicy()`](src/simulation/combat-policy.ts) as the policy. It buys
eligible shops and uses battle items, saving Elixir until HP reaches the
configured `elixirHpFraction`. The result retains the policy identity and
normalized configuration. The [combat policy scenarios](tests/unit/combat-policy-runs.test.ts)
show complete seeded runs and reward-funded purchases.

In the development browser, call `window.triggerKnightDiagnostics.read()` in
the console. The hook is absent from production builds. Browser hosts also
provide [`readDiagnostics()`](src/browser/gameplay-session.ts).
[`compareGameplayTraces`](src/application/gameplay-execution.ts) reports the
first differing execution field; the
[diagnostics tests](tests/unit/gameplay-diagnostics.test.ts) show its usage.

Choices required by missing original research live in
[`docs/compatibility-decisions.md`](docs/compatibility-decisions.md). Consult
the relevant entry only when working on that uncertainty.

## Directory boundaries

| Directory                    | Purpose                                                     | Mutability                         |
| ---------------------------- | ----------------------------------------------------------- | ---------------------------------- |
| [`original/`](original/)     | Original SWF artifacts and provenance                       | Preserve unchanged                 |
| [`decompiled/`](decompiled/) | Reproducible FFDec output                                   | Generated research input           |
| [`exports/`](exports/)       | Extracted images, audio, text, and reference renders        | Generated research input           |
| [`research/`](research/)     | Human-authored findings and uncertainty ledger              | Research notes                     |
| [`tooling/`](tooling/)       | Pinned FFDec and Java runtime                               | Tool dependencies                  |
| [`clean-room/`](clean-room/) | Product, architecture, and implementation-roadmap documents | Clean-room source of truth         |
| [`src/`](src/)               | Browser reimplementation source                             | Clean-room implementation          |
| [`tests/`](tests/)           | Unit and browser verification                               | Clean-room implementation evidence |

Start with [`research/README.md`](research/README.md). Artifact identity and
download provenance are in [`original/README.md`](original/README.md), with
machine-readable hashes in [`original/SHA256SUMS`](original/SHA256SUMS).

## Primary artifact

`original/kongregate/MonotouchKong13APPSTORE.swf`

SHA-256:
`0f0630b981172fd2183b3a2ff890d98a178c11bc8e0aa3b5ed1be05c4ddb2c20`

The preserved bytes have not been modified. Copyright remains with the
original rights holders; the material is retained for interoperability,
historical research, and clean-room behavioral analysis.
