import { Injectable } from '@nestjs/common';
import { DuelService } from '../duel/duel.service';
import { MatchState } from '../duel/duel.types';

@Injectable()
export class MatchmakingService {
  private readonly queue: string[] = []; // playerId'ы, ожидающие соперника

  constructor(private readonly duelService: DuelService) {}

  /** Ставит игрока в очередь; если уже есть ожидающий, сразу создаёт матч. */
  enqueue(playerId: string): MatchState | null {
    if (this.queue.includes(playerId)) return null;

    const opponentId = this.queue.shift();
    if (!opponentId) {
      this.queue.push(playerId);
      return null;
    }

    return this.duelService.createMatch(opponentId, playerId);
  }

  dequeue(playerId: string): void {
    const idx = this.queue.indexOf(playerId);
    if (idx !== -1) this.queue.splice(idx, 1);
  }
}
