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

/** @playerVisible Values that reference a project-owned declaration file. */
interface DeclarationObservation {
  readonly hidden: HiddenDeclarationState;
}

interface PresentationFrame {
  readonly state: RunState;
}

export type { DeclarationObservation, PlayerObservation, PresentationFrame };
