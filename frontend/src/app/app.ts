import { Component, inject, signal } from '@angular/core';
import { SocketService } from './socket.service';

const TITLE_WORDS = ['KEYBOARD', 'MAGES'];

export type Fighter = 'you' | 'foe';

/** A player's chosen school of magic — decides which sprite sheet set is drawn for them. */
export type MageType = 'fire' | 'frost' | 'chaos';

export const MAGE_TYPES: MageType[] = ['fire', 'frost', 'chaos'];

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

  // TODO: replace these defaults with the mage type each player actually picked
  // before queueing, once matchmaking sends that choice down for both fighters.
  protected readonly youMageType = signal<MageType>('fire');
  protected readonly foeMageType = signal<MageType>('frost');

  protected readonly youAttacking = signal(false);
  protected readonly foeAttacking = signal(false);

  onFindMatch(): void {
    this.socket.findMatch();
  }

  setMageType(fighter: Fighter, type: MageType): void {
    (fighter === 'you' ? this.youMageType : this.foeMageType).set(type);
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
