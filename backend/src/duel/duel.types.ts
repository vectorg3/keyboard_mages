import { ActiveEffect } from '../effects/effect.types';
import { SpellSchool } from '../spells/spell.types';

export interface ActiveCast {
  castId: string;
  spellId: string;
  trigger: string;
  startedAt: number;
  deadline: number; // startedAt + эффективное окно ввода
  typedCount: number; // сколько символов триггера верно введено подряд
}

export interface PlayerState {
  playerId: string;
  nickname: string;
  school: SpellSchool; // школа мага, выбранная перед поиском матча (см. раздел 7 game-design.md)
  hp: number;
  cooldowns: Record<string, number>; // spellId -> timestamp, когда снова доступен
  activeCast: ActiveCast | null;
  lastTrigger: string | null;
  silencedSpellId: string | null; // слот, заблокированный эффектом Silence
  /** Виртуальный игрок без реального сокета (см. BotService/MatchmakingGateway) — вместо
   *  реального ввода за него кастует DuelService.driveBot() по кулдауну своим единственным
   *  заклинанием. */
  isBot: boolean;
}

/** 'training' — сольный матч с ботом-манекеном (см. BotService/MatchmakingService.
 *  createTrainingMatch): бот не кастует (DuelService.driveBot выходит сразу), а окно ввода
 *  триггера не ограничено по времени (см. TRAINING_CAST_WINDOW_MS в DuelService.startCast). */
export type MatchMode = 'standard' | 'training';

export interface MatchState {
  matchId: string;
  mode: MatchMode;
  players: Record<string, PlayerState>;
  playerIds: [string, string];
  effects: ActiveEffect[];
  createdAt: number;
  startsAt: number; // момент, когда матч официально начинается и разрешены касты (createdAt + пауза)
  finishedAt: number | null;
  winnerId: string | null;
}

export interface KeyInputResult {
  correct: boolean;
  progress: number; // 0..1
  resolved: CastResolution | null;
}

export interface CastResolution {
  success: boolean;
  spellId: string;
  casterId: string;
  targetId: string;
  damage: number;
  timeTakenMs: number;
  reason?: 'timeout' | 'completed';
}
