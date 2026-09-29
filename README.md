# Trigger Knight

Trigger Knight is a browser reimplementation of Trigger Knight v1.3 by
Mintsphere. Gameplay and domain code are reconstructed clean-room from
behavioral evidence. The browser presentation uses approved original assets
where available.

## Run locally

Use Node.js 24.19.0 and npm 12.0.2.

```sh
npm ci
npm run setup:browser
npm run dev
```

On Linux hosts that need Chromium system packages, run
`npm run setup:browser -- --with-deps` instead.

Open `http://127.0.0.1:5173/`. The default visual asset pack is Original.

To install the optional high-resolution pack, copy one complete treatment
directory from the [asset experiment repository](https://github.com/hvillanua/trigger-knight-asset-experiment)
into `src/assets/generated/high-res/`, including its `manifest.json`, then run:

```sh
mkdir -p src/assets/generated/high-res
rsync -a --delete \
  ../trigger-knight-asset-experiment/assets/generated/swinir-2x/ \
  src/assets/generated/high-res/
npm run verify:asset-pack
```

Replace `swinir-2x` with the treatment directory you selected. The runtime
uses only the approved optional directory. It does not import from the
archival `original/` or `exports/` directories.

## Check changes

Run the smallest checks that cover your change.

| Check               | Command                      |
| ------------------- | ---------------------------- |
| Format              | `npm run format:check`       |
| Lint                | `npm run lint`               |
| Type-check          | `npm run typecheck`          |
| Unit tests          | `npm run test:unit`          |
| Browser tests       | `npm run test:browser`       |
| Architecture checks | `npm run check:architecture` |
| Production build    | `npm run build`              |

Pass a test path after `--` for a focused run. `npm ci` installs the
repository-owned pre-push hook. It skips code validation for documentation-only
pushes when it can determine the remote range. New branches run the complete
gate because they have no remote range. GitHub Actions is not enabled.

See [test performance notes](docs/test-performance.md) for measured worker and
browser-test tradeoffs.

## Run simulations

The simulator uses the same gameplay implementation as the browser. Run a
retained request, batch, comparison, replay, or benchmark with:

```sh
npm run simulate -- single tests/fixtures/simulation/minimal-request.json
npm run simulate -- batch tests/fixtures/simulation/manifest.json
npm run simulate -- compare tests/fixtures/simulation/comparison.json
npm run simulate -- replay tests/fixtures/simulation/replay-case.json
npm run simulate -- benchmark tests/fixtures/simulation/benchmark.json
```

For deterministic browser checks, use `/?manual=1`. Development builds also
accept `seed=<seed>` and `diagnostics=1` query parameters.

## Repository map

- [`clean-room/README.md`](clean-room/README.md) describes the implementation boundary and design documents.
- [`clean-room/PRD.md`](clean-room/PRD.md) defines product scope.
- [`clean-room/TDD.md`](clean-room/TDD.md) defines architecture and public contracts.
- [`research/README.md`](research/README.md) indexes behavioral evidence.
- [`docs/compatibility-decisions.md`](docs/compatibility-decisions.md) records choices where the research is incomplete.
- [`src/assets/README.md`](src/assets/README.md) describes staged runtime assets and provenance.

Preserved SWFs, exports, decompiled output, and research artifacts are source
records. Do not import their code into production. Approved assets must be
staged under `src/assets/` with neighboring provenance metadata.

Copyright remains with the original rights holders. This project does not grant
a public license for the original assets.
