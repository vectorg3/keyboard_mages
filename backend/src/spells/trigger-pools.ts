import { SpellSchool, SpellTier } from './spell.types';

type TierTriggerPools = Record<SpellTier, readonly string[]>;

/** Shared trigger words for every spell of the same school and tier. */
export const TRIGGER_POOLS: Record<SpellSchool, TierTriggerPools> = {
  [SpellSchool.Fire]: {
    [SpellTier.Basic]: ['ember', 'flame', 'spark', 'blaze', 'scorch'],
    [SpellTier.Advanced]: [
      'inferno',
      'burning',
      'furnace',
      'wildfire',
      'firebrand',
    ],
    [SpellTier.Ultimate]: [
      'immolation',
      'incineration',
      'conflagration',
      'pyromancer',
      'firestormrage',
    ],
  },
  [SpellSchool.Ice]: {
    [SpellTier.Basic]: ['frost', 'chill', 'rime', 'sleet', 'glaze'],
    [SpellTier.Advanced]: [
      'iceberg',
      'snowfall',
      'icebound',
      'whiteout',
      'cryonic',
    ],
    [SpellTier.Ultimate]: [
      'permafrost',
      'wintertide',
      'absolutezero',
      'glacialstorm',
      'deepfreeze',
    ],
  },
  [SpellSchool.Arcane]: {
    [SpellTier.Basic]: ['rune', 'glyph', 'aether', 'mana', 'focus'],
    [SpellTier.Advanced]: [
      'arcanum',
      'astral',
      'manaflow',
      'starlight',
      'runebind',
    ],
    [SpellTier.Ultimate]: [
      'chronoshift',
      'spellbreaker',
      'astralnexus',
      'realitybend',
      'arcaneascend',
    ],
  },
  [SpellSchool.Chaos]: {
    [SpellTier.Basic]: ['chaos', 'flux', 'rift', 'havoc', 'warp'],
    [SpellTier.Advanced]: [
      'entropy',
      'unstable',
      'discord',
      'anomaly',
      'wildmagic',
    ],
    [SpellTier.Ultimate]: [
      'voidcollapse',
      'cataclysm',
      'pandemonium',
      'annihilation',
      'realitytear',
    ],
  },
  [SpellSchool.Nature]: {
    [SpellTier.Basic]: ['vine', 'root', 'thorn', 'bloom', 'bark'],
    [SpellTier.Advanced]: [
      'entangle',
      'regrowth',
      'bramble',
      'verdancy',
      'lifebloom',
    ],
    [SpellTier.Ultimate]: [
      'wildgrowth',
      'naturesfury',
      'forestwrath',
      'worldroot',
      'vampiricroots',
    ],
  },
};

export function pickTrigger(
  school: SpellSchool,
  tier: SpellTier,
  previousTrigger: string | null,
  random: () => number = Math.random,
): string {
  const pool = TRIGGER_POOLS[school][tier];
  const candidates =
    pool.length > 1 ? pool.filter((word) => word !== previousTrigger) : pool;
  const index = Math.min(
    candidates.length - 1,
    Math.floor(random() * candidates.length),
  );
  return candidates[index];
}
