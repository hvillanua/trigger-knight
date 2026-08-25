import {
  createGameplayEngine,
  type GameplayEngine,
} from "../../src/application/gameplay-engine.js";
import { ruleSetRegistry } from "../../src/domain/rulesets.js";

export function createTestGameplayEngine(): GameplayEngine {
  return createGameplayEngine(ruleSetRegistry);
}
