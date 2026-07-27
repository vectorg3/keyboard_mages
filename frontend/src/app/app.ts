import { Component, inject } from '@angular/core';
import { SocketService } from './socket.service';

const TITLE_WORDS = ['KEYBOARD', 'MAGES'];

@Component({
  selector: 'app-root',
  imports: [],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  protected readonly socket = inject(SocketService);
  protected readonly titleRows = buildTitleRows(TITLE_WORDS);

  onFindMatch(): void {
    this.socket.findMatch();
  }
}

function buildTitleRows(words: string[]) {
  let index = 0;
  return words.map((word) => ({
    word,
    letters: word.split('').map((char) => ({ char, index: index++ })),
  }));
}
