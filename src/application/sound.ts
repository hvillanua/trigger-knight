import type { GameEvent } from "../domain/contracts.js";
import type { SoundPreferences } from "./settings.js";

/** Semantic presentation cue. Cue names carry no asset or playback details. */
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

/** Browser actions that need feedback without changing gameplay state. */
export type SoundUiAction = "activate" | "confirm" | "cancel";

export type SoundStatus =
  | "uninitialized"
  | "loading"
  | "ready"
  | "degraded"
  | "suspended"
  | "unavailable"
  | "failed";

export interface SoundInitializationResult {
  readonly status: Exclude<SoundStatus, "uninitialized" | "loading">;
  readonly failedCues: readonly SoundCue[];
}

/** Application boundary for browser sound effects. */
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
