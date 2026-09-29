import type { ArmorName, WeaponName } from "./contracts.js";

export const ORIGINAL_V13_WEAPON_NAMES = Object.freeze([
  "Dagger",
  "Sword",
  "Rapier",
  "Falchion",
  "Katana",
  "Flamberge",
  "Zweihander",
  "Broad Kris",
  "Excalibur",
  "Astral Sword",
] as const satisfies readonly WeaponName[]);

export const ORIGINAL_V13_ARMOR_NAMES = Object.freeze([
  "Clothing",
  "Protector",
  "Breastplate",
  "Chainmail",
  "Fullplate",
  "Samurai Mail",
  "Valkyrie Garb",
  "Odin Garb",
  "Avalon",
  "Astral Armor",
] as const satisfies readonly ArmorName[]);
