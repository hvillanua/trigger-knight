Closes #<!-- ticket number -->

## Outcome

<!-- Describe the delivered outcome and why it is needed. Keep implementation detail proportional to review needs. -->

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

<!-- Record the result for every available repository gate. Do not leave a command checked if it was not run. -->

- [ ] `npm run validate:fast`
- [ ] `npm run validate`

Additional focused checks and results:

<!-- command — result -->

## Boundary and documentation review

- [ ] The implementation uses human-authored behavioral research and approved clean-room assets; it does not copy decompiled code or unapproved original/generated artifacts.
- [ ] Dependencies still point inward and authoritative domain code has no ambient browser, Node, time, or randomness inputs.
- [ ] Documentation and explicit compatibility decisions are updated, or no documentation change is needed.
- [ ] Non-goals and intentional deferrals remain outside this pull request and are linked to a later milestone when required.
