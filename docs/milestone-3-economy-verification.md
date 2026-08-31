# Milestone 3 economy verification

Issue #46 records the parity evidence for the non-combat part of Milestone 3.
The shared engine now has one versioned purchasing policy, fixed-seed economy
checks, and browser/Node trace comparisons. Combat resolution and rewards remain
outside this ticket.

## Purchasing policy

`purchasingPolicy` is the `purchase-reachable-shops` policy at version `1` with
an empty configuration. Its agent receives the same public observation and
preceding public events as a browser presentation. It makes three decisions:

- dismiss tutorial page 0 when the public dismissal action is eligible;
- issue the shared `purchase-current-encounter` command when the public
  purchase action is eligible for a current shop;
- otherwise issue no command.

The policy never reads `RunState`, hidden encounter-generation fields, random
state, prices, or effects. The domain still checks the cached price, range,
gold, one-use state, tier cap, and purchase effect. A `run-ended` event also
stops policy commands.

Browser input imports the same command constant as the policy. The browser
purchase button is disabled from the latest public action eligibility and sends
that command without calculating affordability or effects.

## Fixed seed evidence

The unit scenario runs the policy against this reviewed seed set. Each run uses
the `original-v1.3` ruleset, the level-one starting profile, and a 420-step
budget. The budget is long enough to reach the explicit battle handoff. Since
combat is not implemented, each result ends with `step-limit` after the handoff.

| Seed                                                                                                         | Pre-combat purchase covered                      |
| ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------ |
| `m3-policy-01`                                                                                               | Armorsmith                                       |
| `m3-policy-03`                                                                                               | Bladesmith                                       |
| `m3-policy-08`                                                                                               | Pharmacy                                         |
| `m3-policy-14`                                                                                               | Soul Shrine                                      |
| `m3-policy-15`                                                                                               | Grim's Shop                                      |
| `m3-policy-02`, `m3-policy-04` through `m3-policy-07`, `m3-policy-09` through `m3-policy-13`, `m3-policy-16` | Additional queue, spacing, and no-purchase cases |

The policy buys every affordable shop it reaches in the full 16-seed set. A
Voucher Store costs 500 while a fresh run starts with 300 gold, so its purchase
is covered by a later-day focused state with sufficient gold rather than being
described as a natural pre-combat starting-run outcome. Higher-cost weapon
advancement to tier 10 is covered by a focused tier-nine state. Existing
equipment and Shrine suites cover every named tier, cached-price behavior, and
forced Shrine transition.

Every checkpoint in the fixed-seed runs checks:

- exactly three upcoming entries;
- one inventory slot containing a valid item identifier or `null`;
- weapon and armor tiers from 1 through 10 with formula-derived attack and
  maximum HP;
- cached prices from the confirmed equipment, Shrine, and item formulas,
  including stale equipment prices;
- non-negative gold equal to 300 minus the recorded purchase prices;
- at most one purchase for each positioned shop.

The focused state scenarios also cover day 4 Voucher Store purchase, tier-nine
weapon pricing and tier-ten advancement, and a purchase from a shop generated
after a queued battle resets the per-cycle duplicate flags. These states are
deterministic fixtures, not claims that the incomplete pre-combat simulation has
resolved a battle.

## Host parity

The browser and headless tests run the same command schedule for equal run
configuration and compare every checkpoint observation, event list,
authoritative state, checkpoint hash, and trace hash. The browser scenario
re-renders the final transition at several interpolation values without
stepping the engine. Issue #55 moved the `m3-parity-schedule` battle beyond its
old 420-step browser budget by adding battle-generation draws, so the browser
parity schedule now uses 600 steps. The reviewed unit seed set keeps its
420-step budget.

A second Chromium scenario uses 480x640 output at DPR 1 and 1280x720 output at
DPR 2. It uses different redraw counts and still compares both browser traces
with the Node trace. Canvas size, device pixel ratio, redraw cadence, and
interpolation therefore do not affect encounter or economy state.

The locked `m3-parity-schedule` trace hash, updated when issue #55 added enemy
snapshots and the player-facing current-enemy projection, is
`sha256-v1:6d20f4b544b27ae6ff55b6f9bd8f1e2d40118a360dad5199d4dbfc0f94d43181`.

## Compatibility labels and boundary

The encounter, pricing, Shrine, inventory, gold, and tier rules in these tests
are **CONFIRMED** by the human-authored research specification. The fixed seed
coverage and full-run invariant results are **DERIVED** evidence from the
clean-room implementation and selected deterministic inputs. The policy
descriptor and command sharing are clean-room implementation decisions built on
the public contracts.

The Milestone 3 battle transition emits `battle-handoff` when the battle reaches
the confirmed world threshold and changes the run phase to `battle-handoff`.
After that point, distance, day, score, encounter movement, and encounter
generation stay fixed while lifespan can continue to drain. Its original
verification did not select an enemy or invent a combat outcome, reward, or
post-battle purchase cycle. Issue #55 later added generation-time enemy
selection; combat resolution remains Milestone 4 work.

The research ledger's unresolved tier-10 GUI question remains unchanged. The
clean-room decision continues to make max-tier equipment ineligible in public
observations and rejects a direct command without spending gold, healing, or
marking the shop used.
