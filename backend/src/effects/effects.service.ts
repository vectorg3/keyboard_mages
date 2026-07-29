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

  /**
   * Поглощает урон активными shield-эффектами цели, списывая их magnitude (остаток пула HP)
   * прямо на переданных объектах — вызывающий должен убрать из match.effects те, что
   * обнулились, и сам применить reflected-урон к атакующему.
   */
  absorbWithShields(
    damage: number,
    shieldEffects: ActiveEffect[],
  ): { remainingDamage: number; absorbed: number; reflected: number } {
    let remainingDamage = damage;
    let absorbed = 0;
    let reflected = 0;

    for (const shield of shieldEffects) {
      if (remainingDamage <= 0) break;
      const amount = Math.min(remainingDamage, shield.magnitude);
      if (amount <= 0) continue;

      shield.magnitude -= amount;
      remainingDamage -= amount;
      absorbed += amount;
      reflected += amount * (shield.reflectRatio ?? 0);
    }

    return { remainingDamage, absorbed, reflected: Math.round(reflected) };
  }
}
