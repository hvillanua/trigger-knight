The local defaults are now four Vitest workers and four Playwright workers,
capped further on smaller machines. On the measured machine, the complete browser
suite fell from 110.39 seconds with the original eight-worker setup to 81.53
seconds with the new four-worker default. All 49 tests passed. The unit suite
kept essentially the same duration while its sampled CPU peak roughly halved.

The main test optimization changes checkpoint transport in the milestone 4
combat-loop and milestone 6 compatibility-corpus browser specs. Each block now
crosses the Playwright connection as JSON text and is parsed in Node before the
existing full comparison. No production code changed.

Measurements were taken on September 12–13, 2026, in WSL2 on a Ryzen 7 7700X
with 16 logical CPUs and about 15 GiB of WSL memory. This measures Linux processes
in WSL2; it does not measure native Windows scheduling, fan noise, temperature,
or power consumption.
Exact environment details, phase totals, and per-test durations from the repeated
control and final browser runs are in
[the measurement data](test-performance-results.json).

The initial unit benchmarks ran all 440 tests in 57 files. Wall time includes
the complete npm command. CPU columns show approximate active logical-core
equivalents from 500 ms process-tree samples; 16 would occupy all exposed logical
CPUs. They are not percentages of the whole machine.

| Vitest workers       | Wall seconds, two runs | Sampled CPU peak, two runs |
| -------------------- | ---------------------- | -------------------------- |
| 15, original default | 13.57, 13.08           | 10.78, 10.10               |
| 4                    | 13.01, 12.81           | 5.38, 5.07                 |
| 2                    | 23.37, 23.29           | 2.52, 2.86                 |

The installed Vitest uses the `forks` pool. Its run-mode worker calculation is
`availableParallelism() - 1`, bounded below by one, and the process samples
confirmed 15 workers. These are worker processes, each of which can also have
runtime threads. Transform, import, and test work overlap across files. Increasing
the count from four to fifteen added contention without improving elapsed time.
A repeated control after the session restart took 13.09 seconds with fifteen
workers; the final default took 12.81 seconds with four. Their sampled peaks were
10.86 and 5.23 active cores respectively. Two workers are available as a quieter
override, but their roughly ten-second penalty does not justify making them the
default. Serial execution was not needed or benchmarked.

The initial browser benchmarks ran all 49 tests, with `fullyParallel` enabled.

| Playwright workers | Original wall seconds           | Final wall seconds | Original sampled CPU p95 / peak | Final sampled CPU p95 / peak |
| ------------------ | ------------------------------- | ------------------ | ------------------------------- | ---------------------------- |
| 8                  | 110.69; repeated control 110.39 | 71.05              | 10.15 / 11.86                   | 10.05 / 11.68                |
| 4                  | 120.61                          | 81.53              | 5.47 / 7.15                     | 5.90 / 7.17                  |
| 2                  | 149.20                          | 99.53              | 3.09 / 4.37                     | 3.17 / 4.01                  |

Eight workers finish sooner because the long tests start earlier. Most individual
tests slow down under the additional contention. For example, the final combat
test took about 40 seconds within the four-worker suite and 47 seconds within
the eight-worker suite. After the transport improvement, eight workers saved
about 10.5 seconds over four while retaining much higher CPU pressure. I recommend
four locally and keeping eight available for a dedicated runner of comparable
capacity. A smaller or shared CI runner needs its own measurement.

Both slow tests were also run individually, using one Playwright worker.

| Individual test                           | Original wall seconds | Original with phase timers | JSON transport with phase timers | Final, timers removed |
| ----------------------------------------- | --------------------- | -------------------------- | -------------------------------- | --------------------- |
| Complete combat run across Canvas outputs | 62.73                 | 62.70                      | 35.03                            | 35.02                 |
| Retained compatibility corpus             | 94.66                 | 95.26                      | 54.84                            | 53.81                 |

The phase timers attributed the original durations as follows. Browser evaluation
includes the loop, rendering, diagnostics, and result hashing. Rendering is part
of the loop, so these rows must not be added together. Initial presentation also
occurs just before the loop.

| Phase, seconds                                           | Combat test | Compatibility corpus |
| -------------------------------------------------------- | ----------- | -------------------- |
| Node simulation and retained diagnostics                 | 2.37        | 3.49                 |
| Context and page creation                                | 0.09        | 0.11                 |
| Navigation for run fixtures                              | 0.28        | 0.87                 |
| Browser replay evaluate calls, total                     | 24.63       | 39.33                |
| Browser loop                                             | 21.20       | 33.93                |
| Canvas presentation                                      | 19.89       | 31.96                |
| Policy checks; also public-shape checks in the corpus    | 0.03        | 0.17                 |
| Final readDiagnostics, including canonical trace hashing | 2.02        | 2.99                 |
| Canonical result-trace record serialization              | 0.93        | 1.39                 |
| Record joining, text encoding, and Web Crypto digest     | 0.21        | 0.33                 |
| Browser-to-Node checkpoint transfer                      | 32.12       | 46.99                |
| Node checkpoint comparison                               | 1.89        | 2.81                 |

The transfer phase includes Playwright serialization and deserialization, protocol
round trips, and lazy browser checkpoint hashing. Comparison includes lazy Node
checkpoint hashing. The timers do not separate those lazy hashes from their
callers. Navigation timing for the corpus excludes its two settlement navigations.

Playwright's object transport recursively encodes the many nested records in
each checkpoint, including reference tracking and special-value handling. Passing
JSON text bypasses that traversal for values already normalized to JSON. In the
combat test, transfer and parsing fell from 32.12 to 4.93 seconds, while Canvas
time stayed about 19.9 seconds and the presentation-call count stayed identical.
That controlled change explains the speedup. Rendering remains a substantial
cost because these tests exercise the actual Canvas renderer throughout complete
runs.

Coverage remains intact. The tests retain every checkpoint, both output variants,
the command schedules, independent browser result hashing, checkpoint and trace
hash comparisons, profile settlements, and all public observation, event, and
presentation assertions. Checkpoint values already pass through canonical JSON
normalization, which rejects unsupported values and normalizes negative zero.
The new transport neither selects fields nor replaces comparisons with hashes.
Blocks remain bounded by the existing size.

Two temporary fault injections checked the failure path through the actual
browser transport. Changing an authoritative step in the block starting at 250
failed at `checkpoints[0].state.steps`. Adding a hidden observation field in that
block failed at `checkpoints[0].observation.random`. Both retained trace hashes
were unchanged by the injected faults, so the failures demonstrate that field
comparison still exposes the mismatches. The faults and all timing instrumentation
were removed.

Other possible changes were considered and left out for these reasons.

- Reusing navigation would save under a second in the measured corpus phases.
  Fresh documents retain isolation and predictable initialization between fixtures.
- The corpus already reuses two contexts and pages and runs each Node fixture
  once. There was no duplicate Node run within its variant loop to remove.
- Whole traces support complete field comparison and first-divergence diagnostics.
  Summary-only or hash-only checks would change the guarantees. Streaming traces
  would require a larger test-harness change than the measured transport fix.
- Bigger blocks and concurrent evaluate calls would increase in-flight data.
  The large measured gain came from changing the encoding while keeping block
  boundaries. No larger-block experiment was needed to justify the retained fix.
- Policy serialization and comparison were small costs. Removing assertions or
  caching command encodings would provide little benefit here.
- Reducing redraws, changing Canvas dimensions, or substituting a fake renderer
  would change the output-independence exercise. All existing rendering work stays.
- Parallelizing variants inside a test would add concurrency outside the worker
  limit. Splitting fixtures across tests would change scheduling and context reuse;
  the measured improvement did not require that extra restructuring.

Worker limits can be overridden with `VITEST_MAX_WORKERS` and
`PLAYWRIGHT_WORKERS`, or the runners' `--maxWorkers` and `--workers` arguments.
Playwright also accepts a percentage. With `CI` set, Playwright keeps its
uncapped 50% default; Vitest keeps the measured cap unless explicitly overridden.
Higher Vitest concurrency showed no benefit on this machine. The runner controls
are documented in the [Vitest worker reference](https://vitest.dev/config/maxworkers)
and [Playwright CLI reference](https://playwright.dev/docs/test-cli).

To repeat a worker comparison, run the commands sequentially with the desired
counts. Add `--reporter=list,json` and set `PLAYWRIGHT_JSON_OUTPUT_FILE` to keep
per-test durations. The individual selections used here were:

```sh
npm run test:unit -- --maxWorkers=4
npm run test:browser -- --workers=4
npm run test:browser -- tests/browser/milestone-4-combat-loop.spec.ts --grep 'complete combat run'
npm run test:browser -- tests/browser/milestone-6-compatibility-corpus.spec.ts
```

These are measurements from one machine, not statistical confidence intervals.
Short-lived processes can exit between CPU samples. GNU time does not reliably
include CPU consumed by all Chromium descendants after reparenting, so its CPU
percentage was not used as the browser pressure metric. A session restart removed
the first set of temporary logs; captured tool output retained the reported
figures. The repeated eight-worker control after restart closely matched the
initial baseline. The measurement data preserves per-test results from that
control and the final runs.

Full suites ran for the explicitly requested benchmarks. All final suite runs
passed, as did both individual confirmation runs. Type-checking, linting of the
changed TypeScript files, and the focused diagnostics and canonical JSON unit
tests passed. Environment overrides resolved to the requested values, and the
CI Playwright configuration resolved to `50%`. The aggregate validation command and pre-push hook were not
run, and no push or GitHub Actions polling was performed.
