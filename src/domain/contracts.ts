/**
 * Stable identity for a versioned gameplay ruleset.
 * @playerVisible
 */
export type RuleSetId = string;

/** Saved player preference for contextual tutorial gates. */
export type TutorialPreference = "enabled" | "disabled";

/** @playerVisible Tutorial page identity exposed to players. */
export type TutorialPage = 0 | 1 | 2 | 3 | 4 | 5;

/** Explicit run input, including the earlier minimal configuration shape. */
export interface MinimalProfileInput {
  readonly schemaVersion: number;
  readonly scoreMultiplier: number;
  readonly tutorialPreference?: TutorialPreference;
}

/** Between-run unlock flags shared with an in-progress run. */
export interface ProfileUnlockState {
  readonly weaponDiscoveries: readonly boolean[];
  readonly armorDiscoveries: readonly boolean[];
  /** Research indices 0–4 are defined; index 5 is retained without assigning a condition. */
  readonly achievementSlots: readonly boolean[];
}

/** Accepted explicit run configuration shapes; runtime validation checks versions. */
export type ProfileInput = MinimalProfileInput | ProfileState;

/** Complete between-run progression snapshot. */
export interface ProfileState extends MinimalProfileInput, ProfileUnlockState {
  readonly schemaVersion: 2;
  readonly level: number;
  readonly xp: number;
  readonly highScore: number;
  readonly tutorialPreference: TutorialPreference;
}

/** Authoritative earnings and terminal state accepted by profile settlement. */
export interface CompletedRunSettlementInput extends ProfileUnlockState {
  readonly lifecycle: Pick<RunLifecycleState, "phase" | "terminalReason">;
  readonly score: number;
  readonly profileExpEarned: number;
}

/** @playerVisible Defined original achievement identity; the sixth slot has no identity. */
export type AchievementId =
  | "slay-a-dragon"
  | "stashed-3000-gold"
  | "reach-day-10"
  | "get-all-collection"
  | "perform-70000-damage";

/** @playerVisible Equipment family used by a discovery outcome. */
export type EquipmentKind = "weapon" | "armor";

/** Versioned, serializable state for authoritative gameplay randomness. */
export interface RandomState {
  readonly algorithm: "mulberry32-fnv1a32-v1";
  readonly state: number;
}

/** Authoritative once-per-run progress for contextual tutorial pages. */
export interface TutorialState {
  readonly preference: TutorialPreference;
  readonly page1Shown: boolean;
  readonly page2Shown: boolean;
  readonly page3Shown: boolean;
  readonly page4Shown: boolean;
  readonly page5Shown: boolean;
}

/** @playerVisible Current phase exposed to players. */
export type RunPhase = "running" | "battling" | "ended";

/** @playerVisible Public reason for a completed run. */
export type RunTerminalReason = "lifespan" | "combat";

/** Authoritative run phase and the independent gates that halt gameplay. */
export interface RunLifecycleState {
  readonly phase: RunPhase;
  readonly terminalReason: RunTerminalReason | null;
  readonly paused: boolean;
  readonly tutorialPage: TutorialPage | null;
  readonly pregameStepsRemaining: number;
}

/** Original authoritative two-part integer lifespan value. */
export interface LifespanState {
  readonly whole: number;
  readonly fraction: number;
}

/** @playerVisible Lifespan values exposed to players. */
export interface LifespanObservation {
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

/** Complete authoritative player state. */
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

/** @playerVisible Player status shown by presentation and policies. */
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

/** @playerVisible Shop identity exposed to players. */
export type ShopId =
  | "bladesmith"
  | "armorsmith"
  | "soul-shrine"
  | "pharmacy"
  | "grims-shop"
  | "voucher-store";

/** Complete authoritative queued shop values. */
export interface ShopEncounter {
  readonly kind: "shop";
  readonly shop: ShopId;
  readonly cachedPrice: number;
}

/** @playerVisible Queued shop values exposed to players. */
export interface ObservedShopEncounter {
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

/** @playerVisible Mechanic-bearing actor phase exposed during a battle. */
export type CombatActorPhase = "idle" | "move" | "attack" | "flinch" | "dead";

/** Authoritative automatic combat timing and movement state. */
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

/** Authoritative state for the current battle. */
export interface BattleState {
  readonly enemyHp: number;
  readonly enemyGoldMultiplier: number;
  readonly hero: CombatActorState;
  readonly enemy: CombatActorState;
}

/** @playerVisible Mechanic-bearing actor values exposed during a battle. */
export interface ObservedCombatActor {
  readonly phase: CombatActorPhase;
  readonly x: number;
}

/** @playerVisible Current enemy values exposed during a battle. */
export interface ObservedBattleEnemy {
  readonly id: EnemyId;
  readonly maximumHp: number;
  readonly currentHp: number;
}

/** @playerVisible Current battle values exposed to players. */
export interface BattleObservation {
  readonly enemy: ObservedBattleEnemy;
  readonly actors: {
    readonly hero: ObservedCombatActor;
    readonly enemy: ObservedCombatActor;
  };
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
export type ObservedQueuedEncounter = ObservedShopEncounter | BattleEncounter;

/** Complete authoritative positioned shop values. */
export interface PositionedShopEncounter extends ShopEncounter {
  readonly x: number;
  readonly used: boolean;
}

/** @playerVisible Positioned shop values exposed to players. */
export interface ObservedPositionedShopEncounter extends ObservedShopEncounter {
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
  ObservedPositionedShopEncounter | ObservedPositionedBattleEncounter;

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
export interface RunState extends ProfileUnlockState {
  readonly schemaVersion: 17;
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
  readonly tutorials: TutorialState;
  readonly lifespan: LifespanState;
  readonly player: PlayerState;
  readonly battle: BattleState | null;
  readonly encounters: EncounterQueueState;
  readonly lifecycle: RunLifecycleState;
}

/** @playerVisible Device-independent gameplay intent. */
export interface TogglePauseCommand {
  readonly type: "toggle-pause";
}

/** @playerVisible Device-independent gameplay intent. */
export interface DismissTutorialCommand {
  readonly type: "dismiss-tutorial";
}

/** @playerVisible Attempts the domain-owned purchase offered by the current encounter. */
export interface PurchaseCurrentEncounterCommand {
  readonly type: "purchase-current-encounter";
}

/** @playerVisible Device-independent intent to use the carried item. */
export interface UseCarriedItemCommand {
  readonly type: "use-carried-item";
}

/** @playerVisible Device-independent commands produced by a player. */
export type GameCommand =
  | TogglePauseCommand
  | DismissTutorialCommand
  | PurchaseCurrentEncounterCommand
  | UseCarriedItemCommand;

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
  readonly page: TutorialPage;
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

/** @playerVisible Active battle start exposed to players. */
export interface BattleStartedEvent {
  readonly type: "battle-started";
  readonly enemy: ObservedBattleEnemy;
}

/** @playerVisible Actor identity for resolved combat outcomes. */
export type CombatActorId = "hero" | "enemy";

/** @playerVisible A completed actor phase transition. */
export interface CombatPhaseChangedEvent {
  readonly type: "combat-phase-changed";
  readonly actor: CombatActorId;
  readonly phase: CombatActorPhase;
}

/** @playerVisible Resolved damage, including the displayed critical outcome. */
export interface CombatHitEvent {
  readonly type: "combat-hit";
  readonly attacker: CombatActorId;
  readonly target: CombatActorId;
  readonly damage: number;
  readonly critical: boolean;
  readonly remainingHp: number;
}

/** @playerVisible A lethal hit, before any reward or run settlement. */
export interface CombatLethalHitEvent {
  readonly type: "combat-lethal-hit";
  readonly attacker: CombatActorId;
  readonly target: CombatActorId;
}

/** @playerVisible Earned outcomes exposed only when enemy fade completes. */
export interface BattleRewardEvent {
  readonly type: "battle-reward";
  readonly enemy: EnemyId;
  readonly gold: number;
  readonly score: number;
  readonly profileExp: number;
  readonly dragonKilled: boolean;
}

/** @playerVisible A newly earned equipment discovery. */
export interface EquipmentDiscoveredEvent {
  readonly type: "equipment-discovered";
  readonly equipment: EquipmentKind;
  readonly tier: number;
}

/** @playerVisible A newly earned defined achievement. */
export interface AchievementUnlockedEvent {
  readonly type: "achievement-unlocked";
  readonly achievement: AchievementId;
}

/** @playerVisible Completed purchase exposed to players. */
export interface ShopPurchasedEvent {
  readonly type: "shop-purchased";
  readonly shop: ShopId;
  readonly price: number;
}

/** @playerVisible Successful carried-item use exposed to players. */
export interface ItemUsedEvent {
  readonly type: "item-used";
  readonly item: InventoryItemId;
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

/** @playerVisible Item-use rejection reason exposed to players. */
export type ItemUseRejectionReason =
  "lifecycle-gated" | "no-current-battle" | "no-item";

/** @playerVisible Rejected carried-item use exposed to players. */
export interface ItemUseRejectedEvent {
  readonly type: "item-use-rejected";
  readonly reason: ItemUseRejectionReason;
}

/**
 * Player-visible outcome emitted by a gameplay transition.
 * @playerVisible
 */
export type GameEvent =
  | AchievementUnlockedEvent
  | BattleStartedEvent
  | BattleRewardEvent
  | CombatPhaseChangedEvent
  | CombatHitEvent
  | CombatLethalHitEvent
  | EquipmentDiscoveredEvent
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

/** @playerVisible Lifecycle values exposed to players. */
export interface LifecycleObservation {
  readonly phase: RunPhase;
  readonly terminalReason: RunTerminalReason | null;
  readonly paused: boolean;
  readonly tutorialPage: TutorialPage | null;
  readonly pregameStepsRemaining: number;
  readonly activeGameplay: boolean;
}

/** @playerVisible Available player actions. */
export interface ActionEligibility {
  readonly canTogglePause: boolean;
  readonly canDismissTutorial: boolean;
  readonly canPurchaseCurrentEncounter: boolean;
  readonly canUseCarriedItem: boolean;
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
  readonly lifespan: LifespanObservation;
  readonly player: PlayerObservation;
  readonly battle: BattleObservation | null;
  readonly encounters: EncounterObservation;
  readonly lifecycle: LifecycleObservation;
  readonly actions: ActionEligibility;
}
