import type { GameEvent, TutorialPage } from "../domain/contracts.js";
import type { SoundPreferences } from "./settings.js";

/** @playerVisible Original-audio presentation cue with no playback details. */
export type SoundCue =
  | "applause"
  | "battle-start"
  | "button-press"
  | "button-select"
  | "character-death"
  | "enemy-death"
  | "error"
  | "event"
  | "event-triggered"
  | "experience-loop"
  | "hit-01"
  | "hit-02"
  | "hit-03"
  | "item-use"
  | "notice";

/** @playerVisible Browser actions that need feedback without changing gameplay state. */
export type SoundUiAction = "activate" | "confirm" | "cancel" | "select";

/** @playerVisible Independently controlled audio channel. */
export type SoundChannel = "music" | "effects";

/** @playerVisible Sound availability state surfaced by the browser UI. */
export type SoundStatus =
  | "uninitialized"
  | "loading"
  | "ready"
  | "degraded"
  | "suspended"
  | "unavailable"
  | "failed";

/** @playerVisible Result of loading the player-facing sound adapter. */
export interface SoundInitializationResult {
  readonly status: Exclude<SoundStatus, "uninitialized" | "loading">;
  readonly failedCues: readonly SoundCue[];
}

/** @playerVisible Application boundary for browser sound effects. */
export interface SoundPort {
  initialize(): Promise<SoundInitializationResult>;
  setPreferences(preferences: Readonly<SoundPreferences>): void;
  toggleChannel(channel: SoundChannel): void;
  setSession(sessionId: string | null): void;
  startGameplayMusic(): void;
  presentTutorial(): void;
  presentTransition(
    sessionId: string,
    step: number,
    events: readonly GameEvent[],
    tutorialPage?: TutorialPage,
  ): void;
  presentUiAction(action: SoundUiAction): void;
  presentResult(): void;
  setScoreCounting(counting: boolean): void;
  setVisible(visible: boolean): void;
  stopEffects(): void;
  stop(): void;
}
