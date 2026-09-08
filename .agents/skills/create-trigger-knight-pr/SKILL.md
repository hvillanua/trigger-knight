---
name: create-trigger-knight-pr
description: Create or edit a Trigger Knight pull request title or description using the repository PR template. Use only when preparing or updating a PR, not for implementation, code review, or direct pushes.
---

# Create a Trigger Knight pull request

Read `.github/pull_request_template.md` from the repository root before drafting
the PR body. Preserve its sections, including What and Why, even when supplying a
custom body through a CLI or API. Fill the template rather than replacing it with
a free-form summary.

Identify the ticket, or the direct user request if there is no ticket. Describe
what changed and why separately. Map acceptance criteria to executable evidence,
record observed red and green results, and account for refactoring. If no runtime
behavior changed, explain why a failing test was not applicable.

Record focused local checks and the available CI result. Leave pending checks
unchecked; do not claim validation or review that did not happen. Keep detail
proportional to the change. Remove template placeholders and instructional
comments from the finished body.

When using `gh`, write the body to a file and pass `--body-file` to preserve its
Markdown structure. This skill does not authorize publishing, merging, or
launching review subagents; follow the user's scope for those actions.
