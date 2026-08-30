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

Run-state schema version `11` includes fixed-step lifecycle state, running
progression, the consumed profile multiplier, player economy and named loadout,
the current encounter and its one-use purchase state, the three-entry queue,
its world counter and hidden generation, Soul Shrine, and Dragon bookkeeping,
the ruleset identity, and the complete post-generation random state:

```json
{
  "schemaVersion": 11,
  "ruleset": "original-v1.3",
  "steps": 0,
  "activeTicks": 0,
  "scoreMultiplier": 1,
  "movementSpeed": 0,
  "distance": 0,
  "day": 1,
  "score": 0,
  "lifespan": {
    "whole": 99,
    "fraction": 99
  },
  "player": {
    "gold": 300,
    "weapon": { "tier": 1, "name": "Dagger", "attack": 216 },
    "armor": { "tier": 1, "name": "Clothing" },
    "hp": { "current": 1908, "maximum": 1908 },
    "inventory": { "item": "elixir" }
  },
  "encounters": {
    "current": null,
    "distanceUntilNext": 1467,
    "upcoming": [
      {
        "kind": "shop",
        "shop": "bladesmith",
        "cachedPrice": 236
      },
      {
        "kind": "battle",
        "enemy": {
          "id": "goblin",
          "maxHp": 660,
          "attack": 122,
          "gold": 82,
          "profileExp": 13
        }
      },
      { "kind": "shop", "shop": "pharmacy", "cachedPrice": 150 }
    ],
    "generation": {
      "shopsUntilBattle": 0,
      "seenSinceBattle": {
        "bladesmith": false,
        "armorsmith": false,
        "soulShrine": false
      },
      "dragonSpawned": false,
      "soulShrine": {
        "extensions": 0,
        "emergencyThreshold": 45,
        "emergencyChanceGiven": false
      }
    }
  },
  "lifecycle": {
    "phase": "running",
    "terminalReason": null,
    "paused": false,
    "tutorialPage": 0,
    "pregameStepsRemaining": 60
  },
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
ambient randomness by the repository lint validation. Queue generation consumes
only explicit bounded draws.

Rejected duplicate shops and early-day Voucher candidates consume another
`random(100)` draw. A battle first consumes its `random(3)` shop-count draw.
When the Dragon flag is clear and the day is at least 7, generation then
consumes `random(100)` for the Dragon chance. Day 7 has a zero threshold and
therefore cannot select a Dragon. A failed eligible roll consumes a following
`random(3)` draw for Goblin, Golem, or Wolf. Before day 7, or while the Dragon
flag is set, generation consumes only that ordinary `random(3)` draw. Selecting
a Dragon sets the hidden flag; an ordinary battle leaves it set until that
ordinary battle becomes current, when the flag clears.

Fresh runs draw `random(1000)` after filling the queue, then draw `random(10)`
for the initial 40-49 emergency Shrine threshold. Promotions generate the
replacement queue entry, then draw `random(300)` for the next world-space
distance. A forced Shrine skips the normal shop roll and consumes one
`random(10)` threshold reroll. The research does not confirm the relative order
of initialization draws, so this ordering is an explicit clean-room decision.
Authoritative queue entries retain their enemy snapshots, while ordinary public
lookahead observations redact future enemy identities.
