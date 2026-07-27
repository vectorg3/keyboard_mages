export enum SpellSchool {
  Fire = 'fire',
  Ice = 'ice',
  Arcane = 'arcane',
  Chaos = 'chaos',
  Nature = 'nature',
}

export enum SpellType {
  Attack = 'attack',
  Defense = 'defense',
  Support = 'support',
}

export enum SpellTier {
  Basic = 1,
  Advanced = 2,
  Ultimate = 3,
}

export interface Spell {
  id: string;
  name: string;
  trigger: string;
  school: SpellSchool;
  type: SpellType;
  tier: SpellTier;
  description: string;
  cooldownMs: number;
  castWindowMs: number;
}
