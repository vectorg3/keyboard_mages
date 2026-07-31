import { Injectable } from '@nestjs/common';
import { DuelService } from '../duel/duel.service';
import { MatchState } from '../duel/duel.types';
import { SpellSchool } from '../spells/spell.types';

interface QueueEntry {
  playerId: string;
  school: SpellSchool;
  nickname: string;
}

@Injectable()
export class MatchmakingService {
  private readonly queue: QueueEntry[] = []; // ожидающие соперника, со школой выбранного мага

  constructor(private readonly duelService: DuelService) {}

  /** Ставит игрока в очередь; если уже есть ожидающий, сразу создаёт матч. */
  enqueue(playerId: string, school: SpellSchool, nickname: string): MatchState | null {
    if (this.queue.some((e) => e.playerId === playerId)) return null;

    const opponent = this.queue.shift();
    if (!opponent) {
      this.queue.push({ playerId, school, nickname });
      return null;
    }

    return this.duelService.createMatch(
      opponent.playerId,
      opponent.school,
      opponent.nickname,
      playerId,
      school,
      nickname,
    );
  }

  dequeue(playerId: string): void {
    const idx = this.queue.findIndex((e) => e.playerId === playerId);
    if (idx !== -1) this.queue.splice(idx, 1);
  }
}
