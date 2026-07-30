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
import { DuelService, MAX_HP } from './duel.service';
import { MatchState } from './duel.types';

const TICK_INTERVAL_MS = 300; // раздел 6.4: heartbeat раз в 250-500мс на матч
// Задержка перед удалением завершённого матча из памяти — запас на случай, если клиент ещё
// не успел обработать/забрать match_ended (не про реконнект: грейс-периода на него нет).
const MATCH_CLEANUP_DELAY_MS = 10_000;

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
      // Технический проигрыш (раздел 7 game-design.md) — сам match_ended уйдёт клиентам на
      // ближайшем тике heartbeat (см. ensureHeartbeat), который уже проверяет finishedAt.
      // Никакого грейс-периода на реконнект пока нет — это осознанно оставлено вне раздела 7.
      this.duelService.forfeitMatch(meta.matchId, meta.playerId);
    }
  }

  // Ручной путь на случай реконнекта в бою (см. заметку в handleDisconnect) — при обычном
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
      // Длительность окна — считаем на сервере (startedAt/deadline тут в одних и тех же
      // часах), а не на клиенте как deadline - Date.now(): часы браузера и сервера не
      // синхронизированы, и на деплое (не на localhost) это давало заметно укороченное окно.
      windowMs: result.cast.deadline - result.cast.startedAt,
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

      // Проверяем ДО ветки предматчевого countdown ниже: иначе дисконнект/форфейт в первые
      // 3 секунды после match_found завис бы в вечном match_countdown и никогда не дошёл бы
      // до финального emit'а — countdown-ветка сама тикать останавливается через return.
      if (this.announceIfFinished(matchId, match)) return;

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
        const player = match.players[playerId];
        const cooldowns: Record<string, number> = {};
        for (const [spellId, readyAt] of Object.entries(player.cooldowns)) {
          // Карта кулдаунов копится за весь матч и не чистится — шлём только то, что
          // реально ещё не готово, иначе клиент годами хранил бы нулевые записи.
          if (readyAt > now) cooldowns[spellId] = readyAt - now;
        }

        this.server.to(matchId).emit('player_sync', {
          playerId,
          hp: player.hp,
          maxHp: MAX_HP,
          cooldowns,
          effects: match.effects
            .filter((e) => e.targetPlayerId === playerId)
            .map((e) => ({
              id: e.id, // стабильный ключ для клиента: sourceSpellId может повторяться,
              // если один и тот же баф/дебаф активен в двух экземплярах (см. раздел 7.25)
              type: e.effectType,
              sourceSpellId: e.sourceSpellId,
              remainingMs: Math.max(0, e.appliedAt + e.durationMs - Date.now()),
              magnitude: e.magnitude,
            })),
        });
      }

      // Ловит смерть, случившуюся ВНУТРИ только что вызванного tick() (например, DoT-тик) —
      // без этой проверки пришлось бы ждать ещё один heartbeat-цикл (до TICK_INTERVAL_MS)
      // до объявления результата.
      this.announceIfFinished(matchId, match);
    }, TICK_INTERVAL_MS);

    this.heartbeats.set(matchId, handle);
  }

  /** Если матч завершён — шлёт match_ended и останавливает heartbeat. Возвращает true, если
   *  завершён (чтобы вызывающий код мог сразу return'уться из тика). */
  private announceIfFinished(matchId: string, match: MatchState): boolean {
    if (!match.finishedAt) return false;
    this.server.to(matchId).emit('match_ended', { winnerId: match.winnerId });
    this.stopHeartbeat(matchId);
    setTimeout(() => this.duelService.removeMatch(matchId), MATCH_CLEANUP_DELAY_MS);
    return true;
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
