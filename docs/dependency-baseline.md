# Dependency baseline

This file records the reproducible project foundation selected on 2026-08-23. Versions are exact in `package.json`, the npm dependency graph is committed in `package-lock.json`, and `.node-version` pins the runtime.

## Runtime

| Tool    | Version | Selection                                                |
| ------- | ------: | -------------------------------------------------------- |
| Node.js | 24.19.0 | Latest Node 24 LTS release (`Krypton`) at selection time |
| npm     |  12.0.2 | Latest stable npm release; compatible with Node 24.19.0  |

Node 26.7.0 was the latest Current release at selection time. Node 24 was selected instead because it was the latest LTS line and satisfies every selected tool's supported runtime range.

## Development dependencies

| Package                                                | Version | Selection                                                                                              |
| ------------------------------------------------------ | ------: | ------------------------------------------------------------------------------------------------------ |
| TypeScript native CLI (`@typescript/native` npm alias) |   7.0.2 | Latest stable release; authoritative compiler used by `tsc` and `npm run typecheck`                    |
| TypeScript API compatibility (`typescript` npm alias)  |   6.0.2 | Latest stable TypeScript 6 compatibility package; temporary API provider for `typescript-eslint`       |
| Vite                                                   |   8.2.2 | Latest stable release                                                                                  |
| Vitest                                                 |  4.1.11 | Latest stable release and compatible with Vite 8                                                       |
| Playwright Test                                        |  1.62.1 | Latest stable release                                                                                  |
| Node.js types                                          | 24.13.3 | Latest Node 24 type release, aligned with the pinned runtime instead of the newer Node 26 declarations |
| ESLint                                                 |  10.9.0 | Latest stable release                                                                                  |
| ESLint JavaScript rules                                |  10.0.1 | Latest stable release compatible with ESLint 10                                                        |
| typescript-eslint                                      |  8.67.0 | Latest stable release; uses the supported TypeScript 6 compatibility API                               |
| globals                                                | 17.11.0 | Latest stable release                                                                                  |
| Prettier                                               |   3.9.6 | Latest stable release; prerelease version 4 was excluded                                               |

Versions were checked against the Node.js release index, npm registry distribution tags, and package engine and peer-dependency metadata. Pre-release, beta, release-candidate, nightly, and `next` tags were excluded.

## Clean installation

Use Node 24.19.0 and npm 12.0.2, then run:

```sh
npm ci
npm run setup:browser
```

The browser setup installs the Chromium revision pinned by Playwright. Development, test, and production paths are:

```sh
npm run dev
npm run format
npm run format:check
npm run lint
npm run typecheck
npm run test:unit
npm run test:browser
npm run build
npm run validate:fast
npm run validate
```

`npm run validate:fast` is the pre-commit gate. It checks formatting, linting,
types, and unit tests. `npm run validate` is the pre-push gate and adds browser
tests and the production build. The aggregate commands invoke the same
independent commands listed above.

## Temporary TypeScript 6 compatibility

TypeScript 7.0 provides the native `tsc` executable but does not expose the
programmatic compiler API required by `typescript-eslint`. Following the
TypeScript team's side-by-side guidance, the repository installs:

- `@typescript/native` as an npm alias for TypeScript 7.0.2, providing the
  authoritative `tsc` executable;
- `typescript` as an npm alias for `@typescript/typescript6` 6.0.2, providing
  the supported compiler API and the non-authoritative `tsc6` executable.

**TODO:** Remove the TypeScript 6 compatibility alias once a stable TypeScript
release exposes the native API and the installed stable `typescript-eslint`
release officially supports it. Replace the aliases with the normal supported
`typescript` package, remove `@typescript/native`, regenerate the lockfile,
update this baseline, and run `npm run validate`. Until then, repository
validation must use `npm run typecheck`/`tsc`, never `tsc6`.

## Sources

- [Node.js release index](https://nodejs.org/dist/index.json)
- [npm registry](https://www.npmjs.com/)
- [TypeScript 7 side-by-side compiler guidance](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/#running-side-by-side-with-typescript-60)
- [typescript-eslint supported dependency versions](https://typescript-eslint.io/users/dependency-versions/)
- Package metadata queried through `npm view`
