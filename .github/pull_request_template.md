Closes #<!-- ticket number -->

## What

<!-- Describe the concrete changes delivered by this pull request, including important scope boundaries. Keep implementation detail proportional to review needs. -->

## Why

<!-- Explain the problem or need this pull request addresses and why the change is necessary. Do not describe the implementation here. -->

## Acceptance criteria

<!-- Map the ticket's observable acceptance criteria to evidence in this pull request. -->

- [ ] <!-- criterion and evidence -->

## Red-green-refactor evidence

### Red

<!-- Give the exact focused command or check and the meaningful failure observed before implementation. If no behavior changed, explain why a failing check was not applicable. -->

### Green

<!-- Describe the smallest passing change and give the focused passing command/result. -->

### Refactor

<!-- Describe cleanup performed while tests stayed green, or state why no refactor was needed. -->

## Validation

<!-- Record focused local checks. The repository-owned pre-push hook is the complete gate for code-affecting changes; GitHub Actions is disabled and is not a merge gate. -->

- [ ] Focused red and green checks are recorded below.
- [ ] The repository-owned pre-push validation result is recorded below, or this change is docs/plain text only.

Additional focused checks and results:

<!-- command — result -->

## Boundary and documentation review

- [ ] The implementation uses human-authored behavioral research and approved clean-room assets; it does not copy decompiled code or unapproved original/generated artifacts.
- [ ] Dependencies still point inward and authoritative domain code has no ambient browser, Node, time, or randomness inputs.
- [ ] The PRD, TDD, and implementation are treated as sources of truth. Usage or design guidance is updated only if intent changed. If the PRD and TDD leave behavior unspecified but code is specific, the implementation is preserved. If code conflicts with the PRD or TDD, the gap and appropriate source update are identified. Implemented behavior and fixtures remain in code and tests.
- [ ] Non-goals and intentional deferrals remain outside this pull request and are linked to a later milestone when required.
