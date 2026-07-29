import { Logger } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { DuelService } from './duel.service';

const TICK_INTERVAL_MS = 300; // раздел 6.4: heartbeat раз в 250-500мс на матч

interface JoinPayload {
  matchId: string;
  playerId: string;
}

interface CastStartPayload {
  spellId: string;
}

interface KeyInputPayload {
  char: string;
}

@WebSocketGateway({ cors: { origin: '*' } })
export class DuelGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(DuelGateway.name);
  private readonly socketMeta = new Map<
    string,
    { matchId: string; playerId: string }
  >();
  private readonly heartbeats = new Map<string, NodeJS.Timeout>();
  private readonly startedMatches = new Set<string>(); // matchId'ы, для которых уже отправлен match_started

  constructor(private readonly duelService: DuelService) {}

  handleConnection(client: Socket): void {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket): void {
    const meta = this.socketMeta.get(client.id);
    this.socketMeta.delete(client.id);
    if (meta) {
      this.logger.log(
        `Player ${meta.playerId} disconnected from match ${meta.matchId}`,
      );
      // TODO: реакция на дисконнект в бою (тех. поражение / грейс-период на реконнект)
      // не зафиксирована в game-design.md — открытый вопрос вне раздела 7.
    }
  }

  // Ручной путь на случай реконнекта в бою (см. TODO в handleDisconnect) — при обычном
  // старте матча используется attachPlayer() напрямую из MatchmakingGateway.
  @SubscribeMessage('join')
  handleJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: JoinPayload,
  ): void {
    const attached = this.attachPlayer(
      payload.matchId,
      payload.playerId,
      client,
    );
    if (!attached) {
      client.emit('join_error', { reason: 'match_not_found' });
    }
  }

  /** Привязывает сокет к матчу: комната + heartbeat. Возвращает false, если матч/игрок неизвестны. */
  attachPlayer(matchId: string, playerId: string, client: Socket): boolean {
    const match = this.duelService.getMatch(matchId);
    if (!match || !match.players[playerId]) {
      return false;
    }
    this.socketMeta.set(client.id, { matchId, playerId });
    void client.join(matchId);
    this.ensureHeartbeat(matchId);
    return true;
  }

  @SubscribeMessage('cast_start')
  handleCastStart(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: CastStartPayload,
  ): void {
    const meta = this.socketMeta.get(client.id);
    if (!meta) return;

    const result = this.duelService.startCast(
      meta.matchId,
      meta.playerId,
      payload.spellId,
    );
    if (!result.ok) {
      client.emit('cast_rejected', { reason: result.reason });
      return;
    }
    client.emit('cast_started', {
      castId: result.cast.castId,
      deadline: result.cast.deadline,
    });
  }

  @SubscribeMessage('key_input')
  handleKeyInput(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: KeyInputPayload,
  ): void {
    const meta = this.socketMeta.get(client.id);
    if (!meta) return;

    // Принципиально: используем момент получения сообщения сервером, не клиентский timestamp (раздел 3).
    const now = Date.now();
    const result = this.duelService.handleKeyInput(
      meta.matchId,
      meta.playerId,
      payload.char,
      now,
    );

    client.emit('input_ack', {
      correct: result.correct,
      progress: result.progress,
    });

    if (result.resolved) {
      this.server.to(meta.matchId).emit('spell_resolved', result.resolved);
    }
  }

  private ensureHeartbeat(matchId: string): void {
    if (this.heartbeats.has(matchId)) return;

    const handle = setInterval(() => {
      const match = this.duelService.getMatch(matchId);
      if (!match) {
        this.stopHeartbeat(matchId);
        return;
      }

      const now = Date.now();

      if (now < match.startsAt) {
        this.server.to(matchId).emit('match_countdown', {
          remainingMs: match.startsAt - now,
        });
        return; // до старта матча нет ни кастов, ни эффектов — тикать нечего
      }

      if (!this.startedMatches.has(matchId)) {
        this.startedMatches.add(matchId);
        this.server.to(matchId).emit('match_started', { startedAt: match.startsAt });
      }

      this.duelService.tick(matchId, now);

      for (const playerId of match.playerIds) {
        this.server.to(matchId).emit('effects_sync', {
          playerId,
          effects: match.effects
            .filter((e) => e.targetPlayerId === playerId)
            .map((e) => ({
              type: e.effectType,
              sourceSpellId: e.sourceSpellId,
              remainingMs: Math.max(0, e.appliedAt + e.durationMs - Date.now()),
              magnitude: e.magnitude,
            })),
        });
      }

      if (match.finishedAt) {
        this.server
          .to(matchId)
          .emit('match_ended', { winnerId: match.winnerId });
        this.stopHeartbeat(matchId);
      }
    }, TICK_INTERVAL_MS);

    this.heartbeats.set(matchId, handle);
  }

  private stopHeartbeat(matchId: string): void {
    const handle = this.heartbeats.get(matchId);
    if (handle) {
      clearInterval(handle);
      this.heartbeats.delete(matchId);
    }
    this.startedMatches.delete(matchId);
  }
}
