import { Component, computed, input, output } from '@angular/core';
import { EffectInfo } from '../socket.service';
import { FloatingNumber } from './floating-number';
import { MageType } from '../shared/mage-type';
import { Fighter } from './fighter';
import { formatCooldown, spellIconPath } from '../shared/format';
import { SPELL_BY_ID } from '../shared/spells-data';
import { SPELL_VFX } from '../shared/spell-vfx-data';

/**
 * Один боец на арене: имя, иконки баффов/дебаффов, HP-бар, летающие циферки урона/хила и
 * спрайт (idle/attack). Чисто презентационный компонент — всё состояние боя (HP, эффекты,
 * кулдауны) остаётся в Match, сюда приходит только на отображение через input().
 */
@Component({
  selector: 'app-character',
  imports: [],
  templateUrl: './character.html',
  styleUrls: ['./character-sprite.css', './character.css'],
  host: {
    class: 'character',
    '[class.character--foe]': "side() === 'foe'",
  },
})
export class Character {
  readonly side = input.required<Fighter>();
  readonly name = input.required<string>();
  readonly mageType = input.required<MageType>();
  readonly hpPercent = input.required<number>();
  readonly effects = input.required<EffectInfo[]>();
  readonly floatingNumbers = input.required<FloatingNumber[]>();
  readonly attacking = input.required<boolean>();

  /** spellId проигрываемого сейчас VFX-каста (см. SPELL_VFX) на ЭТОМ персонаже, как цели
   *  заклинания — null, если сейчас ничего не играется. */
  readonly vfxSpellId = input<string | null>(null);

  readonly attackAnimationEnd = output<void>();
  readonly vfxAnimationEnd = output<void>();

  protected readonly formatCooldown = formatCooldown;
  protected readonly spellIconPath = spellIconPath;

  /** Длительность CSS-анимации текущего VFX — единый источник правды с SPELL_VFX, чтобы
   *  анимация не рассинхронизировалась с конфигом при добавлении новых заклинаний. */
  protected readonly vfxDurationMs = computed(() => {
    const id = this.vfxSpellId();
    return id ? (SPELL_VFX[id]?.durationMs ?? 0) : 0;
  });

  /** Название заклинания-источника эффекта — для title-подсказки на иконке. */
  protected effectSpellName(sourceSpellId: string): string {
    return SPELL_BY_ID[sourceSpellId]?.name ?? sourceSpellId;
  }
}
