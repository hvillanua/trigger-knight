/** Stable identity for a versioned gameplay ruleset. */
export type RuleSetId = string;

/** Profile snapshot supplied explicitly when a run is created. */
export interface ProfileState {
  readonly schemaVersion: number;
}

/** Versioned, serializable state for authoritative gameplay randomness. */
export interface RandomState {
  readonly algorithm: "mulberry32-fnv1a32-v1";
  readonly state: number;
}

/** Authoritative state owned by the gameplay domain. */
export interface RunState {
  readonly schemaVersion: 1;
  readonly ruleset: RuleSetId;
  readonly random: RandomState;
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
