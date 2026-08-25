# Deterministic randomness contract

Authoritative gameplay randomness uses the versioned algorithm identity
`mulberry32-fnv1a32-v1`. This is a clean-room reproducibility decision, not a
claim about the original Flash random sequence, which remains unrecovered and
outside the compatibility target.

## Seed and draw definition

The algorithm expands the supplied string seed with 32-bit FNV-1a over the
string's UTF-16 code units. Each unit draw advances that unsigned 32-bit state
with Mulberry32 and returns a number in the half-open interval `[0, 1)`.
JavaScript's specified integer operations make the sequence identical in the
supported Node and browser runtimes.

The researched AVM1 `random(n)` primitive returns an integer in `0..n-1`.
`nextRandomInteger(state, n)` implements that confirmed range as
`floor(nextRandom(state).value * n)`. It requires a positive safe-integer bound
and consumes exactly one Mulberry32 state transition. This output mapping is
part of `mulberry32-fnv1a32-v1`; changing it requires a new algorithm identity.

The complete JSON-safe random state is:

```json
{
  "algorithm": "mulberry32-fnv1a32-v1",
  "state": 1234567890
}
```

Changing the seed expansion, state transition, or output mapping requires a
new algorithm identity. Existing identities must continue to mean the same
sequence so retained seeds and checkpoints remain reproducible.

## Run state and isolation

The minimal run-state schema is version `1` and carries the ruleset identity
and complete random state:

```json
{
  "schemaVersion": 1,
  "ruleset": "original-v1.3",
  "steps": 0,
  "random": {
    "algorithm": "mulberry32-fnv1a32-v1",
    "state": 1234567890
  }
}
```

Random draws are pure state transitions: they do not mutate their input and
return a new state value with the result. Fresh runs therefore own independent
random-state values, and serializing and restoring a state does not change its
subsequent unit or bounded-integer sequence. Because the complete random state
lives in `RunState`, a restored engine checkpoint also produces the same later
engine outcomes. Authoritative domain code remains prohibited from reading
ambient randomness by the repository lint validation.
