---
name: review-trigger-knight-pr
description: Review Trigger Knight pull requests for meaningful architectural violations and accidental exposure of hidden gameplay state. Use when reviewing a PR, branch, or diff in this repository.
---

# Review Trigger Knight pull requests

Find merge-relevant defects against the repository's established architecture.
Do not try to make its static checks resistant to deliberate or exotic evasion.

## Establish the contract

Before reviewing, read:

1. `AGENTS.md`;
2. the PR and its linked issue, including any context linked in the issue;
3. `clean-room/PRD.md` and `clean-room/TDD.md`;
4. relevant source, tests, and architecture enforcement in
   `dependency-cruiser.config.cjs` and `build/check-public-contracts.mjs`;
5. `.agents/skills/protect-player-visible-contracts/SKILL.md` when observations,
   events, presentation frames, policy inputs, or reachable types change.

Use behavioral research only through the routing and evidence rules in
`AGENTS.md`. Preserve stated non-goals and uncertainty labels.
If scope or requirements are ambiguous or conflicting, ask the user before
proceeding with the affected review.
Consult the relevant entry in `docs/compatibility-decisions.md` when a change
touches a research gap. Require an update only for a new choice caused by
incomplete original evidence, not routine implementation changes.

## Review architecture

Check the changed runtime paths, not just imports and type declarations:

- the domain remains deterministic and independent of browser, rendering,
  storage, sound, filesystem, wall-clock, timers, and ambient randomness;
- dependencies still point inward, adapters remain peers, and `src/main.ts`
  remains the composition root;
- browser play and headless simulation still use the same authoritative engine;
- gameplay rules remain in the domain or versioned ruleset rather than leaking
  into presentation, input, persistence, or simulation policies;
- the change stays within the selected issue and does not silently implement or
  constrain later milestones;
- focused tests prove the changed behavior, usage and design guidance reflect
  any changed intent, and the current CI result is accounted for. Do not require
  prose copies of implemented contracts, formulas, versions, or test fixtures.

Report concrete correctness, determinism, compatibility, or maintainability
failures. Do not report a preference merely because another design is possible.

## Review player-visible boundaries

Treat browser presentation and ordinary automated policies as the same player.
They may receive only information intentionally observable at that point in the
run. Trace runtime values reaching `PresentationFrame`, `PlayerAgent`,
`GameObservation`, and `GameEvent`.

Report cases where hidden state can leak through an ordinary implementation or
maintenance change without the architectural check failing, including:

- a real player-facing boundary that is not included among the checker's roots;
- an observed/public type that aliases, extends, or otherwise reuses an
  authoritative type which may also acquire internal fields;
- a public projection that spreads authoritative objects instead of selecting
  approved fields;
- an unapproved project type reachable through normal TypeScript contract
  references that the checker fails to reject;
- tests that assert only expected properties when an exact-shape assertion is
  needed to detect extra exposed fields.

Generation inputs, future outcomes, random state, AI decisions, unrevealed enemy
statistics, rewards, cached calculations, and diagnostic state are hidden unless
the product or behavioral evidence explicitly exposes them.

The checker is a high-value guardrail, not a security boundary. Do not file a
finding solely because deliberately unusual syntax, compiler tricks, suppressed
type errors, or intentional evasion could bypass it. Escalate such a case only
when the PR uses that pattern or a maintainer could reasonably introduce it by
accident during normal work.

## Write the review

Lead with actionable findings ordered by severity. For each finding, identify
the affected runtime path, explain what can go wrong, and state the smallest
acceptable correction or missing evidence. Avoid duplicating existing unresolved
threads. If no merge-relevant defect remains, say so and note any residual limits
as non-blocking context.
