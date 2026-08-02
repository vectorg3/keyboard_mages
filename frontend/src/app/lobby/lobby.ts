import { Component, computed, inject, input, output, signal } from '@angular/core';
import { SocketService } from '../socket.service';
import { SPELL_BUTTONS_BY_SCHOOL } from '../shared/spells-data';
import { SCHOOL_OPTIONS } from './schools-data';
import { MageType } from '../shared/mage-type';
import { spellIconPath } from '../shared/format';

@Component({
  selector: 'app-lobby',
  imports: [],
  templateUrl: './lobby.html',
  styleUrls: ['../character/character-sprite.css', './lobby.css'],
})
export class Lobby {
  protected readonly socket = inject(SocketService);
  protected readonly schoolOptions = SCHOOL_OPTIONS;
  protected readonly spellIconPath = spellIconPath;

  /** Школа, выбранная игроком — живёт в корневом шелле (должна пережить переход в Match),
   *  сюда приходит только для чтения и предпросмотра. */
  readonly youMageType = input.required<MageType>();
  /** Сообщает шеллу о выборе школы — сам сигнал не здесь, т.к. должен пережить размонтирование
   *  Lobby при переходе в Match. */
  readonly schoolSelected = output<MageType>();

  /** Кнопки заклинаний школы игрока — пусто, если для школы ещё нет данных/иконок. */
  protected readonly youSpells = computed(() => SPELL_BUTTONS_BY_SCHOOL[this.youMageType()] ?? []);

  /** Название школы над спрайтом мага (Fire/Frost/Arcane/Chaos/Nature). */
  protected readonly youMageLabel = computed(
    () => this.schoolOptions.find((s) => s.id === this.youMageType())?.label ?? '',
  );

  /** Заклинание, выбранное в спеллбуке (для показа описания/статов во всплывающем тултипе под
   *  строкой) — чисто локальный предпросмотр, не нужен за пределами Lobby. */
  protected readonly selectedSpellId = signal<string | null>(null);
  protected readonly selectedSpell = computed(
    () => this.youSpells().find((s) => s.id === this.selectedSpellId()) ?? null,
  );

  /** Координаты (viewport-relative, как у getBoundingClientRect) кликнутой строки — тултип
   *  рендерится вне .spellbook-left (у неё overflow-y: auto, и тултип внутри нее раздувал бы
   *  скролл-область при клике на нижние строки), поэтому не может позиционироваться чистым CSS
   *  (top: 100%) относительно строки и получает координаты через JS. */
  protected readonly tooltipAnchor = signal<{ top: number; left: number; width: number } | null>(
    null,
  );

  /** Кнопка поиска боя недоступна без ника — раздел про обязательность ника перед поиском. */
  protected readonly canFindMatch = computed(() => this.socket.nickname().trim().length > 0);

  onNicknameInput(event: Event): void {
    this.socket.setNickname((event.target as HTMLInputElement).value);
  }

  onFindMatch(): void {
    if (!this.canFindMatch()) return;
    this.socket.findMatch(this.youMageType());
  }

  /** Сольная тренировка на боте-манекене — та же готовность (ник введён), что и у обычного
   *  поиска, но без очереди: сервер сразу создаёт матч (см. SocketService.startTraining). */
  onStartTraining(): void {
    if (!this.canFindMatch()) return;
    this.socket.startTraining(this.youMageType());
  }

  onCancelFindMatch(): void {
    this.socket.cancelFindMatch();
  }

  /** Выбор школы в спеллбуке, до постановки в очередь. */
  selectSchool(id: string): void {
    if (this.socket.status() !== 'idle') return;
    this.schoolSelected.emit(id as MageType);
    this.selectedSpellId.set(null);
  }

  /** Выбор заклинания в спеллбуке — только показывает описание (во всплывающем тултипе), не
   *  кастует. Запоминает координаты кликнутой строки, чтобы позиционировать тултип под ней. */
  selectSpellInfo(id: string, event: MouseEvent): void {
    this.selectedSpellId.set(id);
    const row = (event.currentTarget as HTMLElement).getBoundingClientRect();
    this.tooltipAnchor.set({ top: row.bottom + 6, left: row.left, width: row.width });
  }

  /** Закрывает тултип описания заклинания (крестик в углу карточки). */
  closeSpellInfo(): void {
    this.selectedSpellId.set(null);
  }
}
