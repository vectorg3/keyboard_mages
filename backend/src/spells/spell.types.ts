import { EffectType } from '../effects/effect.types';

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

// Эффект, который заклинание накладывает при успешном попадании — на соперника кастера
// (по умолчанию, см. Blaze) либо на самого кастера (target: 'self', см. Frozen Armor).
export interface SpellOnHitEffect {
  type: EffectType;
  magnitude: number;
  // Ровно одно из двух должно быть задано: фиксированная длительность или диапазон
  // (см. durationRange). Не проверяется типами — только соглашением между спеллами.
  durationMs?: number;
  tickIntervalMs?: number;
  target?: 'self' | 'opponent'; // по умолчанию 'opponent'
  reflectRatio?: number; // для shield — доля поглощённого урона, отражаемая атакующему
  damageDirection?: 'outgoing' | 'incoming'; // для damage_boost — см. ActiveEffect.damageDirection
  // Случайная длительность в диапазоне [min, max] мс (см. Corruption) — если задано,
  // перекрывает durationMs: конкретное значение бросается при разрешении каста.
  durationRange?: [min: number, max: number];
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
  // Диапазон прямого урона Attack-заклинания. Задаётся индивидуально на заклинании,
  // не выводится из tier (раздел 7.6 game-design.md) — разные заклинания одного уровня
  // могут иметь разную мощь и разброс.
  damage?: { min: number; max: number };
  onHitEffect?: SpellOnHitEffect;
  // Как onHitEffect, но при успешном касте применяется РОВНО ОДИН случайно выбранный элемент
  // из пула (см. Unstable Surge, Entropy Veil). Взаимоисключим с onHitEffect.
  randomEffectPool?: SpellOnHitEffect[];
  // Мгновенное исцеление кастера при успешном касте (см. Phoenix Rebirth) — в отличие от
  // 'hot' это не тикающий эффект, а разовое изменение HP прямо в момент разрешения каста.
  healOnCast?: number;
  // При успешном касте наносимый урон игнорирует damage_boost-эффекты ЦЕЛИ (т.е. её
  // собственное снижение входящего урона вроде Ember Ward) — но не щиты (см. Arcane Missile).
  ignoresDamageReduction?: boolean;
  // При успешном касте ставит случайное заклинание ШКОЛЫ СОПЕРНИКА кастера на кулдаун на
  // durationMs (см. Vine Whip, Entangle, Nature's Fury) — не связано с onHitEffect/ActiveEffect,
  // т.к. бьёт по конкретному spellId в PlayerState.cooldowns, а не по общему списку эффектов.
  disableRandomSpell?: { durationMs: number };
  // При успешном касте обнуляет кулдаун ВСЕХ заклинаний своей школы указанных тиров
  // (см. Time Warp). Тир самого кастуемого заклинания всё равно получит обычный кулдаун
  // следом — общий механизм "кулдаун на весь тир при касте" (раздел 7.10) применяется
  // безусловно после этого сброса.
  resetsCooldownTiers?: SpellTier[];
}
