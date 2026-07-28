import { ActiveEffect } from '../effects/effect.types';

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
  hp: number;
  cooldowns: Record<string, number>; // spellId -> timestamp, когда снова доступен
  activeCast: ActiveCast | null;
  silencedSpellId: string | null; // слот, заблокированный эффектом Silence
}

export interface MatchState {
  matchId: string;
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
