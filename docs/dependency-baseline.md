# Dependency baseline

This file records the reproducible project foundation selected on 2026-08-23. Versions are exact in `package.json`, the npm dependency graph is committed in `package-lock.json`, and `.node-version` pins the runtime.

## Runtime

| Tool | Version | Selection |
|---|---:|---|
| Node.js | 24.19.0 | Latest Node 24 LTS release (`Krypton`) at selection time |
| npm | 12.0.2 | Latest stable npm release; compatible with Node 24.19.0 |

Node 26.7.0 was the latest Current release at selection time. Node 24 was selected instead because it was the latest LTS line and satisfies every selected tool's supported runtime range.

## Development dependencies

| Package | Version | Selection |
|---|---:|---|
| TypeScript | 7.0.2 | Latest stable release |
| Vite | 8.2.2 | Latest stable release |
| Vitest | 4.1.11 | Latest stable release and compatible with Vite 8 |
| Playwright Test | 1.62.1 | Latest stable release |
| Node.js types | 24.13.3 | Latest Node 24 type release, aligned with the pinned runtime instead of the newer Node 26 declarations |

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
npm run test:unit
npm run test:browser
npm run build
```

The stable aggregate validation interface, formatting, linting, and broader checks belong to M0-02.

## Sources

- [Node.js release index](https://nodejs.org/dist/index.json)
- [npm registry](https://www.npmjs.com/)
- Package metadata queried through `npm view`
