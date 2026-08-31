interface EnemySnapshot {
  readonly id: string;
  readonly reward: number;
}

/** @playerVisible Values deliberately included in the public contract. */
interface ObservedEnemy {
  readonly id: string;
}

/** @playerVisible Values shared with presentation and ordinary policies. */
interface PlayerObservation {
  readonly enemy: ObservedEnemy;
}

export type { EnemySnapshot, PlayerObservation };
