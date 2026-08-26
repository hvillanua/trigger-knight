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

export type RunPhase = "running" | "ended";
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

/** Authoritative state owned by the gameplay domain. */
export interface RunState {
  readonly schemaVersion: 4;
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

export type GameCommand = TogglePauseCommand | DismissTutorialCommand;

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

/** Authoritative outcome emitted by a gameplay transition. */
export type GameEvent =
  | LifespanDeathEvent
  | PauseToggledEvent
  | RunEndedEvent
  | StepAdvancedEvent
  | TutorialDismissedEvent;

export interface LifecycleObservation extends RunLifecycleState {
  readonly activeGameplay: boolean;
}

export interface ActionEligibility {
  readonly canTogglePause: boolean;
  readonly canDismissTutorial: boolean;
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
  readonly lifecycle: LifecycleObservation;
  readonly actions: ActionEligibility;
}
