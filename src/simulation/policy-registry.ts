import type {
  PlayerPolicy,
  PolicyConfig,
  PolicyDescriptor,
  SimulationPolicyRegistry,
} from "../application/contracts.js";
import { createCombatPolicy } from "./combat-policy.js";
import { nonProgressingPolicy } from "./non-progressing-policy.js";
import { normalizePolicyDescriptor } from "./policy-descriptor.js";
import { purchasingPolicy } from "./purchasing-policy.js";
import { stringifyCanonicalJson } from "./canonical-json.js";

interface PolicyDefinition {
  readonly id: string;
  readonly version: string;
  readonly create: (config: PolicyConfig) => PlayerPolicy;
}

function unsupportedConfiguration(
  descriptor: Readonly<PolicyDescriptor>,
): never {
  throw new RangeError(
    `Unsupported policy configuration for "${descriptor.id}" version "${descriptor.version}"`,
  );
}

function staticPolicy(
  policy: PlayerPolicy,
): (config: PolicyConfig) => PlayerPolicy {
  const expected = stringifyCanonicalJson(policy.descriptor.config);

  return (config) => {
    if (stringifyCanonicalJson(config) !== expected) {
      return unsupportedConfiguration(policy.descriptor);
    }

    return policy;
  };
}

function combatPolicy(config: PolicyConfig): PlayerPolicy {
  const fraction = config.elixirHpFraction;
  if (typeof fraction !== "number") {
    return unsupportedConfiguration({
      id: "combat-shopper",
      version: "1",
      config,
    });
  }

  try {
    const policy = createCombatPolicy({ elixirHpFraction: fraction });
    if (
      stringifyCanonicalJson(policy.descriptor.config) !==
      stringifyCanonicalJson(config)
    ) {
      return unsupportedConfiguration(policy.descriptor);
    }

    return policy;
  } catch {
    return unsupportedConfiguration({
      id: "combat-shopper",
      version: "1",
      config,
    });
  }
}

const definitions: readonly PolicyDefinition[] = Object.freeze([
  {
    id: nonProgressingPolicy.descriptor.id,
    version: nonProgressingPolicy.descriptor.version,
    create: staticPolicy(nonProgressingPolicy),
  },
  {
    id: purchasingPolicy.descriptor.id,
    version: purchasingPolicy.descriptor.version,
    create: staticPolicy(purchasingPolicy),
  },
  {
    id: "combat-shopper",
    version: "1",
    create: combatPolicy,
  },
]);

/** Builds a lookup boundary for the policies supported by batch manifests. */
export function createSimulationPolicyRegistry(): SimulationPolicyRegistry {
  const supported = Object.freeze(
    definitions.map((definition) =>
      normalizePolicyDescriptor({
        id: definition.id,
        version: definition.version,
        config:
          definition.id === "combat-shopper"
            ? { elixirHpFraction: 0.5 }
            : definition.id === nonProgressingPolicy.descriptor.id
              ? nonProgressingPolicy.descriptor.config
              : purchasingPolicy.descriptor.config,
      }),
    ),
  );

  return Object.freeze({
    supported,
    resolve(input: PolicyDescriptor): PlayerPolicy {
      const descriptor = normalizePolicyDescriptor(input);
      const definition = definitions.find(
        (candidate) =>
          candidate.id === descriptor.id &&
          candidate.version === descriptor.version,
      );

      if (definition === undefined) {
        throw new RangeError(
          `Unsupported policy "${descriptor.id}" version "${descriptor.version}"`,
        );
      }

      return definition.create(descriptor.config);
    },
  });
}

/** Default manifest policy registry for the existing production policies. */
export const simulationPolicyRegistry = createSimulationPolicyRegistry();
