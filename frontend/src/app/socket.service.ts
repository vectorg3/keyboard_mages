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

@Injectable({ providedIn: 'root' })
export class SocketService {
  readonly status = signal<QueueStatus>('idle');
  readonly match = signal<MatchInfo | null>(null);

  readonly playerId = this.getOrCreatePlayerId();

  private socket: Socket | null = null;

  findMatch(): void {
    this.status.set('searching');
    this.getSocket().emit('find_match', { playerId: this.playerId });
  }

  private getSocket(): Socket {
    if (this.socket) return this.socket;

    this.socket = io(SERVER_URL);

    this.socket.on('queue_joined', () => this.status.set('searching'));

    this.socket.on('match_found', (payload: MatchInfo) => {
      this.match.set(payload);
      this.status.set('found');
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
