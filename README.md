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

The exact runtime and package selections are recorded in
[`docs/dependency-baseline.md`](docs/dependency-baseline.md). Product scope and
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

Before committing, run the fast validation gate:

```sh
npm run validate:fast
```

Before pushing, run the complete validation gate, which includes every check:

```sh
npm run validate
```

`npm ci` also activates repository-owned Git hooks. The pre-commit hook runs
`npm run validate:fast`, and the pre-push hook runs `npm run validate`. Re-run
`npm run setup:hooks` if local Git configuration is replaced after installation.

TypeScript 7.0 and ESLint temporarily use side-by-side compiler packages. The
removal condition and TODO are recorded in
[`docs/dependency-baseline.md`](docs/dependency-baseline.md#temporary-typescript-6-compatibility).
The allowed source layers, dependency directions, deterministic-domain API
rules, and approved production-input locations are documented in
[`docs/architecture-boundaries.md`](docs/architecture-boundaries.md).
The versioned seed expansion, random sequence, and serializable state contract
are recorded in
[`docs/deterministic-randomness.md`](docs/deterministic-randomness.md).
The `original-v1.3` registry, owned constants, current deterministic transition,
and public observation are recorded in
[`docs/original-v13-ruleset.md`](docs/original-v13-ruleset.md).
The 480x320 world camera, letterboxed Canvas projection, and redraw boundary are
recorded in [`docs/world-camera.md`](docs/world-camera.md).
The finite programmatic runner, policy sequence, result identity, and minimal
batch behavior are recorded in
[`docs/headless-simulation.md`](docs/headless-simulation.md).
Cross-host checkpoints, parity hashes, and structured first-difference output
are recorded in
[`docs/gameplay-diagnostics.md`](docs/gameplay-diagnostics.md).

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
