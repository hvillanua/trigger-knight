/** @hiddenGameplayState Complete values owned by authoritative gameplay. */
interface EnemySnapshot {
  readonly id: string;
  readonly reward: number;
}

interface ObservedEnemy {
  readonly id: string;
}

/** @playerVisible Values shared with presentation and ordinary policies. */
interface PlayerObservation {
  readonly enemy: ObservedEnemy;
}

export type { EnemySnapshot, PlayerObservation };
