import type { GameEvent, GameObservation } from "../domain/contracts.js";

/** @playerVisible Values delivered to browser presentation. */
export interface PresentationFrame {
  readonly previous: Readonly<GameObservation>;
  readonly current: Readonly<GameObservation>;
  readonly interpolation: number;
  readonly events: readonly GameEvent[];
}

/** @playerVisible One authoritative transition before display interpolation. */
export interface PresentationTransition {
  readonly previous: Readonly<GameObservation>;
  readonly current: Readonly<GameObservation>;
  readonly events: readonly GameEvent[];
}

/** @playerVisible Output boundary implemented by browser presentation adapters. */
export interface PresentationPort {
  present(frame: PresentationFrame): void;
  /** Records every public transition even when display renders are coalesced. */
  presentTransition?(transition: PresentationTransition): void;
}
