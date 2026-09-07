interface EnemySnapshot {
  readonly id: string;
  readonly reward: number;
}

/** @playerVisible */
interface ObservedEnemy {
  readonly id: string;
}

/** @playerVisible */
interface PlayerObservation {
  readonly enemy: ObservedEnemy;
}

interface PresentationFrame {
  readonly internalTestValue: EnemySnapshot;
}

export type { EnemySnapshot, PlayerObservation, PresentationFrame };
