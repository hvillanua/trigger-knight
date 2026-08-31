/** @hiddenGameplayState Complete values owned by authoritative gameplay. */
interface EnemySnapshot {
  readonly id: string;
  readonly reward: number;
}

interface EncounterObservation {
  readonly enemy: EnemySnapshot;
}

/** @playerVisible Values shared with presentation and ordinary policies. */
interface PlayerObservation {
  readonly encounter: EncounterObservation;
}

export type { PlayerObservation };
