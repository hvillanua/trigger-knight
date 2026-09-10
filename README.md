# Trigger Knight browser reimplementation and research archive

This project preserves Trigger Knight v1.3 by Mintsphere and builds a clean-room
browser reimplementation using TypeScript, Vite, and Canvas 2D.

## Run locally

With the repository's pinned Node.js and npm versions installed:

```sh
npm ci
npm run setup:browser
npm run dev
```

On a fresh Linux host that needs Chromium system dependencies, use
`npm run setup:browser -- --with-deps` for the browser setup step.

## Validation

Run commands from the repository root:

| Purpose                        | Command                      |
| ------------------------------ | ---------------------------- |
| Apply formatting               | `npm run format`             |
| Check formatting               | `npm run format:check`       |
| Lint                           | `npm run lint`               |
| Check architecture and imports | `npm run check:architecture` |
| Type-check                     | `npm run typecheck`          |
| Run unit tests                 | `npm run test:unit`          |
| Run browser tests              | `npm run test:browser`       |
| Build production output        | `npm run build`              |

Pass a test path after `--` to run focused tests. `npm ci` activates one
repository-owned Git hook: `.githooks/pre-push`, which runs `npm run validate`
before pushing. There is no repository-owned commit hook or other validation
hook. Re-run `npm run setup:hooks` if local Git configuration is replaced after
installation. The repository-owned pre-push hook is the complete validation gate
for code-affecting changes. GitHub Actions is intentionally disabled and is not a
merge gate.

## Simulation and diagnostics

Call `createSimulationRunner` with an engine, run configuration, policy, and
finite `maxSteps`. Supply its optional `onTrace` callback to retain diagnostics.

Use `createFreshProfile()` from `src/domain/profile.ts` for new run inputs.
`normalizeProfile()` validates and copies a supplied profile into immutable
progression state. Earlier minimal run configurations receive fresh progression
defaults while retaining their explicit multiplier and tutorial preference.
These configurations are not historical browser saves. Unknown versions and
unsupported fields are rejected rather than discarded.

Simulation fingerprints retain the supplied profile version and every accepted
field. Property order does not affect identity. A minimal input and its expanded
profile have distinct input identities, even when their gameplay is equivalent.
Keep the original input with recorded results to reproduce their fingerprints.

Use `createCombatPolicy()` for continuous shopping and combat runs. It buys
eligible shops and uses battle items, saving Elixir until HP reaches the
configured `elixirHpFraction`. Results retain the policy identity and normalized
configuration.

### Run retained simulations

The headless command accepts JSON files or `-` for standard input:

```sh
npm run simulate -- single tests/fixtures/simulation/minimal-request.json
npm run simulate -- batch tests/fixtures/simulation/manifest.json
```

A single request contains `config`, a policy descriptor, and a positive
`maxSteps`. A batch manifest has `schemaVersion: 1` and a `requests` array. The
config keeps the exact minimal or expanded `initialProfile` input. The existing
manifest policy identities are `non-progressing@1`,
`purchase-reachable-shops@2`, and `combat-shopper@1` with an explicit
`elixirHpFraction` configuration.

Batch output retains the manifest and links each result to its request with
`requestIndex` and a canonical request fingerprint. Results are sorted by that
fingerprint, so completion order cannot change the export. The command writes
one canonical JSON document to standard output and sends failures to standard
error. It does not include timings, progress messages, or full diagnostic
traces.

In the development browser, call `window.triggerKnightDiagnostics.read()` in
the console. This hook is absent from production builds. Browser sessions also
provide `readDiagnostics()`. `compareGameplayTraces` reports the first differing
execution field.

The browser entry point loads its initial profile through
`createBrowserProfileStore(window.localStorage)`. An empty store returns fresh
defaults. A valid current record or a supported older envelope returns a
complete `ProfileState`, including the supported `tutorialPreference` setting.
Storage errors are returned to the caller and the browser marks the status
element instead of replacing the stored record. The adapter currently accepts
storage-envelope versions 1, 2, and 3, which are separate from the profile
schema version. Version 3 also retains completed-run identities so a repeated
terminal notification or retry cannot settle one run twice. The minimal
`schemaVersion: 1` `RunConfig` input is not a historical browser-save format
and is rejected when it appears where a persisted complete profile is required.
Completed runs go through the application coordinator, which settles both
gameplay death paths and commits the profile before the terminal checkpoint is
presented. A save whose final commit cannot be reconciled returns an uncertain
result; load the profile before retrying so the journal can resolve to the prior
or complete new record.

## Original game

Copyright remains with the original rights holders. The preserved material is
retained for interoperability, historical research, and clean-room behavioral
analysis.
