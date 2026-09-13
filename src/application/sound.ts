import type { GameEvent } from "../domain/contracts.js";
import type { SoundPreferences } from "./settings.js";

/** @playerVisible Semantic presentation cue with no asset or playback details. */
export type SoundCue =
  | "ui-activate"
  | "ui-confirm"
  | "ui-cancel"
  | "encounter"
  | "shop-purchase"
  | "purchase-rejected"
  | "item-use"
  | "item-use-rejected"
  | "battle-start"
  | "combat-attack"
  | "combat-hit"
  | "combat-lethal"
  | "reward"
  | "discovery"
  | "achievement"
  | "death"
  | "run-ended"
  | "pause";

/** @playerVisible Browser actions that need feedback without changing gameplay state. */
export type SoundUiAction = "activate" | "confirm" | "cancel";

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
  setSession(sessionId: string | null): void;
  presentTransition(
    sessionId: string,
    step: number,
    events: readonly GameEvent[],
  ): void;
  presentUiAction(action: SoundUiAction): void;
  setVisible(visible: boolean): void;
  stop(): void;
}
