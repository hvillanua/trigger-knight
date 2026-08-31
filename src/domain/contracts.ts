/** Stable identity for a versioned gameplay ruleset. */
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

export type RunPhase = "running" | "battle-handoff" | "ended";
export type RunTerminalReason = "lifespan" | "combat";

/** Authoritative run phase and the independent gates that can halt gameplay. */
export interface RunLifecycleState {
  readonly phase: RunPhase;
  readonly terminalReason: RunTerminalReason | null;
  readonly paused: boolean;
  readonly tutorialPage: 0 | null;
  readonly pregameStepsRemaining: number;
}

/** Original two-part integer lifespan value. */
export interface LifespanState {
  readonly whole: number;
  readonly fraction: number;
}

export type InventoryItemId = "elixir" | "divine-edge" | "gold-voucher";

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

export type ShopId =
  | "bladesmith"
  | "armorsmith"
  | "soul-shrine"
  | "pharmacy"
  | "grims-shop"
  | "voucher-store";

export interface ShopEncounter {
  readonly kind: "shop";
  readonly shop: ShopId;
  readonly cachedPrice: number;
}

export type EnemyId = "goblin" | "golem" | "wolf" | "dragon";

export interface EnemySnapshot {
  readonly id: EnemyId;
  readonly maximumHp: number;
  readonly attack: number;
  readonly goldReward: number;
  readonly profileExp: number;
}

/** Player-facing enemy values shown for the current battle. */
export interface ObservedEnemy {
  readonly id: EnemyId;
  readonly maximumHp: number;
}

/** Public marker for a queued battle whose enemy is not yet visible. */
export interface BattleEncounter {
  readonly kind: "battle";
}

/** Authoritative queued battle with its generation-time enemy values. */
export interface QueuedBattleEncounter extends BattleEncounter {
  readonly enemy: EnemySnapshot;
}

export type QueuedEncounter = ShopEncounter | QueuedBattleEncounter;
export type ObservedQueuedEncounter = ShopEncounter | BattleEncounter;

export interface PositionedShopEncounter extends ShopEncounter {
  readonly x: number;
  readonly used: boolean;
}

export interface PositionedBattleEncounter extends QueuedBattleEncounter {
  readonly x: number;
}

export type CurrentEncounter =
  PositionedShopEncounter | PositionedBattleEncounter;

export interface ObservedPositionedBattleEncounter extends BattleEncounter {
  readonly enemy: ObservedEnemy;
  readonly x: number;
}

export type ObservedCurrentEncounter =
  PositionedShopEncounter | ObservedPositionedBattleEncounter;

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

export interface EncounterQueueState {
  readonly current: CurrentEncounter | null;
  readonly distanceUntilNext: number;
  readonly upcoming: readonly QueuedEncounter[];
  readonly generation: EncounterGenerationState;
}

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

/** Authoritative elapsed-step outcome. */
export interface StepAdvancedEvent {
  readonly type: "step-advanced";
  readonly step: number;
}

export interface PauseToggledEvent {
  readonly type: "pause-toggled";
  readonly paused: boolean;
}

export interface TutorialDismissedEvent {
  readonly type: "tutorial-dismissed";
  readonly page: 0;
}

export interface LifespanDeathEvent {
  readonly type: "lifespan-death";
}

export interface RunEndedEvent {
  readonly type: "run-ended";
  readonly reason: RunTerminalReason;
}

export interface EncounterPromotedEvent {
  readonly type: "encounter-promoted";
  readonly encounter: ObservedCurrentEncounter;
}

export interface ShopDepartedEvent {
  readonly type: "shop-departed";
  readonly shop: ShopId;
}

export interface BattleHandoffEvent {
  readonly type: "battle-handoff";
}

export interface ShopPurchasedEvent {
  readonly type: "shop-purchased";
  readonly shop: ShopId;
  readonly price: number;
}

export type PurchaseRejectionReason =
  | "already-used"
  | "insufficient-gold"
  | "lifecycle-gated"
  | "maximum-tier"
  | "no-current-shop"
  | "out-of-range"
  | "shop-effect-unavailable";

export interface PurchaseRejectedEvent {
  readonly type: "purchase-rejected";
  readonly reason: PurchaseRejectionReason;
}

/** Authoritative outcome emitted by a gameplay transition. */
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

export interface LifecycleObservation extends RunLifecycleState {
  readonly activeGameplay: boolean;
}

export interface ActionEligibility {
  readonly canTogglePause: boolean;
  readonly canDismissTutorial: boolean;
  readonly canPurchaseCurrentEncounter: boolean;
}

/** Ruleset-space view consumed by presentation without physical pixel values. */
export interface WorldCamera {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** Public gameplay information shared by browser and automated players. */
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
