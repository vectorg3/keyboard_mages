import { Injectable, signal } from '@angular/core';
import { io, Socket } from 'socket.io-client';

const SERVER_URL = 'http://localhost:3000';
const PLAYER_ID_KEY = 'km_player_id';

export type QueueStatus = 'idle' | 'searching' | 'found';

export interface MatchInfo {
  matchId: string;
  playerId: string;
  opponentId: string;
}

/** Активный каст, ожидающий ввода триггера (окно открыто). */
export interface ActiveCastInfo {
  castId: string;
  spellId: string;
  deadline: number; // серверный timestamp, после которого каст сгорает по таймауту
}

export interface SpellResolvedInfo {
  success: boolean;
  spellId: string;
  casterId: string;
  targetId: string;
  damage: number;
  timeTakenMs: number;
  reason?: 'timeout' | 'completed';
}

@Injectable({ providedIn: 'root' })
export class SocketService {
  readonly status = signal<QueueStatus>('idle');
  readonly match = signal<MatchInfo | null>(null);

  /** null пока не идёт отсчёт (матч ещё не найден или уже начался). */
  readonly countdownMs = signal<number | null>(null);
  readonly matchStarted = signal(false);

  readonly activeCast = signal<ActiveCastInfo | null>(null);
  readonly castProgress = signal(0); // 0..1, из input_ack
  /** Причина последнего отказа (on_cooldown, cast_in_progress и т.д.) — временная, для тоста. */
  readonly castRejected = signal<string | null>(null);
  /** Результат последнего разрешённого каста ЛЮБОГО из игроков (не только своего) —
   *  используется, например, чтобы проиграть анимацию атаки на успешный каст. */
  readonly lastResolved = signal<SpellResolvedInfo | null>(null);

  readonly playerId = this.getOrCreatePlayerId();

  private socket: Socket | null = null;
  private pendingSpellId: string | null = null;
  private castRejectedTimeout: ReturnType<typeof setTimeout> | null = null;

  findMatch(school: string): void {
    this.status.set('searching');
    this.getSocket().emit('find_match', { playerId: this.playerId, school });
  }

  /** Запрашивает старт каста. Результат придёт через cast_started/cast_rejected. */
  castSpell(spellId: string): void {
    this.pendingSpellId = spellId;
    this.getSocket().emit('cast_start', { spellId });
  }

  /** Один введённый символ триггера, пока открыто окно ввода (см. activeCast). */
  sendKey(char: string): void {
    this.getSocket().emit('key_input', { char });
  }

  private getSocket(): Socket {
    if (this.socket) return this.socket;

    this.socket = io(SERVER_URL);

    this.socket.on('queue_joined', () => this.status.set('searching'));

    this.socket.on('match_found', (payload: MatchInfo) => {
      this.match.set(payload);
      this.status.set('found');
      this.matchStarted.set(false);
      this.countdownMs.set(null);
    });

    this.socket.on('match_countdown', (payload: { remainingMs: number }) => {
      this.countdownMs.set(payload.remainingMs);
    });

    this.socket.on('match_started', () => {
      this.matchStarted.set(true);
      this.countdownMs.set(null);
    });

    this.socket.on('cast_started', (payload: { castId: string; deadline: number }) => {
      if (!this.pendingSpellId) return; // не наш каст (не должно происходить, но на всякий случай)
      const spellId = this.pendingSpellId;
      this.pendingSpellId = null;
      this.activeCast.set({ castId: payload.castId, spellId, deadline: payload.deadline });
      this.castProgress.set(0);

      // Подстраховка на случай, если игрок бросит печатать: сервер молча чистит cast по
      // таймауту в тикере (DuelService.tick), но клиенту об этом не сообщает — без этого окно
      // ввода зависло бы навсегда. Небольшой запас (50мс), чтобы реальный spell_resolved
      // (если он всё же придёт) успел закрыть окно первым.
      const msUntilDeadline = payload.deadline - Date.now();
      setTimeout(
        () => {
          if (this.activeCast()?.castId === payload.castId) {
            this.activeCast.set(null);
            this.castProgress.set(0);
          }
        },
        Math.max(0, msUntilDeadline) + 50,
      );
    });

    this.socket.on('cast_rejected', (payload: { reason: string }) => {
      this.pendingSpellId = null;
      this.castRejected.set(payload.reason);
      if (this.castRejectedTimeout) clearTimeout(this.castRejectedTimeout);
      this.castRejectedTimeout = setTimeout(() => this.castRejected.set(null), 1500);
    });

    this.socket.on('input_ack', (payload: { correct: boolean; progress: number }) => {
      this.castProgress.set(payload.progress);
    });

    this.socket.on('spell_resolved', (payload: SpellResolvedInfo) => {
      this.lastResolved.set(payload);
      if (payload.casterId !== this.playerId) return;
      this.activeCast.set(null);
      this.castProgress.set(0);
    });

    return this.socket;
  }

  private getOrCreatePlayerId(): string {
    let id = localStorage.getItem(PLAYER_ID_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(PLAYER_ID_KEY, id);
    }
    return id;
  }
}
