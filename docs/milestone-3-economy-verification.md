# Milestone 3 economy verification

Issue #46 records the parity evidence for the non-combat part of Milestone 3.
The shared engine now has one versioned purchasing policy, fixed-seed economy
checks, and browser/Node trace comparisons. Combat resolution and rewards remain
outside this ticket.

## Purchasing policy

`purchasingPolicy` is the `purchase-reachable-shops` policy at version `2` with
an empty configuration. Its agent receives the same public observation and
preceding public events as a browser presentation. It makes four decisions:

- dismiss tutorial page 0 when the public dismissal action is eligible;
- use the carried item when the public item-use action is eligible;
- issue the shared `purchase-current-encounter` command when the public
  purchase action is eligible for a current shop;
- otherwise issue no command.

The policy never reads `RunState`, hidden encounter-generation fields, random
state, prices, or effects. The domain still checks the cached price, range,
gold, one-use state, tier cap, purchase effect, item-use phase, and inventory.
A `run-ended` event also stops policy commands. The item-use command shares the
browser input path.

Browser input imports the same command constant as the policy. The browser
purchase button is disabled from the latest public action eligibility and sends
that command without calculating affordability or effects.

## Fixed seed evidence

The unit scenario runs the policy against this reviewed seed set. Each run uses
the `original-v1.3` ruleset, the level-one starting profile, and a 420-step
budget. The budget is long enough to reach an active battle. Attack resolution
and rewards were not implemented when this economy evidence was recorded, so
each result ends with `step-limit` after battle start.

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
deterministic fixtures, not claims that the combat system has resolved a battle
or settled its rewards.

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

The locked `m3-parity-schedule` trace hash, updated for the version-13 active
battle state, public battle projection, and policy's item-use command, is
`sha256-v1:d431862bee51fdc5319d72c135d1ea69a6fe895cd9ce68a76957def7f32af075`.

## Compatibility labels and boundary

The encounter, pricing, Shrine, inventory, gold, and tier rules in these tests
are **CONFIRMED** by the human-authored research specification. The fixed seed
coverage and full-run invariant results are **DERIVED** evidence from the
clean-room implementation and selected deterministic inputs. The policy
descriptor, item-use command sharing, public action name, event shapes, and
hidden multiplier representation are clean-room implementation decisions built
on the public contracts. The item effects and immediate consumption remain
**CONFIRMED** research behavior.

The battle transition now emits `battle-started` when the battle crosses the
confirmed world threshold and changes the run phase to `battling`. Issue #56
initializes the selected enemy and both authoritative actors at that point.
Issue #58 adds a battle-only `use-carried-item` command. The public policy and
browser input issue it only when `canUseCarriedItem` is true. Elixir restores
current HP, Divine Edge sets the current battle's hero attack factor to 100,
and Gold Voucher sets the current battle's hidden gold multiplier to 10. Each
valid use consumes the one inventory slot; rejected uses emit a public reason
and leave item state unchanged.
After the threshold-crossing tick, distance, day, score, encounter movement,
and encounter generation stay fixed while battle speed decays and lifespan
continues to drain. This verification still does not claim an attack outcome,
reward, or post-battle purchase cycle because those remain later Milestone 4
tickets.

The research ledger's unresolved tier-10 GUI question remains unchanged. The
clean-room decision continues to make max-tier equipment ineligible in public
observations and rejects a direct command without spending gold, healing, or
marking the shop used.
