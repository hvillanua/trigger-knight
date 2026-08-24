/** Stable identity for a versioned gameplay ruleset. */
export type RuleSetId = string;

/** Profile snapshot supplied explicitly when a run is created. */
export interface ProfileState {
  readonly schemaVersion: number;
}

/** Authoritative state owned by the gameplay domain. */
export interface RunState {
  readonly ruleset: RuleSetId;
}

/** Device-independent gameplay intent. */
export interface GameCommand {
  readonly type: string;
}

/** Authoritative outcome emitted by a gameplay transition. */
export interface GameEvent {
  readonly type: string;
}

/** Public gameplay information shared by browser and automated players. */
export interface GameObservation {
  readonly ruleset: RuleSetId;
}
