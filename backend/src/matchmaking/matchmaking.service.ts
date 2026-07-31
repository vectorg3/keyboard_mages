import { Injectable } from '@nestjs/common';
import { DuelService } from '../duel/duel.service';
import { MatchState } from '../duel/duel.types';
import { SpellSchool } from '../spells/spell.types';
import { BotIdentity } from './bot.service';

export interface QueueEntry {
  playerId: string;
  school: SpellSchool;
  nickname: string;
  queuedAt: number;
}

@Injectable()
export class MatchmakingService {
  private readonly queue: QueueEntry[] = []; // ожидающие соперника, со школой выбранного мага

  constructor(private readonly duelService: DuelService) {}

  /** Ставит игрока в очередь; если уже есть ожидающий, сразу создаёт матч. */
  enqueue(
    playerId: string,
    school: SpellSchool,
    nickname: string,
    now = Date.now(),
  ): MatchState | null {
    if (this.queue.some((e) => e.playerId === playerId)) return null;

    const opponent = this.queue.shift();
    if (!opponent) {
      this.queue.push({ playerId, school, nickname, queuedAt: now });
      return null;
    }

    return this.duelService.createMatch(
      { playerId: opponent.playerId, school: opponent.school, nickname: opponent.nickname },
      { playerId, school, nickname },
    );
  }

  dequeue(playerId: string): void {
    const idx = this.queue.findIndex((e) => e.playerId === playerId);
    if (idx !== -1) this.queue.splice(idx, 1);
  }

  /** Забирает (и убирает из очереди) всех, кто ждёт дольше maxWaitMs — MatchmakingGateway сводит
   *  их с ботом вместо живого соперника. Мутирует queue на месте (splice), а не переприсваивает
   *  массив — тот объявлен readonly. */
  takeStaleEntries(maxWaitMs: number, now = Date.now()): QueueEntry[] {
    const stale: QueueEntry[] = [];
    for (let i = this.queue.length - 1; i >= 0; i--) {
      if (now - this.queue[i].queuedAt >= maxWaitMs) {
        stale.push(...this.queue.splice(i, 1));
      }
    }
    return stale;
  }

  createBotMatch(entry: QueueEntry, bot: BotIdentity): MatchState {
    return this.duelService.createMatch(
      { playerId: entry.playerId, school: entry.school, nickname: entry.nickname },
      { playerId: bot.playerId, school: bot.school, nickname: bot.nickname, isBot: true },
    );
  }
}
