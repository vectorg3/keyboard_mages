export type EffectType =
  | 'damage_boost'
  | 'slow'
  | 'dot'
  | 'hot'
  | 'shield'
  | 'silence'
  | 'cooldown_reduction';

export interface ActiveEffect {
  id: string; // uuid инстанса каста
  effectType: EffectType;
  sourceSpellId: string;
  targetPlayerId: string;
  magnitude: number; // сила эффекта (%, флэт, множитель)
  durationMs: number;
  appliedAt: number; // серверный timestamp
  tickIntervalMs?: number; // для DoT/HoT
}
