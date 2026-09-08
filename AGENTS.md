# Repository instructions

## Clean-room constraints

- Preserve original artifacts. Never copy decompiled code or generated research
  artifacts into the implementation.
- Use human-authored behavioral evidence and approved runtime assets with recorded
  provenance. Research files are not production inputs.
- Distinguish confirmed behavior, derived evidence, and unresolved questions.
  Never present a compatibility choice as confirmed original behavior.
- Keep hidden gameplay state out of player-facing observations, events, and policy
  inputs. Structural checks cannot determine whether a field reveals a secret.

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

Run only focused checks needed for the change locally. GitHub Actions is the
complete validation gate. Run aggregate validation locally only when the user
requests it or a CI failure needs reproduction. Markdown and plain-text-only
changes require no code validation.

Do not install or invoke repository-owned pre-commit or pre-push hooks. Do not
poll successful CI runs. Report observed results accurately, including checks
that were not run.
