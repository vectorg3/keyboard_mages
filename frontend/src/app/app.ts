import { Component, inject, signal } from '@angular/core';
import { SocketService } from './socket.service';
import { MageType } from './shared/mage-type';
import { ClickSoundService } from './shared/click-sound.service';
import { keySpritePath, preloadKeySprites } from './shared/format';
import { Lobby } from './lobby/lobby';
import { Match } from './match/match';

// Прогрев кэша на модульном уровне (не в constructor) — запускается один раз в момент импорта
// этого файла, до первого рендера App, а не после его создания.
preloadKeySprites();

const TITLE_WORDS = ['KEYBOARD', 'MAGES'];

@Component({
  selector: 'app-root',
  imports: [Lobby, Match],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  protected readonly socket = inject(SocketService);
  private readonly clickSound = inject(ClickSoundService);
  protected readonly titleRows = buildTitleRows(TITLE_WORDS);
  protected readonly keySpritePath = keySpritePath;

  /** Школа, выбранная игроком — должна пережить переход Lobby → Match (сервер не возвращает
   *  игроку его же школу, только школу соперника, раздел 7.34 game-design.md), поэтому живёт
   *  в корневом шелле, а не в одном из двух экранов. */
  protected readonly youMageType = signal<MageType>('fire');

  /** Один делегированный обработчик на весь app вместо (click) на каждой из кнопок школ/
   *  заклинаний/каста/меню — играет звук клика для любой кнопки, всплывающей до .stage. */
  protected onStageClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).closest('button')) {
      this.clickSound.play();
    }
  }
}

function buildTitleRows(words: string[]) {
  let index = 0;
  return words.map((word) => ({
    word,
    letters: word.split('').map((char) => ({ char, index: index++ })),
  }));
}
