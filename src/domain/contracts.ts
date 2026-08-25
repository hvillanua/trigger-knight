/** Stable identity for a versioned gameplay ruleset. */
export type RuleSetId = string;

/** Profile snapshot supplied explicitly when a run is created. */
export interface ProfileState {
  readonly schemaVersion: number;
  readonly tutorialPreference?: "enabled" | "disabled";
}

/** Versioned, serializable state for authoritative gameplay randomness. */
export interface RandomState {
  readonly algorithm: "mulberry32-fnv1a32-v1";
  readonly state: number;
}

export type RunPhase = "running" | "ended";

/** Authoritative run phase and the independent gates that can halt gameplay. */
export interface RunLifecycleState {
  readonly phase: RunPhase;
  readonly paused: boolean;
  readonly tutorialPage: 0 | null;
  readonly pregameStepsRemaining: number;
}

/** Authoritative state owned by the gameplay domain. */
export interface RunState {
  readonly schemaVersion: 2;
  readonly ruleset: RuleSetId;
  readonly random: RandomState;
  readonly steps: number;
  readonly activeTicks: number;
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

/** Authoritative outcome emitted by a gameplay transition. */
export type GameEvent =
  PauseToggledEvent | StepAdvancedEvent | TutorialDismissedEvent;

export interface LifecycleObservation extends RunLifecycleState {
  readonly activeGameplay: boolean;
}

export interface ActionEligibility {
  readonly canTogglePause: boolean;
  readonly canDismissTutorial: boolean;
}

/** Public gameplay information shared by browser and automated players. */
export interface GameObservation {
  readonly ruleset: RuleSetId;
  readonly steps: number;
  readonly activeTicks: number;
  readonly lifecycle: LifecycleObservation;
  readonly actions: ActionEligibility;
}
