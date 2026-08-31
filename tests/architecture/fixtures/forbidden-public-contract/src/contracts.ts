interface EnemySnapshot {
  readonly id: string;
  readonly reward: number;
}

/** @playerVisible Values deliberately included in the public contract. */
interface EncounterObservation {
  readonly enemy: EnemySnapshot;
}

/** @playerVisible Values shared with presentation and ordinary policies. */
interface PlayerObservation {
  readonly encounter: EncounterObservation;
}

export type { PlayerObservation };
