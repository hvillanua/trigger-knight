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

interface RunState {
  readonly randomSeed: number;
}

interface PresentationFrame {
  readonly state: RunState;
}

export type { PlayerObservation, PresentationFrame };
