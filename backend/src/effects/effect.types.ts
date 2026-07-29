export type EffectType =
  | 'damage_boost'
  | 'slow'
  | 'dot'
  | 'hot'
  | 'shield'
  | 'silence'
  | 'cooldown_reduction'
  | 'death_ward' // не даёт умереть один раз, см. Phoenix Rebirth
  | 'reflect' // отражает magnitude-долю КАЖДОГО полученного удара, не тратится (см. Mirror Shield; отличие от shield.reflectRatio — тот отражает долю только от поглощённого щитом урона и конечен)
  | 'cooldown_delay'; // флэт-добавка (мс) к кулдауну СЛЕДУЮЩЕГО успешного каста, расходуется за одно применение (см. Void Collapse)

export interface ActiveEffect {
  id: string; // uuid инстанса каста
  effectType: EffectType;
  sourceSpellId: string;
  targetPlayerId: string;
  magnitude: number; // сила эффекта: флэт (dot/hot/shield-пул/cooldown_delay-мс) или множитель-надбавка (1+magnitude) для slow/damage_boost/cooldown_reduction
  durationMs: number;
  appliedAt: number; // серверный timestamp
  tickIntervalMs?: number; // для DoT/HoT
  // Для shield: доля (0..1) поглощённого урона, которая отражается обратно атакующему.
  reflectRatio?: number;
  // Для damage_boost: применять ли к исходящему урону (когда владелец атакует) или к
  // входящему (когда владелец получает удар) — см. duel.service.ts. Без значения действует
  // на оба направления (обратная совместимость на случай, если direction не указан).
  damageDirection?: 'outgoing' | 'incoming';
}
