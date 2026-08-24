# Deterministic randomness contract

Authoritative gameplay randomness uses the versioned algorithm identity
`mulberry32-fnv1a32-v1`. This is a clean-room reproducibility decision, not a
claim about the original Flash random sequence, which remains unrecovered and
outside the compatibility target.

## Seed and draw definition

The algorithm expands the supplied string seed with 32-bit FNV-1a over the
string's UTF-16 code units. Each draw advances that unsigned 32-bit state with
Mulberry32 and returns a number in the half-open interval `[0, 1)`. JavaScript's
specified integer operations make the sequence identical in the supported Node
and browser runtimes.

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
  "ruleset": "walking-skeleton-v1",
  "random": {
    "algorithm": "mulberry32-fnv1a32-v1",
    "state": 1234567890
  }
}
```

Random draws are pure state transitions: they do not mutate their input and
return a new state value with the result. Fresh runs therefore own independent
random-state values, and serializing and restoring a state does not change its
subsequent sequence. Authoritative domain code remains prohibited from reading
ambient randomness by the repository lint validation.
