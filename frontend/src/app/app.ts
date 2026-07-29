import { Component, HostListener, computed, effect, inject, signal } from '@angular/core';
import { SocketService, SpellResolvedInfo } from './socket.service';
import { SPELL_BUTTONS_BY_SCHOOL, SPELL_BY_ID } from './spells-data';
import { SCHOOL_OPTIONS } from './schools-data';

const TITLE_WORDS = ['KEYBOARD', 'MAGES'];

export type Fighter = 'you' | 'foe';

/** A player's chosen school of magic — decides which sprite sheet set is drawn for them and,
 *  for 'you', which spell-button row is shown. Values match backend SpellSchool exactly. */
export type MageType = 'fire' | 'ice' | 'chaos' | 'arcane' | 'nature';

interface FloatingNumber {
  id: string;
  text: string;
  kind: 'damage' | 'heal';
}

// Должно совпадать с длительностью CSS-анимации .floating-number (app.css), иначе циферка
// либо пропадёт из DOM до конца анимации, либо повиснет статично после её завершения.
const FLOATING_NUMBER_LIFETIME_MS = 1000;

@Component({
  selector: 'app-root',
  imports: [],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  protected readonly socket = inject(SocketService);
  protected readonly titleRows = buildTitleRows(TITLE_WORDS);
  protected readonly schoolOptions = SCHOOL_OPTIONS;

  /** Школа, выбранная игроком на главном экране — определяет и спрайт "вас", и панель
   *  заклинаний, и то, что реально уходит в find_match. */
  protected readonly youMageType = signal<MageType>('fire');
  /** Школа соперника — из match_found (реальный выбор соперника), не локальная заглушка. */
  protected readonly foeMageType = computed<MageType>(
    () => (this.socket.match()?.opponentSchool as MageType | undefined) ?? 'fire',
  );

  protected readonly youAttacking = signal(false);
  protected readonly foeAttacking = signal(false);

  protected readonly countdownSeconds = computed(() => {
    const ms = this.socket.countdownMs();
    return ms === null ? null : Math.max(1, Math.ceil(ms / 1000));
  });

  /** Кнопки заклинаний школы игрока — пусто, если для школы ещё нет данных/иконок. */
  protected readonly youSpells = computed(() => SPELL_BUTTONS_BY_SCHOOL[this.youMageType()] ?? []);

  /** Заклинание, выбранное в спеллбуке на главном экране (для показа описания/статов). */
  protected readonly selectedSpellId = signal<string | null>(null);
  protected readonly selectedSpell = computed(
    () => this.youSpells().find((s) => s.id === this.selectedSpellId()) ?? null,
  );

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

  constructor() {
    // Проигрываем анимацию атаки на любой успешный каст — единственный доступный "эффект
    // применения заклинания" сейчас, независимо от типа заклинания (Attack/Defense/Support).
    effect(() => {
      const resolved = this.socket.lastResolved();
      if (!resolved?.success) return;
      this.triggerAttack(resolved.casterId === this.socket.playerId ? 'you' : 'foe');
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

  /** Секунды с одним знаком после запятой, для таймера поверх заблюренной кнопки заклинания
   *  и для таймера на иконке активного эффекта. */
  formatCooldown(remainingMs: number): string {
    return (remainingMs / 1000).toFixed(1);
  }

  /** Название заклинания-источника эффекта — для title-подсказки на иконке. */
  effectSpellName(sourceSpellId: string): string {
    return SPELL_BY_ID[sourceSpellId]?.name ?? sourceSpellId;
  }

  onFindMatch(): void {
    this.socket.findMatch(this.youMageType());
  }

  /** Кнопка на экране результата матча — сбрасывает и серверные, и локальные визуальные
   *  остатки боя (анимации, циферки), возвращая на главный экран (спеллбук). */
  returnToMenu(): void {
    this.socket.resetMatch();
    this.youAttacking.set(false);
    this.foeAttacking.set(false);
    this.youFloatingNumbers.set([]);
    this.foeFloatingNumbers.set([]);
    this.selectedSpellId.set(null);
  }

  /** Выбор школы в спеллбуке на главном экране, до постановки в очередь. */
  selectSchool(id: string): void {
    if (this.socket.status() !== 'idle') return;
    this.youMageType.set(id as MageType);
    this.selectedSpellId.set(null);
  }

  /** Выбор заклинания в спеллбуке — только показывает описание, не кастует. */
  selectSpellInfo(id: string): void {
    this.selectedSpellId.set(id);
  }

  castSpellByIndex(index: number): void {
    if (this.socket.activeCast() || !this.socket.matchStarted()) return;
    const spell = this.youSpells()[index];
    if (!spell || this.youCooldowns()[spell.id] !== undefined) return;
    this.socket.castSpell(spell.id);
  }

  @HostListener('window:keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    if (!this.socket.match() || event.key.length !== 1) return;

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
}

function buildTitleRows(words: string[]) {
  let index = 0;
  return words.map((word) => ({
    word,
    letters: word.split('').map((char) => ({ char, index: index++ })),
  }));
}
