import { Component, inject, signal } from '@angular/core';
import { SocketService } from './socket.service';
import { MageType } from './shared/mage-type';
import { Lobby } from './lobby/lobby';
import { Match } from './match/match';

const TITLE_WORDS = ['KEYBOARD', 'MAGES'];

@Component({
  selector: 'app-root',
  imports: [Lobby, Match],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  protected readonly socket = inject(SocketService);
  protected readonly titleRows = buildTitleRows(TITLE_WORDS);

  /** Школа, выбранная игроком — должна пережить переход Lobby → Match (сервер не возвращает
   *  игроку его же школу, только школу соперника, раздел 7.34 game-design.md), поэтому живёт
   *  в корневом шелле, а не в одном из двух экранов. */
  protected readonly youMageType = signal<MageType>('fire');
}

function buildTitleRows(words: string[]) {
  let index = 0;
  return words.map((word) => ({
    word,
    letters: word.split('').map((char) => ({ char, index: index++ })),
  }));
}
