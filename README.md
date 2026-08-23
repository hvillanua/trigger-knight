# Trigger Knight browser reimplementation and research archive

This workspace preserves and documents the original 480x320 AVM1 Flash game
**Trigger Knight v1.3** by Mintsphere and hosts its clean-room browser
reimplementation.

## Browser project

The implementation uses TypeScript, Vite, Canvas 2D, Vitest, and Playwright.
Install the pinned toolchain and run the current foundation with:

```sh
npm ci
npm run setup:browser
npm run dev
```

The exact runtime and package selections are recorded in
[`docs/dependency-baseline.md`](docs/dependency-baseline.md). Product scope and
durable architecture live in [`clean-room/PRD.md`](clean-room/PRD.md) and
[`clean-room/TDD.md`](clean-room/TDD.md).

## Directory boundaries

| Directory | Purpose | Mutability |
|---|---|---|
| [`original/`](original/) | Original SWF artifacts and provenance | Preserve unchanged |
| [`decompiled/`](decompiled/) | Reproducible FFDec output | Generated research input |
| [`exports/`](exports/) | Extracted images, audio, text, and reference renders | Generated research input |
| [`research/`](research/) | Human-authored findings and uncertainty ledger | Research notes |
| [`tooling/`](tooling/) | Pinned FFDec and Java runtime | Tool dependencies |
| [`clean-room/`](clean-room/) | Product, architecture, and implementation-roadmap documents | Clean-room source of truth |
| [`src/`](src/) | Browser reimplementation source | Clean-room implementation |
| [`tests/`](tests/) | Unit and browser verification | Clean-room implementation evidence |

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
