# Repository instructions

## Sources and boundaries

- Preserve the original SWF and its provenance records. Never modify or overwrite them.
- Keep gameplay and domain implementation clean-room. Do not copy decompiled code or generated behavioral research into production.
- Stage approved original assets under `src/assets/` and record their source path, artifact hash or export identifier, extraction details, rights or license, and review date in neighboring provenance metadata.
- Treat `original/`, `exports/`, `decompiled/`, and research files as source records. Do not import code or unreviewed files from them.
- Distinguish confirmed behavior, derived evidence, and unresolved questions. Do not present a compatibility choice as confirmed original behavior.
- Keep hidden gameplay state out of player-facing observations, events, and policy inputs.
- Treat the PRD, TDD, and existing implementation as sources of truth. If they conflict, identify the gap and update the appropriate source and its tests.

## Changes

- Preserve the requested acceptance criteria and non-goals. Resolve ambiguous or conflicting behavior before implementing it.
- For behavior changes, follow red-green-refactor. Run the smallest meaningful failing test, make it pass, then refactor with the relevant tests green.
- Keep behavior deterministic, runnable, and inspectable.
- Update usage or design guidance when intent changes. Keep formulas, contracts, versions, hashes, and scenario results in code, configuration, and tests instead of duplicate prose.

## Validation

- Run only focused checks needed for the change locally.
- The repository-owned pre-push hook runs the complete validation gate for code-affecting pushes. New branches also run the complete gate because their remote range is unknown.
- Markdown and plain-text-only changes require no code validation.
- Do not wait for external CI. GitHub Actions is not enabled for this repository.
- Report checks that were not run.
