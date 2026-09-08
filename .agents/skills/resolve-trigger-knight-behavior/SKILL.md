---
name: resolve-trigger-knight-behavior
description: Consult Trigger Knight behavioral research only when the requested feature is ambiguous or the ticket lacks context needed to determine original-game behavior. Do not use for adequately specified tickets, routine implementation or review, or merely because a task concerns gameplay or compatibility.
---

# Resolve missing behavioral context

Identify the specific unanswered behavioral question in the ticket before
opening research. If the ticket already supplies enough context, do not load
research. This skill resolves original-game behavior, not new product decisions
or general engineering choices.

Use `research/README.md` from the repository root to locate the relevant
human-authored specification. Read only the sections needed to answer the
question. Follow their CONFIRMED, DERIVED, and UNKNOWN labels; do not turn an
inference into a claim about confirmed original behavior.

If the relevant research leaves a gap, consult the corresponding entry in
`docs/compatibility-decisions.md`. Reuse an existing decision when applicable.
If a new compatibility choice is needed, make the uncertainty explicit and
resolve any remaining requirements ambiguity with the user before implementing
it. Record the agreed choice in that document, not code comments.

Do not copy decompiled code or generated research artifacts into implementation.
Stop reading once the question is resolved, and use the answer to guide the
smallest relevant behavior test. Do not follow unrelated links or build a new
reading inventory for the ticket.
