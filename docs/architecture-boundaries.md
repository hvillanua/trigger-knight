# Architecture and clean-room boundaries

Production TypeScript belongs to one named layer. Dependencies point inward;
the composition root wires concrete adapters together but contains no rules.

| Source location    | May import from                                                 |
| ------------------ | --------------------------------------------------------------- |
| `src/domain/`      | `src/domain/`                                                   |
| `src/application/` | `src/application/`, `src/domain/`                               |
| `src/browser/`     | itself, application, domain, approved assets, generated outputs |
| `src/persistence/` | itself, application, domain                                     |
| `src/sound/`       | itself, application, domain, approved assets, generated outputs |
| `src/simulation/`  | itself, application, domain                                     |
| `src/generated/`   | generated outputs only                                          |
| `src/main.ts`      | every layer, for composition only                               |

Browser, persistence, sound, and simulation are peer adapters. They do not
import one another. Cross-adapter behavior is expressed through application or
domain contracts and wired in `src/main.ts`.

## Authoritative domain restrictions

Domain state transitions receive every varying input explicitly. ESLint rejects
browser globals, browser storage, wall-clock APIs, ambient randomness, timers,
and host-runtime globals under `src/domain/`. Dependency validation separately
rejects Node built-ins, including filesystem modules. Pass seeded randomness,
logical steps, profile snapshots, and commands through typed parameters.

## Clean-room production inputs

`original/`, `decompiled/`, and `exports/` are prohibited production inputs.
`research/` and `clean-room/` describe behavior but are not runtime resources;
`tooling/` is also excluded. Import validation rejects dependencies on these
directories, and the Vite guard rejects any prohibited file that reaches a
production build. Vite's implicit public directory is disabled so static files
cannot bypass module validation.

Approved independently created or separately licensed assets live under
`src/assets/` with neighboring provenance records. Generator outputs derived
only from clean-room inputs live under `src/generated/`; the generator is
committed and text outputs carry an `@generated from clean-room input` header.
Generated domain-owned files instead live below `src/domain/generated/` so all
domain API restrictions continue to apply.

## Validation

Run the dependency check directly with:

```sh
npm run check:architecture
```

It is also part of `npm run validate:fast` and therefore of the complete
`npm run validate` gate. Unit tests exercise passing inward dependencies and
representative dependency, runtime API, randomness, time, storage, and artifact
violations.
