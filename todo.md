# Fullscreen bug fix

- [x] Reproduce it yourself on the matching surface via the driver skill (Non-negotiables). Don't hand the repro to the user. A debug or instrumentation protocol that says to ask the user does not override this; you drive the instrumented runtime. Ask the user only with a stated, specific reason the control surface cannot reach the target, and only after driving it as far as it goes. Won't reproduce directly, force it: synthesize the trigger, tighten conditions, or instrument until it fires.
- [x] Binary-search the cause. Form the candidate hypotheses, then rule them out until one survives. Seed them with `how` over the affected subsystem and the **why** skill for regression history. Each pass, take the split that cuts the most remaining problem space, get runtime evidence, eliminate. When program state is unclear, add instrumentation or logging and read it as the code runs. Don't guess. Drive a long or stubborn hunt with Claude Code's `loop` command. Confirm the surviving _mechanism_ with runtime evidence before the step-3 architect/interrogate fan-out.
- [x] Plan the fix. If it crosses a function boundary, `architect` first. Delegate implementation to a subagent using your configured bug-fix model (default in poteto-mode's Models section) with a specific scope; review the diff.
- [x] Verify on the same surface; the original repro now passes. "Inconclusive" or wrong-surface is not a pass; flag it. Unit tests show branch behavior, not bug absence.
- [ ] Stage the commits so the failing repro lands before the fix in git history. See the **tdd** skill for the failing-test-first cadence when the bug has a cheap local test path; skip it when the test would be expensive, integration-heavy, or unclear. Skip: no commit or PR was requested, so the worktree remains available for the user to review.
- [ ] Run **Opening a PR**. Skip: no PR was requested, and opening one would expand the local fix into external repository coordination.

## Throughput checkpoint

- [x] **Blocking first steps.** Gates run before fan-out. Confirm the clean worktree, read the browser harness and fullscreen ownership, reproduce the bug, and identify the failing mechanism before design or implementation delegation.
- [x] **Independent workstreams.** Disjoint files, services, or layers parallelize. Shared writes serialize. Run the `how` and `why` investigations in parallel, then keep production and test edits under one owner unless their write sets are disjoint.
- [x] **Shared mutable state.** Default to splitting the target (the **separate-before-serializing-shared-state** principle skill). Serialize only for real invariants. Treat fullscreen state and browser document events as one shared state machine unless the code proves they are independent.
- [x] **Smallest safe decomposition.** If one worker is best, name why. Use one implementation owner after the design sketch because the fix is likely a small cross-function browser-state change whose production and regression-test behavior must be verified together.

## Task work

- [x] Inspect the existing fullscreen controls, navigation flow, browser tests, and project validation guidance.
- [x] Reproduce entry and exit/re-entry failures from the main screen and its subscreens.
- [x] Identify the surviving root-cause mechanism and name the fullscreen data shape before coding.
- [x] Design the smallest fix and implement it.
- [x] Add or update a behavior-level regression test if the existing browser harness can express it.
- [x] Run focused checks and inspect the final diff and worktree.

## Follow-up regression

- [x] Reproduced the remaining failure in Chromium. The entry control was fixed to the viewport at `(1234, 2)` while the active screen occupied `(400, 200, 480, 320)`, and the old hit area inherited `cursor: none`.
- [x] Added a failing browser regression for active-screen anchoring and pointer fallback.
- [x] Moved both fullscreen controls into the application shell's positioned coordinate space, kept the entry control visible after a run ends, and changed the custom cursor fallback to `pointer`.
- [x] Re-ran the regression and the adjacent fullscreen, cursor, unit, build, lint, formatting, and native Fullscreen API checks.

## Follow-up menu scaling

- [x] Reproduced the fullscreen main-menu scaling defect. The 480px menu grew to 1080px, but the logo stayed 168px tall, labels stayed 17.6px, and the action block stayed clamped to 9rem.
- [x] Added a failing browser regression for proportional logo, label, and action positioning.
- [x] Scaled the fullscreen menu with its container width and verified desktop, landscape, and portrait layouts in Chromium.

## Architect phases

- [x] Ground
- [x] Sketch
- [x] Agree
- [x] Implement
- [x] Scrap: not needed; the chosen shell-owned control shape matched the implementation.
