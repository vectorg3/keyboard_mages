import { Component, HostListener, computed, effect, inject, input, signal } from '@angular/core';
import { SocketService } from '../socket.service';
import { SPELL_BUTTONS_BY_SCHOOL } from '../shared/spells-data';
import { MageType } from '../shared/mage-type';
import { Fighter } from '../character/fighter';
import { FloatingNumber } from '../character/floating-number';
import { formatCooldown, spellIconPath } from '../shared/format';
import { Character } from '../character/character';
import { SPELL_VFX } from '../shared/spell-vfx-data';

// Должно совпадать с длительностью CSS-анимации .floating-number (character.css), иначе циферка
// либо пропадёт из DOM до конца анимации, либо повиснет статично после её завершения.
const FLOATING_NUMBER_LIFETIME_MS = 1000;

@Component({
  selector: 'app-match',
  imports: [Character],
  templateUrl: './match.html',
  styleUrl: './match.css',
})
export class Match {
  protected readonly socket = inject(SocketService);

  /** Школа игрока, выбранная ещё в лобби — сервер её самому игроку не возвращает (только
   *  школу соперника, раздел 7.34 game-design.md), поэтому приходит сюда как input. */
  readonly youMageType = input.required<MageType>();
  /** Школа соперника — из match_found (реальный выбор соперника), не локальная заглушка. */
  protected readonly foeMageType = computed<MageType>(
    () => (this.socket.match()?.opponentSchool as MageType | undefined) ?? 'fire',
  );

  protected readonly youAttacking = signal(false);
  protected readonly foeAttacking = signal(false);

  /** spellId проигрываемого сейчас VFX-каста (SPELL_VFX) на этом бойце как ЦЕЛИ заклинания —
   *  null, если сейчас ничего не играется. Независимо от youAttacking/foeAttacking выше, который
   *  всегда проигрывается на кастере вне зависимости от типа заклинания. */
  protected readonly youVfx = signal<string | null>(null);
  protected readonly foeVfx = signal<string | null>(null);

  protected readonly countdownSeconds = computed(() => {
    const ms = this.socket.countdownMs();
    return ms === null ? null : Math.max(1, Math.ceil(ms / 1000));
  });

  /** Кнопки заклинаний школы игрока — пусто, если для школы ещё нет данных/иконок. */
  protected readonly youSpells = computed(() => SPELL_BUTTONS_BY_SCHOOL[this.youMageType()] ?? []);

  /** Сколько символов триггера уже верно введено — из дробного progress (0..1) сервера. */
  protected readonly typedCount = computed(() => {
    const cast = this.socket.activeCast();
    if (!cast) return 0;
    const spell = this.youSpells().find((s) => s.id === cast.spellId);
    if (!spell) return 0;
    return Math.round(this.socket.castProgress() * spell.trigger.length);
  });

  protected readonly activeCastTrigger = computed(() => {
    const cast = this.socket.activeCast();
    if (!cast) return null;
    return this.youSpells().find((s) => s.id === cast.spellId)?.trigger ?? null;
  });

  protected readonly youHpPercent = computed(() => this.hpPercentFor(this.socket.match()?.playerId));
  protected readonly foeHpPercent = computed(() => this.hpPercentFor(this.socket.match()?.opponentId));

  /** Оставшийся кулдаун (мс) по spellId для игрока — undefined/отсутствие ключа = готово. */
  protected readonly youCooldowns = computed(() => {
    const playerId = this.socket.match()?.playerId;
    if (!playerId) return {};
    return this.socket.cooldownsByPlayerId()[playerId] ?? {};
  });

  /** Летающие циферки урона/хила — по одному массиву на бойца, элементы сами себя удаляют
   *  через FLOATING_NUMBER_LIFETIME_MS (см. constructor). */
  protected readonly youFloatingNumbers = signal<FloatingNumber[]>([]);
  protected readonly foeFloatingNumbers = signal<FloatingNumber[]>([]);

  /** Активные баффы/дебаффы над персонажем — иконка = иконка заклинания-источника
   *  (`sourceSpellId`), не общая на тип эффекта (раздел 7.25 game-design.md). */
  protected readonly youEffects = computed(() => this.effectsFor(this.socket.match()?.playerId));
  protected readonly foeEffects = computed(() => this.effectsFor(this.socket.match()?.opponentId));

  protected readonly formatCooldown = formatCooldown;
  protected readonly spellIconPath = spellIconPath;

  constructor() {
    // Проигрываем анимацию атаки на любой успешный каст — единственный доступный "эффект
    // применения заклинания" сейчас, независимо от типа заклинания (Attack/Defense/Support).
    effect(() => {
      const resolved = this.socket.lastResolved();
      if (!resolved?.success) return;
      const casterFighter: Fighter = resolved.casterId === this.socket.playerId ? 'you' : 'foe';
      this.triggerAttack(casterFighter);

      // VFX каста играется на ЦЕЛИ заклинания — на самом кастере для баффов (target: 'caster'),
      // на сопернике для урона/дебаффов (target: 'opponent'); см. SPELL_VFX.
      const vfx = SPELL_VFX[resolved.spellId];
      if (vfx) {
        const targetFighter: Fighter =
          vfx.target === 'caster' ? casterFighter : casterFighter === 'you' ? 'foe' : 'you';
        this.triggerVfx(targetFighter, resolved.spellId);
      }
    });

    // Летающая циферка урона/хила на любое изменение HP любого игрока — источник (прямой удар,
    // DoT-тик, отражение щитом и т.д.) не важен, просто разница в player_sync.
    effect(() => {
      const change = this.socket.lastHpChange();
      const match = this.socket.match();
      if (!change || !match) return;

      const fighter: Fighter | null =
        change.playerId === match.playerId ? 'you' : change.playerId === match.opponentId ? 'foe' : null;
      if (!fighter) return;

      const list = fighter === 'you' ? this.youFloatingNumbers : this.foeFloatingNumbers;
      const entry: FloatingNumber = {
        id: change.id,
        text: (change.amount > 0 ? '+' : '') + change.amount,
        kind: change.amount > 0 ? 'heal' : 'damage',
      };
      list.update((arr) => [...arr, entry]);
      setTimeout(
        () => list.update((arr) => arr.filter((e) => e.id !== entry.id)),
        FLOATING_NUMBER_LIFETIME_MS,
      );
    });
  }

  private hpPercentFor(playerId: string | undefined): number {
    if (!playerId) return 100;
    const hp = this.socket.hpByPlayerId()[playerId];
    if (!hp) return 100;
    return Math.max(0, Math.min(100, (hp.hp / hp.maxHp) * 100));
  }

  private effectsFor(playerId: string | undefined) {
    if (!playerId) return [];
    return this.socket.effectsByPlayerId()[playerId] ?? [];
  }

  castSpellByIndex(index: number): void {
    if (this.socket.activeCast() || !this.socket.matchStarted()) return;
    const spell = this.youSpells()[index];
    if (!spell || this.youCooldowns()[spell.id] !== undefined) return;
    this.socket.castSpell(spell.id);
  }

  /** Компонент существует только пока идёт матч, так что в отличие от прежнего
   *  window-listener'а в App проверка на "матч вообще есть" тут не нужна. */
  @HostListener('window:keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    if (event.key.length !== 1) return;

    if (this.socket.activeCast()) {
      this.socket.sendKey(event.key);
      return;
    }

    const index = Number(event.key) - 1;
    if (Number.isInteger(index)) this.castSpellByIndex(index);
  }

  /** Plays the cast/attack sprite once for the given fighter. Safe to call again mid-animation. */
  triggerAttack(fighter: Fighter): void {
    const attacking = fighter === 'you' ? this.youAttacking : this.foeAttacking;
    attacking.set(false);
    requestAnimationFrame(() => attacking.set(true));
  }

  onAttackAnimationEnd(fighter: Fighter): void {
    (fighter === 'you' ? this.youAttacking : this.foeAttacking).set(false);
  }

  /** Plays the cast VFX sprite once on the given fighter (the spell's target). Safe to call
   *  again mid-animation. */
  triggerVfx(fighter: Fighter, spellId: string): void {
    const vfx = fighter === 'you' ? this.youVfx : this.foeVfx;
    vfx.set(null);
    requestAnimationFrame(() => vfx.set(spellId));
  }

  onVfxAnimationEnd(fighter: Fighter): void {
    (fighter === 'you' ? this.youVfx : this.foeVfx).set(null);
  }

  /** Кнопка на экране результата матча. Компонент размонтируется вместе с этим (match
   *  становится null), так что локальные сигналы (анимации, циферки) не нужно сбрасывать
   *  вручную — следующий матч создаст Match заново с чистого листа. */
  returnToMenu(): void {
    this.socket.resetMatch();
  }
}
