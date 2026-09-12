# Implementation and asset boundary

The runtime implementation lives in `src/`. This directory remains limited to
planning, product scope, architecture, and the implementation boundary.

Gameplay and domain code are reconstructed clean-room from the behavioral
specification in `research/`, not by copying decompiled ActionScript. The
browser presentation uses original game visual and audio assets where available.
The preserved SWF and its extracted exports remain outside this directory as
source records. Reviewed production copies are staged under
`src/assets/original/` with provenance and rights metadata, and the Canvas
presentation loads the staged character and scene exports. Decompiled code and
unreviewed research output remain outside production.

## Design documents

- [`PRD.md`](PRD.md) — product scope and requirements. This is the product contract to use when breaking the work into implementation tasks.
- [`TDD.md`](TDD.md) — durable architecture, system boundaries, and the public contracts between gameplay, presentation, persistence, and simulation.
- [`TODO.md`](TODO.md) — ordered capability milestones and their completion conditions. Ticket decomposition will be added later.

Ticket-level sequencing and implementation details belong in tickets created when that work is ready to begin; they are intentionally not prescribed here.

## Compatibility corpus

The retained original-v1.3 inputs and expected evidence live in
[`tests/fixtures/original-v13-compatibility.ts`](../tests/fixtures/original-v13-compatibility.ts).
Run the focused corpus check with:

```sh
npm exec -- vitest run tests/unit/milestone-6-compatibility-corpus.test.ts
```

Run the host-parity check with:

```sh
npm exec -- playwright test tests/browser/milestone-6-compatibility-corpus.spec.ts --project=chromium
```

The check replays seeded clean-room runs and applies constructed settlement
scenarios. It compares complete run results, trace hashes, selected checkpoint
hashes, public summaries, event types, and settled profiles. A hash mismatch is
evidence of a changed implementation, not proof that the clean-room seed
matches an unrecovered Flash seed. Inspect the first failing checkpoint and the
research or compatibility decision that covers its behavior before changing an
expected value.

The original-v1.3 evidence is frozen by a separate, versioned corpus fingerprint
in [`tests/fixtures/original-v13-baseline.ts`](../tests/fixtures/original-v13-baseline.ts).
Run the baseline and corpus guards together with:

```sh
npm exec -- vitest run tests/unit/milestone-6-compatibility-baseline.test.ts tests/unit/milestone-6-compatibility-corpus.test.ts
```

Changing expected results or traces without intentionally updating the baseline
version fails the fingerprint check. A gameplay change needs a new ruleset
identity. A result or trace representation change needs a new schema/baseline
version while retaining the prior evidence.
