import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { SpellSchool } from '../spells/spell.types';

export interface BotIdentity {
  playerId: string;
  school: SpellSchool;
  nickname: string;
}

const SCHOOLS = Object.values(SpellSchool);

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/** Личность бота, которым MatchmakingGateway подменяет соперника игроку, застрявшему в очереди
 *  (см. BOT_MATCH_WAIT_MS) — случайная школа, ник вида "FireBot"/"IceBot"/... (SpellSchool уже
 *  хранит английские id, остаётся только капитализировать и приписать "Bot"). */
@Injectable()
export class BotService {
  create(): BotIdentity {
    const school = SCHOOLS[Math.floor(Math.random() * SCHOOLS.length)];
    return {
      playerId: `bot-${randomUUID()}`,
      school,
      nickname: `${capitalize(school)}Bot`,
    };
  }
}
