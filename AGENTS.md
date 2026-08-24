# Repository instructions

## Sources of truth

Read the selected issue and every document in its **Required context** section
before changing code. Use these repository sources in this order:

1. [`clean-room/PRD.md`](clean-room/PRD.md) defines product scope and acceptance.
2. [`clean-room/TDD.md`](clean-room/TDD.md) defines durable architecture and public
   boundaries.
3. [`clean-room/TODO.md`](clean-room/TODO.md) defines milestone order, readiness,
   and completion conditions.
4. [`research/README.md`](research/README.md) routes to the human-authored
   behavioral specification. Follow its evidence and uncertainty labels when a
   ticket concerns original-v1.3 behavior.

The issue defines the ticket-sized outcome, but it cannot override the product,
architecture, milestone, or clean-room constraints above. If researched behavior
is unknown, keep the uncertainty visible and document the implementation decision;
do not present it as confirmed original behavior.

## Repository and clean-room boundaries

- `original/` contains preserved original artifacts. Do not modify them.
- `decompiled/` and `exports/` are generated research inputs. Do not copy their
  code or generated artifacts into the implementation.
- `research/` contains human-authored behavioral evidence, not production inputs.
- `clean-room/` contains the product, design, and roadmap documents.
- `src/` is the clean-room implementation. Approved runtime assets belong in
  `src/assets/`, with provenance recorded there.
- `tests/` contains clean-room implementation evidence.

Production code must not import from `original/`, `decompiled/`, `exports/`,
`research/`, `tooling/`, or `clean-room/`. Dependencies point inward: adapters
may depend on application and domain contracts, while the domain must not depend
on browser, Canvas, rendering, input devices, storage, audio, filesystem,
workers, wall-clock APIs, or ambient randomness. Keep `src/main.ts` as the
composition root. See [`docs/architecture-boundaries.md`](docs/architecture-boundaries.md)
for the mechanically enforced layer map.

## Required workflow

Work only on a ready issue whose blockers are complete. Keep the issue's stated
acceptance criteria and non-goals in scope.

For every behavior change, follow red-green-refactor:

1. **Red:** add or select the smallest test or check that expresses the outcome,
   run it, and record the meaningful failure.
2. **Green:** implement the smallest change that makes that evidence pass.
3. **Refactor:** improve the result while keeping the relevant suite green.

Do not defer tests to another ticket. Preserve deterministic, runnable, and
inspectable behavior at each milestone. Update documentation when delivered
behavior, commands, boundaries, or an explicit compatibility decision changes.

## Validation commands

Run commands from the repository root after `npm ci`:

| Purpose                                   | Command                      |
| ----------------------------------------- | ---------------------------- |
| Apply formatting                          | `npm run format`             |
| Check formatting                          | `npm run format:check`       |
| Lint                                      | `npm run lint`               |
| Check architecture and clean-room imports | `npm run check:architecture` |
| Type-check                                | `npm run typecheck`          |
| Run unit tests                            | `npm run test:unit`          |
| Run browser tests                         | `npm run test:browser`       |
| Build production output                   | `npm run build`              |
| Pre-commit gate                           | `npm run validate:fast`      |
| Complete pre-push and CI gate             | `npm run validate`           |

Run the focused red/green check during implementation, then
`npm run validate:fast` before committing and `npm run validate` before pushing.
Pull requests must identify the ticket, describe the observed red failure and
green result, account for refactoring, and record complete validation results.
