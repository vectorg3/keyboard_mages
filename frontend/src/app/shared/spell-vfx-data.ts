export interface SpellVfx {
  /** Мс проигрывания спрайт-полоски (стягивается 1:1 с CSS-анимацией через animationDuration). */
  durationMs: number;
  /** Кто получает анимацию: сам кастер (баффы/щиты на себя) либо его соперник (урон/дебаффы) —
   *  раздел про target: 'self'/'opponent' в backend/src/spells/spell.types.ts. */
  target: 'caster' | 'opponent';
}

/**
 * VFX-спрайты каста в public/spell-animations/{school}/ — ключ = spellId, файл = `{spellId}.png`.
 * Заполнено только для заклинаний, у которых уже готов спрайт; для остальных анимации просто нет.
 */
export const SPELL_VFX: Record<string, SpellVfx> = {
  fire_spark: { durationMs: 640, target: 'opponent' },
  fire_ember_ward: { durationMs: 1120, target: 'caster' },
  fire_blaze: { durationMs: 800, target: 'opponent' },
  fire_phoenix_rebirth: { durationMs: 640, target: 'caster' },
  fire_inferno_storm: { durationMs: 1600, target: 'opponent' },

  ice_frostbite: { durationMs: 640, target: 'opponent' },
  ice_winters_grasp: { durationMs: 640, target: 'opponent' },
  ice_ice_shard: { durationMs: 640, target: 'opponent' },
  ice_frozen_armor: { durationMs: 640, target: 'caster' },
  ice_blizzard: { durationMs: 1440, target: 'opponent' },

  arcane_arcane_blast: { durationMs: 720, target: 'opponent' },
  arcane_power_rune: { durationMs: 1680, target: 'caster' },
  arcane_arcane_missile: { durationMs: 720, target: 'opponent' },
  arcane_mirror_shield: { durationMs: 1760, target: 'caster' },
  arcane_time_warp: { durationMs: 1120, target: 'caster' },
  arcane_spellbreaker: { durationMs: 1840, target: 'opponent' },

  chaos_chaos_bolt: { durationMs: 720, target: 'opponent' },
  chaos_unstable_surge: { durationMs: 1120, target: 'caster' },
  chaos_entropy_veil: { durationMs: 1440, target: 'caster' },
  chaos_corruption: { durationMs: 1200, target: 'opponent' },
  chaos_void_collapse: { durationMs: 1520, target: 'opponent' },

  nature_vine_whip: { durationMs: 880, target: 'opponent' },
  nature_bark_skin: { durationMs: 720, target: 'caster' },
  nature_entangle: { durationMs: 960, target: 'opponent' },
  nature_regrowth: { durationMs: 1200, target: 'caster' },
  nature_natures_fury: { durationMs: 1040, target: 'opponent' },
  nature_vampiric_roots: { durationMs: 960, target: 'opponent' },
};
