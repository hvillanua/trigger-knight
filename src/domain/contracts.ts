/**
 * Stable identity for a versioned gameplay ruleset.
 * @playerVisible
 */
export type RuleSetId = string;

/** Profile snapshot supplied explicitly when a run is created. */
export interface ProfileState {
  readonly schemaVersion: number;
  readonly scoreMultiplier: number;
  readonly tutorialPreference?: "enabled" | "disabled";
}

/** Versioned, serializable state for authoritative gameplay randomness. */
export interface RandomState {
  readonly algorithm: "mulberry32-fnv1a32-v1";
  readonly state: number;
}

/** @playerVisible Current phase exposed to players. */
export type RunPhase = "running" | "battle-handoff" | "ended";

/** @playerVisible Public reason for a completed run. */
export type RunTerminalReason = "lifespan" | "combat";

/**
 * Run phase and gates exposed to players.
 * @playerVisible
 */
export interface RunLifecycleState {
  readonly phase: RunPhase;
  readonly terminalReason: RunTerminalReason | null;
  readonly paused: boolean;
  readonly tutorialPage: 0 | null;
  readonly pregameStepsRemaining: number;
}

/**
 * Original two-part integer lifespan value.
 * @playerVisible
 */
export interface LifespanState {
  readonly whole: number;
  readonly fraction: number;
}

/** @playerVisible Inventory item identity exposed to players. */
export type InventoryItemId = "elixir" | "divine-edge" | "gold-voucher";

/** @playerVisible Weapon name exposed to players. */
export type WeaponName =
  | "Dagger"
  | "Sword"
  | "Rapier"
  | "Falchion"
  | "Katana"
  | "Flamberge"
  | "Zweihander"
  | "Broad Kris"
  | "Excalibur"
  | "Astral Sword";

/** @playerVisible Armor name exposed to players. */
export type ArmorName =
  | "Clothing"
  | "Protector"
  | "Breastplate"
  | "Chainmail"
  | "Fullplate"
  | "Samurai Mail"
  | "Valkyrie Garb"
  | "Odin Garb"
  | "Avalon"
  | "Astral Armor";

/** @playerVisible Player status shown by presentation and policies. */
export interface PlayerState {
  readonly gold: number;
  readonly weapon: {
    readonly tier: number;
    readonly name: WeaponName;
    readonly attack: number;
  };
  readonly armor: {
    readonly tier: number;
    readonly name: ArmorName;
  };
  readonly hp: {
    readonly current: number;
    readonly maximum: number;
  };
  readonly inventory: {
    readonly item: InventoryItemId | null;
  };
}

/** @playerVisible Shop identity exposed to players. */
export type ShopId =
  | "bladesmith"
  | "armorsmith"
  | "soul-shrine"
  | "pharmacy"
  | "grims-shop"
  | "voucher-store";

/** @playerVisible Shop encounter values exposed to players. */
export interface ShopEncounter {
  readonly kind: "shop";
  readonly shop: ShopId;
  readonly cachedPrice: number;
}

/** @playerVisible Enemy identity exposed when its encounter is current. */
export type EnemyId = "goblin" | "golem" | "wolf" | "dragon";

/** Complete enemy values owned by authoritative gameplay. */
export interface EnemySnapshot {
  readonly id: EnemyId;
  readonly maximumHp: number;
  readonly attack: number;
  readonly goldReward: number;
  readonly profileExp: number;
}

/**
 * Player-facing enemy values shown for the current battle.
 * @playerVisible
 */
export interface ObservedEnemy {
  readonly id: EnemyId;
  readonly maximumHp: number;
}

/**
 * Public marker for a queued battle whose enemy is not yet visible.
 * @playerVisible
 */
export interface BattleEncounter {
  readonly kind: "battle";
}

/** Authoritative queued battle with its generation-time enemy values. */
export interface QueuedBattleEncounter extends BattleEncounter {
  readonly enemy: EnemySnapshot;
}
export type QueuedEncounter = ShopEncounter | QueuedBattleEncounter;

/** @playerVisible Public view of a queued encounter. */
export type ObservedQueuedEncounter = ShopEncounter | BattleEncounter;

/** @playerVisible Positioned shop values exposed to players. */
export interface PositionedShopEncounter extends ShopEncounter {
  readonly x: number;
  readonly used: boolean;
}

export interface PositionedBattleEncounter extends QueuedBattleEncounter {
  readonly x: number;
}

/** Complete current encounter owned by gameplay. */
export type CurrentEncounter =
  PositionedShopEncounter | PositionedBattleEncounter;

/** @playerVisible Positioned battle values exposed to players. */
export interface ObservedPositionedBattleEncounter extends BattleEncounter {
  readonly enemy: ObservedEnemy;
  readonly x: number;
}

/** @playerVisible Public view of the current encounter. */
export type ObservedCurrentEncounter =
  PositionedShopEncounter | ObservedPositionedBattleEncounter;

/** Encounter scheduling and generation internals. */
export interface EncounterGenerationState {
  readonly shopsUntilBattle: number;
  readonly dragonSpawned: boolean;
  readonly seenSinceBattle: {
    readonly bladesmith: boolean;
    readonly armorsmith: boolean;
    readonly soulShrine: boolean;
  };
  readonly soulShrine: {
    readonly extensions: number;
    readonly emergencyThreshold: number;
    readonly emergencyChanceGiven: boolean;
  };
}

/** Complete authoritative encounter state. */
export interface EncounterQueueState {
  readonly current: CurrentEncounter | null;
  readonly distanceUntilNext: number;
  readonly upcoming: readonly QueuedEncounter[];
  readonly generation: EncounterGenerationState;
}

/** @playerVisible Current and upcoming encounters exposed to players. */
export interface EncounterObservation {
  readonly current: ObservedCurrentEncounter | null;
  readonly upcoming: readonly ObservedQueuedEncounter[];
}

/** Authoritative state owned by the gameplay domain. */
export interface RunState {
  readonly schemaVersion: 11;
  readonly ruleset: RuleSetId;
  readonly random: RandomState;
  readonly steps: number;
  readonly activeTicks: number;
  readonly scoreMultiplier: number;
  readonly movementSpeed: number;
  readonly distance: number;
  readonly day: number;
  readonly score: number;
  readonly lifespan: LifespanState;
  readonly player: PlayerState;
  readonly encounters: EncounterQueueState;
  readonly lifecycle: RunLifecycleState;
}

/** Device-independent gameplay intent. */
export interface TogglePauseCommand {
  readonly type: "toggle-pause";
}

/** Device-independent gameplay intent. */
export interface DismissTutorialCommand {
  readonly type: "dismiss-tutorial";
}

/** Attempts the domain-owned purchase offered by the current encounter. */
export interface PurchaseCurrentEncounterCommand {
  readonly type: "purchase-current-encounter";
}

export type GameCommand =
  TogglePauseCommand | DismissTutorialCommand | PurchaseCurrentEncounterCommand;

/**
 * Elapsed-step outcome exposed to players.
 * @playerVisible
 */
export interface StepAdvancedEvent {
  readonly type: "step-advanced";
  readonly step: number;
}

/** @playerVisible Pause state change exposed to players. */
export interface PauseToggledEvent {
  readonly type: "pause-toggled";
  readonly paused: boolean;
}

/** @playerVisible Tutorial dismissal exposed to players. */
export interface TutorialDismissedEvent {
  readonly type: "tutorial-dismissed";
  readonly page: 0;
}

/** @playerVisible Lifespan death exposed to players. */
export interface LifespanDeathEvent {
  readonly type: "lifespan-death";
}

/** @playerVisible Run completion exposed to players. */
export interface RunEndedEvent {
  readonly type: "run-ended";
  readonly reason: RunTerminalReason;
}

/** @playerVisible Encounter promotion exposed to players. */
export interface EncounterPromotedEvent {
  readonly type: "encounter-promoted";
  readonly encounter: ObservedCurrentEncounter;
}

/** @playerVisible Shop departure exposed to players. */
export interface ShopDepartedEvent {
  readonly type: "shop-departed";
  readonly shop: ShopId;
}

/** @playerVisible Battle handoff exposed to players. */
export interface BattleHandoffEvent {
  readonly type: "battle-handoff";
}

/** @playerVisible Completed purchase exposed to players. */
export interface ShopPurchasedEvent {
  readonly type: "shop-purchased";
  readonly shop: ShopId;
  readonly price: number;
}

/** @playerVisible Purchase rejection reason exposed to players. */
export type PurchaseRejectionReason =
  | "already-used"
  | "insufficient-gold"
  | "lifecycle-gated"
  | "maximum-tier"
  | "no-current-shop"
  | "out-of-range"
  | "shop-effect-unavailable";

/** @playerVisible Rejected purchase exposed to players. */
export interface PurchaseRejectedEvent {
  readonly type: "purchase-rejected";
  readonly reason: PurchaseRejectionReason;
}

/**
 * Player-visible outcome emitted by a gameplay transition.
 * @playerVisible
 */
export type GameEvent =
  | BattleHandoffEvent
  | EncounterPromotedEvent
  | LifespanDeathEvent
  | PauseToggledEvent
  | PurchaseRejectedEvent
  | RunEndedEvent
  | ShopPurchasedEvent
  | StepAdvancedEvent
  | ShopDepartedEvent
  | TutorialDismissedEvent;

/** @playerVisible Lifecycle values exposed to players. */
export interface LifecycleObservation extends RunLifecycleState {
  readonly activeGameplay: boolean;
}

/** @playerVisible Available player actions. */
export interface ActionEligibility {
  readonly canTogglePause: boolean;
  readonly canDismissTutorial: boolean;
  readonly canPurchaseCurrentEncounter: boolean;
}

/**
 * Ruleset-space view consumed by presentation without physical pixel values.
 * @playerVisible
 */
export interface WorldCamera {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/**
 * Public gameplay information shared by browser and automated players.
 * @playerVisible
 */
export interface GameObservation {
  readonly ruleset: RuleSetId;
  readonly camera: WorldCamera;
  readonly steps: number;
  readonly activeTicks: number;
  readonly movementSpeed: number;
  readonly distance: number;
  readonly day: number;
  readonly score: number;
  readonly lifespan: LifespanState;
  readonly player: PlayerState;
  readonly encounters: EncounterObservation;
  readonly lifecycle: LifecycleObservation;
  readonly actions: ActionEligibility;
}
