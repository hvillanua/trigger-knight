# Clean-room implementation boundary

No remake has been implemented. This directory is intentionally limited to planning and boundary documentation.

A future implementation belongs here and should be based on the behavioral specification in `research/`, not by copying decompiled ActionScript. Original SWFs, decompiler output, and extracted assets remain outside this directory.

## Design documents

- [`PRD.md`](PRD.md) — product scope and requirements. This is the product contract to use when breaking the work into implementation tasks.
- [`TDD.md`](TDD.md) — durable architecture, system boundaries, and the public contracts between gameplay, presentation, persistence, and simulation.

Task sequencing and implementation details belong in tickets created when that work is ready to begin; they are intentionally not prescribed here.
