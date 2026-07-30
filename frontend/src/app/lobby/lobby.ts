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

  /** Заклинание, выбранное в спеллбуке (для показа описания/статов) — чисто локальный
   *  предпросмотр, не нужен за пределами Lobby. */
  protected readonly selectedSpellId = signal<string | null>(null);
  protected readonly selectedSpell = computed(
    () => this.youSpells().find((s) => s.id === this.selectedSpellId()) ?? null,
  );

  onFindMatch(): void {
    this.socket.findMatch(this.youMageType());
  }

  /** Выбор школы в спеллбуке, до постановки в очередь. */
  selectSchool(id: string): void {
    if (this.socket.status() !== 'idle') return;
    this.schoolSelected.emit(id as MageType);
    this.selectedSpellId.set(null);
  }

  /** Выбор заклинания в спеллбуке — только показывает описание, не кастует. */
  selectSpellInfo(id: string): void {
    this.selectedSpellId.set(id);
  }
}
