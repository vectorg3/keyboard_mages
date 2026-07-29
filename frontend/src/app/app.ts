import { Component, HostListener, computed, effect, inject, signal } from '@angular/core';
import { SocketService, SpellResolvedInfo } from './socket.service';
import { SPELL_BUTTONS_BY_SCHOOL } from './spells-data';
import { SCHOOL_OPTIONS } from './schools-data';

const TITLE_WORDS = ['KEYBOARD', 'MAGES'];

export type Fighter = 'you' | 'foe';

/** A player's chosen school of magic — decides which sprite sheet set is drawn for them and,
 *  for 'you', which spell-button row is shown. Values match backend SpellSchool exactly. */
export type MageType = 'fire' | 'ice' | 'chaos' | 'arcane' | 'nature';

export const MAGE_TYPES: MageType[] = ['fire', 'ice', 'chaos', 'arcane', 'nature'];

@Component({
  selector: 'app-root',
  imports: [],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  protected readonly socket = inject(SocketService);
  protected readonly titleRows = buildTitleRows(TITLE_WORDS);
  protected readonly mageTypes = MAGE_TYPES;
  protected readonly schoolOptions = SCHOOL_OPTIONS;

  /** Школа, выбранная игроком на главном экране — определяет и спрайт "вас", и панель
   *  заклинаний, и то, что реально уходит в find_match. */
  protected readonly youMageType = signal<MageType>('fire');
  // TODO: сервер не сообщает клиентам реальную школу соперника — это по-прежнему
  // локальная заглушка для превью спрайта, не связанная с матчем.
  protected readonly foeMageType = signal<MageType>('ice');

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

  constructor() {
    // Проигрываем анимацию атаки на любой успешный каст — единственный доступный "эффект
    // применения заклинания" сейчас, независимо от типа заклинания (Attack/Defense/Support).
    effect(() => {
      const resolved = this.socket.lastResolved();
      if (!resolved?.success) return;
      this.triggerAttack(resolved.casterId === this.socket.playerId ? 'you' : 'foe');
    });
  }

  onFindMatch(): void {
    this.socket.findMatch(this.youMageType());
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

  setMageType(fighter: Fighter, type: MageType): void {
    (fighter === 'you' ? this.youMageType : this.foeMageType).set(type);
  }

  castSpellByIndex(index: number): void {
    if (this.socket.activeCast() || !this.socket.matchStarted()) return;
    const spell = this.youSpells()[index];
    if (spell) this.socket.castSpell(spell.id);
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
