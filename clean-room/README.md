# Clean-room implementation boundary

No remake has been implemented. This directory is intentionally limited to planning and boundary documentation.

A future implementation belongs here and should be based on the behavioral specification in `research/`, not by copying decompiled ActionScript. Original SWFs, decompiler output, and extracted assets remain outside this directory.

## Design documents

- [`PRD.md`](PRD.md) — product scope and requirements. This is the product contract to use when breaking the work into implementation tasks.
- [`TDD.md`](TDD.md) — selected architecture, domain boundaries, technology choices, headless API, deterministic simulation design, and testing strategy.
- [`PLAN.md`](PLAN.md) — earlier detailed implementation-planning notes retained as supporting context. Where it conflicts with the PRD or TDD, the PRD/TDD take precedence.
