import type {
  PlayerAgent,
  PlayerPolicy,
  PolicyDescriptor,
} from "../application/contracts.js";

const NO_COMMANDS = Object.freeze([]);

const descriptor: PolicyDescriptor = Object.freeze({
  id: "non-progressing",
  version: "1",
  config: Object.freeze({}),
});

/** Deterministic policy used to prove that finite runs cannot hang. */
export const nonProgressingPolicy: PlayerPolicy = Object.freeze({
  descriptor,
  createAgent(): PlayerAgent {
    return Object.freeze({
      decide() {
        return NO_COMMANDS;
      },
    });
  },
});
