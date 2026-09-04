import type { GameEvent, GameObservation } from "../domain/contracts.js";

/** @playerVisible Values delivered to browser presentation. */
export interface PresentationFrame {
  readonly previous: Readonly<GameObservation>;
  readonly current: Readonly<GameObservation>;
  readonly interpolation: number;
  readonly events: readonly GameEvent[];
}

/** @playerVisible Output boundary implemented by browser presentation adapters. */
export interface PresentationPort {
  present(frame: PresentationFrame): void;
}
