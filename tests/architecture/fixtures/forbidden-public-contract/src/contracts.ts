interface EnemySnapshot {
  readonly id: string;
  readonly reward: number;
}

/** @playerVisible */
interface EncounterObservation {
  readonly enemy: EnemySnapshot;
}

/** @playerVisible */
interface PlayerObservation {
  readonly encounter: EncounterObservation;
}

interface RunState {
  readonly randomSeed: number;
}

/** @playerVisible */
interface DeclarationObservation {
  readonly hidden: HiddenDeclarationState;
}

interface PresentationFrame {
  readonly state: RunState;
}

export type {
  DeclarationObservation,
  PlayerObservation,
  PresentationFrame,
  RunState,
};
