/** @playerVisible */
export type RuleSetId = string;

export interface ProfileState {
  readonly schemaVersion: number;
  readonly scoreMultiplier: number;
  readonly tutorialPreference?: "enabled" | "disabled";
}

export interface RandomState {
  readonly algorithm: "mulberry32-fnv1a32-v1";
  readonly state: number;
}

/** @playerVisible */
export type RunPhase = "running" | "battling" | "ended";

/** @playerVisible */
export type RunTerminalReason = "lifespan" | "combat";

export interface RunLifecycleState {
  readonly phase: RunPhase;
  readonly terminalReason: RunTerminalReason | null;
  readonly paused: boolean;
  readonly tutorialPage: 0 | null;
  readonly pregameStepsRemaining: number;
}

export interface LifespanState {
  readonly whole: number;
  readonly fraction: number;
}

/** @playerVisible */
export interface LifespanObservation {
  readonly whole: number;
  readonly fraction: number;
}

/** @playerVisible */
export type InventoryItemId = "elixir" | "divine-edge" | "gold-voucher";

/** @playerVisible */
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

/** @playerVisible */
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

/** @playerVisible */
export interface PlayerObservation {
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

/** @playerVisible */
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

/** @playerVisible */
export interface ObservedShopEncounter {
  readonly kind: "shop";
  readonly shop: ShopId;
  readonly cachedPrice: number;
}

/** @playerVisible */
export type EnemyId = "goblin" | "golem" | "wolf" | "dragon";

export interface EnemySnapshot {
  readonly id: EnemyId;
  readonly maximumHp: number;
  readonly attack: number;
  readonly goldReward: number;
  readonly profileExp: number;
}

/** @playerVisible */
export interface ObservedEnemy {
  readonly id: EnemyId;
  readonly maximumHp: number;
}

/** @playerVisible */
export type CombatActorPhase = "idle" | "move" | "attack" | "flinch" | "dead";

export interface CombatActorState {
  readonly phase: CombatActorPhase;
  readonly x: number;
  readonly attackDelay: number;
  readonly attackFactor: number;
  readonly attackCount: number;
  readonly alpha: number;
  readonly attackTicks: number;
  readonly knockback: number;
}

export interface BattleState {
  readonly enemyHp: number;
  readonly enemyGoldMultiplier: number;
  readonly hero: CombatActorState;
  readonly enemy: CombatActorState;
}

/** @playerVisible */
export interface ObservedCombatActor {
  readonly phase: CombatActorPhase;
  readonly x: number;
}

/** @playerVisible */
export interface ObservedBattleEnemy {
  readonly id: EnemyId;
  readonly maximumHp: number;
  readonly currentHp: number;
}

/** @playerVisible */
export interface BattleObservation {
  readonly enemy: ObservedBattleEnemy;
  readonly actors: {
    readonly hero: ObservedCombatActor;
    readonly enemy: ObservedCombatActor;
  };
}

/** @playerVisible */
export interface BattleEncounter {
  readonly kind: "battle";
}

export interface QueuedBattleEncounter extends BattleEncounter {
  readonly enemy: EnemySnapshot;
}
export type QueuedEncounter = ShopEncounter | QueuedBattleEncounter;

/** @playerVisible */
export type ObservedQueuedEncounter = ObservedShopEncounter | BattleEncounter;

export interface PositionedShopEncounter extends ShopEncounter {
  readonly x: number;
  readonly used: boolean;
}

/** @playerVisible */
export interface ObservedPositionedShopEncounter extends ObservedShopEncounter {
  readonly x: number;
  readonly used: boolean;
}

export interface PositionedBattleEncounter extends QueuedBattleEncounter {
  readonly x: number;
}

export type CurrentEncounter =
  PositionedShopEncounter | PositionedBattleEncounter;

/** @playerVisible */
export interface ObservedPositionedBattleEncounter extends BattleEncounter {
  readonly enemy: ObservedEnemy;
  readonly x: number;
}

/** @playerVisible */
export type ObservedCurrentEncounter =
  ObservedPositionedShopEncounter | ObservedPositionedBattleEncounter;

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

/** @playerVisible */
export interface EncounterObservation {
  readonly current: ObservedCurrentEncounter | null;
  readonly upcoming: readonly ObservedQueuedEncounter[];
}

export interface RunState {
  readonly schemaVersion: 15;
  readonly ruleset: RuleSetId;
  readonly random: RandomState;
  readonly steps: number;
  readonly activeTicks: number;
  readonly scoreMultiplier: number;
  readonly movementSpeed: number;
  readonly distance: number;
  readonly day: number;
  readonly score: number;
  readonly profileExpEarned: number;
  readonly dragonKills: number;
  readonly lifespan: LifespanState;
  readonly player: PlayerState;
  readonly battle: BattleState | null;
  readonly encounters: EncounterQueueState;
  readonly lifecycle: RunLifecycleState;
}

/** @playerVisible */
export interface TogglePauseCommand {
  readonly type: "toggle-pause";
}

/** @playerVisible */
export interface DismissTutorialCommand {
  readonly type: "dismiss-tutorial";
}

/** @playerVisible */
export interface PurchaseCurrentEncounterCommand {
  readonly type: "purchase-current-encounter";
}

/** @playerVisible */
export interface UseCarriedItemCommand {
  readonly type: "use-carried-item";
}

/** @playerVisible */
export type GameCommand =
  | TogglePauseCommand
  | DismissTutorialCommand
  | PurchaseCurrentEncounterCommand
  | UseCarriedItemCommand;

/** @playerVisible */
export interface StepAdvancedEvent {
  readonly type: "step-advanced";
  readonly step: number;
}

/** @playerVisible */
export interface PauseToggledEvent {
  readonly type: "pause-toggled";
  readonly paused: boolean;
}

/** @playerVisible */
export interface TutorialDismissedEvent {
  readonly type: "tutorial-dismissed";
  readonly page: 0;
}

/** @playerVisible */
export interface LifespanDeathEvent {
  readonly type: "lifespan-death";
}

/** @playerVisible */
export interface RunEndedEvent {
  readonly type: "run-ended";
  readonly reason: RunTerminalReason;
}

/** @playerVisible */
export interface EncounterPromotedEvent {
  readonly type: "encounter-promoted";
  readonly encounter: ObservedCurrentEncounter;
}

/** @playerVisible */
export interface ShopDepartedEvent {
  readonly type: "shop-departed";
  readonly shop: ShopId;
}

/** @playerVisible */
export interface BattleStartedEvent {
  readonly type: "battle-started";
  readonly enemy: ObservedBattleEnemy;
}

/** @playerVisible */
export type CombatActorId = "hero" | "enemy";

/** @playerVisible */
export interface CombatPhaseChangedEvent {
  readonly type: "combat-phase-changed";
  readonly actor: CombatActorId;
  readonly phase: CombatActorPhase;
}

/** @playerVisible */
export interface CombatHitEvent {
  readonly type: "combat-hit";
  readonly attacker: CombatActorId;
  readonly target: CombatActorId;
  readonly damage: number;
  readonly critical: boolean;
  readonly remainingHp: number;
}

/** @playerVisible */
export interface CombatLethalHitEvent {
  readonly type: "combat-lethal-hit";
  readonly attacker: CombatActorId;
  readonly target: CombatActorId;
}

/** @playerVisible */
export interface BattleRewardEvent {
  readonly type: "battle-reward";
  readonly enemy: EnemyId;
  readonly gold: number;
  readonly score: number;
  readonly profileExp: number;
  readonly dragonKilled: boolean;
}

/** @playerVisible */
export interface ShopPurchasedEvent {
  readonly type: "shop-purchased";
  readonly shop: ShopId;
  readonly price: number;
}

/** @playerVisible */
export interface ItemUsedEvent {
  readonly type: "item-used";
  readonly item: InventoryItemId;
}

/** @playerVisible */
export type PurchaseRejectionReason =
  | "already-used"
  | "insufficient-gold"
  | "lifecycle-gated"
  | "maximum-tier"
  | "no-current-shop"
  | "out-of-range"
  | "shop-effect-unavailable";

/** @playerVisible */
export interface PurchaseRejectedEvent {
  readonly type: "purchase-rejected";
  readonly reason: PurchaseRejectionReason;
}

/** @playerVisible */
export type ItemUseRejectionReason =
  "lifecycle-gated" | "no-current-battle" | "no-item";

/** @playerVisible */
export interface ItemUseRejectedEvent {
  readonly type: "item-use-rejected";
  readonly reason: ItemUseRejectionReason;
}

/** @playerVisible */
export type GameEvent =
  | BattleStartedEvent
  | BattleRewardEvent
  | CombatPhaseChangedEvent
  | CombatHitEvent
  | CombatLethalHitEvent
  | EncounterPromotedEvent
  | ItemUseRejectedEvent
  | ItemUsedEvent
  | LifespanDeathEvent
  | PauseToggledEvent
  | PurchaseRejectedEvent
  | RunEndedEvent
  | ShopPurchasedEvent
  | StepAdvancedEvent
  | ShopDepartedEvent
  | TutorialDismissedEvent;

/** @playerVisible */
export interface LifecycleObservation {
  readonly phase: RunPhase;
  readonly terminalReason: RunTerminalReason | null;
  readonly paused: boolean;
  readonly tutorialPage: 0 | null;
  readonly pregameStepsRemaining: number;
  readonly activeGameplay: boolean;
}

/** @playerVisible */
export interface ActionEligibility {
  readonly canTogglePause: boolean;
  readonly canDismissTutorial: boolean;
  readonly canPurchaseCurrentEncounter: boolean;
  readonly canUseCarriedItem: boolean;
}

/** @playerVisible */
export interface WorldCamera {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** @playerVisible */
export interface GameObservation {
  readonly ruleset: RuleSetId;
  readonly camera: WorldCamera;
  readonly steps: number;
  readonly activeTicks: number;
  readonly movementSpeed: number;
  readonly distance: number;
  readonly day: number;
  readonly score: number;
  readonly lifespan: LifespanObservation;
  readonly player: PlayerObservation;
  readonly battle: BattleObservation | null;
  readonly encounters: EncounterObservation;
  readonly lifecycle: LifecycleObservation;
  readonly actions: ActionEligibility;
}
