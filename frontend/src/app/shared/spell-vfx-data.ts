export interface SpellVfx {
  /** Мс проигрывания спрайт-полоски (стягивается 1:1 с CSS-анимацией через animationDuration). */
  durationMs: number;
  /** Кто получает анимацию: сам кастер (баффы/щиты на себя) либо его соперник (урон/дебаффы) —
   *  раздел про target: 'self'/'opponent' в backend/src/spells/spell.types.ts. */
  target: 'caster' | 'opponent';
  /** Кадров в полоске (все VFX-спрайты — однострочные, 64×64/кадр); нужно для нарезки текстур
   *  на canvas — раньше это жило только в background-size конкретного .spell-vfx--{id} в CSS. */
  frameCount: number;
  /** Путь к спрайт-полоске в public/spell-animations/{school}/ — папка школы для ice называется
   *  "frost" (не совпадает с префиксом id), поэтому путь не выводится из spellId и хранится явно. */
  path: string;
}

/**
 * VFX-спрайты каста в public/spell-animations/{school}/ — ключ = spellId, файл = `{spellId}.png`.
 * Заполнено только для заклинаний, у которых уже готов спрайт; для остальных анимации просто нет.
 */
export const SPELL_VFX: Record<string, SpellVfx> = {
  fire_spark: {
    durationMs: 640,
    target: 'opponent',
    frameCount: 8,
    path: '/spell-animations/fire/fire_spark.png',
  },
  fire_ember_ward: {
    durationMs: 1120,
    target: 'caster',
    frameCount: 14,
    path: '/spell-animations/fire/fire_ember_ward.png',
  },
  fire_blaze: {
    durationMs: 800,
    target: 'opponent',
    frameCount: 10,
    path: '/spell-animations/fire/fire_blaze.png',
  },
  fire_phoenix_rebirth: {
    durationMs: 640,
    target: 'caster',
    frameCount: 8,
    path: '/spell-animations/fire/fire_phoenix_rebirth.png',
  },
  fire_inferno_storm: {
    durationMs: 1600,
    target: 'opponent',
    frameCount: 20,
    path: '/spell-animations/fire/fire_inferno_storm.png',
  },

  ice_frostbite: {
    durationMs: 640,
    target: 'opponent',
    frameCount: 8,
    path: '/spell-animations/frost/ice_frostbite.png',
  },
  ice_winters_grasp: {
    durationMs: 640,
    target: 'opponent',
    frameCount: 8,
    path: '/spell-animations/frost/ice_winters_grasp.png',
  },
  ice_ice_shard: {
    durationMs: 640,
    target: 'opponent',
    frameCount: 8,
    path: '/spell-animations/frost/ice_ice_shard.png',
  },
  ice_frozen_armor: {
    durationMs: 640,
    target: 'caster',
    frameCount: 8,
    path: '/spell-animations/frost/ice_frozen_armor.png',
  },
  ice_blizzard: {
    durationMs: 1440,
    target: 'opponent',
    frameCount: 18,
    path: '/spell-animations/frost/ice_blizzard.png',
  },

  arcane_arcane_blast: {
    durationMs: 720,
    target: 'opponent',
    frameCount: 9,
    path: '/spell-animations/arcane/arcane_arcane_blast.png',
  },
  arcane_power_rune: {
    durationMs: 1680,
    target: 'caster',
    frameCount: 21,
    path: '/spell-animations/arcane/arcane_power_rune.png',
  },
  arcane_arcane_missile: {
    durationMs: 720,
    target: 'opponent',
    frameCount: 9,
    path: '/spell-animations/arcane/arcane_arcane_missile.png',
  },
  arcane_mirror_shield: {
    durationMs: 1760,
    target: 'caster',
    frameCount: 22,
    path: '/spell-animations/arcane/arcane_mirror_shield.png',
  },
  arcane_time_warp: {
    durationMs: 1120,
    target: 'caster',
    frameCount: 14,
    path: '/spell-animations/arcane/arcane_time_warp.png',
  },
  arcane_spellbreaker: {
    durationMs: 1840,
    target: 'opponent',
    frameCount: 23,
    path: '/spell-animations/arcane/arcane_spellbreaker.png',
  },

  chaos_chaos_bolt: {
    durationMs: 720,
    target: 'opponent',
    frameCount: 9,
    path: '/spell-animations/chaos/chaos_chaos_bolt.png',
  },
  chaos_unstable_surge: {
    durationMs: 1120,
    target: 'caster',
    frameCount: 14,
    path: '/spell-animations/chaos/chaos_unstable_surge.png',
  },
  chaos_entropy_veil: {
    durationMs: 1440,
    target: 'caster',
    frameCount: 18,
    path: '/spell-animations/chaos/chaos_entropy_veil.png',
  },
  chaos_corruption: {
    durationMs: 1200,
    target: 'opponent',
    frameCount: 15,
    path: '/spell-animations/chaos/chaos_corruption.png',
  },
  chaos_void_collapse: {
    durationMs: 1520,
    target: 'opponent',
    frameCount: 19,
    path: '/spell-animations/chaos/chaos_void_collapse.png',
  },

  nature_vine_whip: {
    durationMs: 880,
    target: 'opponent',
    frameCount: 11,
    path: '/spell-animations/nature/nature_vine_whip.png',
  },
  nature_bark_skin: {
    durationMs: 720,
    target: 'caster',
    frameCount: 9,
    path: '/spell-animations/nature/nature_bark_skin.png',
  },
  nature_entangle: {
    durationMs: 960,
    target: 'opponent',
    frameCount: 12,
    path: '/spell-animations/nature/nature_entangle.png',
  },
  nature_regrowth: {
    durationMs: 1200,
    target: 'caster',
    frameCount: 15,
    path: '/spell-animations/nature/nature_regrowth.png',
  },
  nature_natures_fury: {
    durationMs: 1040,
    target: 'opponent',
    frameCount: 13,
    path: '/spell-animations/nature/nature_natures_fury.png',
  },
  nature_vampiric_roots: {
    durationMs: 960,
    target: 'opponent',
    frameCount: 12,
    path: '/spell-animations/nature/nature_vampiric_roots.png',
  },
};
