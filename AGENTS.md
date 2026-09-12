# Repository instructions

## Clean-room and asset constraints

- Preserve the original artifacts. Never modify or overwrite the preserved SWF or
  its provenance records.
- The gameplay and domain implementation remains clean-room: never copy
  decompiled code or generated behavioral research artifacts into production.
- The browser presentation uses the original game's visual and audio assets where
  available. Stage approved files from `original/` or `exports/` under
  `src/assets/` (or another explicitly approved runtime asset directory), and
  record the source path, artifact hash or export identifier, extraction details,
  rights or license, and review date in neighboring provenance metadata.
- The archival `original/` and `exports/` directories are source/provenance
  records, not direct production module roots. Do not import code or unreviewed
  files from them. Research files remain non-production inputs except for an
  explicitly approved asset staged with provenance.
- Distinguish confirmed behavior, derived evidence, and unresolved questions.
  Never present a compatibility choice as confirmed original behavior.
- Keep hidden gameplay state out of player-facing observations, events, and policy
  inputs. Structural checks cannot determine whether a field reveals a secret.
- Treat the PRD, TDD, and existing implementation as sources of truth. If the PRD
  and TDD leave behavior unspecified but the implementation is specific, preserve
  that implementation. If code conflicts with either document, identify the gap
  and update the appropriate source and its tests.

## Delivery

Work only on ready tickets whose blockers are complete. Preserve their acceptance
criteria and non-goals. Resolve missing context before implementing affected
behavior; ask the user when requirements remain ambiguous or conflicting.

For behavior changes, follow red-green-refactor: run the smallest meaningful
failing test, implement the passing change, then refactor while keeping the
relevant tests green. Do not defer tests to another ticket or weaken checks to
make a change pass. Keep behavior deterministic, runnable, and inspectable.

Update usage and design guidance when intent changes. Keep formulas, contracts,
versions, hashes, and scenario results in code, configuration, and tests rather
than duplicate prose inventories. Record delivery evidence in PRs.

## Validation policy

Run only focused checks needed for the change locally. The repository-owned
pre-push hook runs the complete validation and is the validation gate for
code-affecting changes. GitHub Actions is disabled and is not a merge gate. Do
not manually run aggregate validation locally.
Markdown and plain-text-only changes require no code validation.

Do not wait for or poll GitHub Actions. Report observed results accurately,
including checks that were not run.
