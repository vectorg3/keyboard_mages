import { Injectable } from '@nestjs/common';
import { ActiveEffect, EffectType } from './effect.types';

@Injectable()
export class EffectsService {
  // effect.id -> число уже начисленных тиков DoT/HoT
  private readonly ticksApplied = new Map<string, number>();

  isExpired(effect: ActiveEffect, now: number): boolean {
    return now >= effect.appliedAt + effect.durationMs;
  }

  /** Убирает истёкшие эффекты и чистит их тик-состояние. */
  pruneExpired(effects: ActiveEffect[], now: number): ActiveEffect[] {
    const active: ActiveEffect[] = [];
    for (const effect of effects) {
      if (this.isExpired(effect, now)) {
        this.ticksApplied.delete(effect.id);
      } else {
        active.push(effect);
      }
    }
    return active;
  }

  /** Эффекты DoT/HoT, для которых наступил очередной тик с момента последнего вызова. */
  collectDueTicks(effects: ActiveEffect[], now: number): ActiveEffect[] {
    const due: ActiveEffect[] = [];
    for (const effect of effects) {
      if (!effect.tickIntervalMs) continue;
      const elapsedTicks = Math.floor(
        (now - effect.appliedAt) / effect.tickIntervalMs,
      );
      const alreadyApplied = this.ticksApplied.get(effect.id) ?? 0;
      if (elapsedTicks > alreadyApplied) {
        due.push(effect);
        this.ticksApplied.set(effect.id, elapsedTicks);
      }
    }
    return due;
  }

  clearEffectState(effectId: string): void {
    this.ticksApplied.delete(effectId);
  }

  // Комбинирование однотипных модификаторов — всегда мультипликативно (раздел 6.3)
  private combinedMultiplier(
    effects: ActiveEffect[],
    effectType: EffectType,
  ): number {
    return effects
      .filter((e) => e.effectType === effectType)
      .reduce((acc, e) => acc * (1 + e.magnitude), 1);
  }

  getEffectiveCastWindow(baseMs: number, effects: ActiveEffect[]): number {
    return baseMs * this.combinedMultiplier(effects, 'slow');
  }

  getEffectiveDamage(baseDamage: number, effects: ActiveEffect[]): number {
    return baseDamage * this.combinedMultiplier(effects, 'damage_boost');
  }

  getEffectiveCooldown(baseMs: number, effects: ActiveEffect[]): number {
    return baseMs * this.combinedMultiplier(effects, 'cooldown_reduction');
  }

  isSilenced(effects: ActiveEffect[]): boolean {
    return effects.some((e) => e.effectType === 'silence');
  }
}
