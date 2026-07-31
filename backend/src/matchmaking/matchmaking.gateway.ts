import {
  ConnectedSocket,
  MessageBody,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { DuelGateway } from '../duel/duel.gateway';
import { SpellSchool } from '../spells/spell.types';
import { MatchmakingService } from './matchmaking.service';

interface FindMatchPayload {
  playerId: string;
  school: SpellSchool;
  nickname: string;
}

const MAX_NICKNAME_LENGTH = 9;

@WebSocketGateway({ cors: { origin: '*' } })
export class MatchmakingGateway implements OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly waitingSockets = new Map<string, Socket>(); // playerId -> сокет, пока он в очереди

  constructor(
    private readonly matchmakingService: MatchmakingService,
    private readonly duelGateway: DuelGateway,
  ) {}

  @SubscribeMessage('find_match')
  handleFindMatch(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: FindMatchPayload,
  ): void {
    // Ник обязателен на клиенте (кнопка поиска заблокирована без него), но клиенту нельзя
    // доверять — подчищаем на границе на случай, если запрос пришёл в обход UI.
    const nickname = (payload.nickname ?? '').trim().slice(0, MAX_NICKNAME_LENGTH);
    if (!nickname) return;

    const match = this.matchmakingService.enqueue(
      payload.playerId,
      payload.school,
      nickname,
    );
    if (!match) {
      this.waitingSockets.set(payload.playerId, client);
      client.emit('queue_joined');
      return;
    }

    for (const playerId of match.playerIds) {
      const opponentId = match.playerIds.find((id) => id !== playerId)!;
      const socket =
        playerId === payload.playerId
          ? client
          : this.waitingSockets.get(playerId);
      this.waitingSockets.delete(playerId);
      if (!socket) continue;

      // Сразу привязываем сокет к боевой комнате — клиенту не нужно отдельно эмитить 'join'.
      this.duelGateway.attachPlayer(match.matchId, playerId, socket);
      socket.emit('match_found', {
        matchId: match.matchId,
        playerId,
        opponentId,
        opponentSchool: match.players[opponentId].school,
        opponentNickname: match.players[opponentId].nickname,
      });
    }
  }

  @SubscribeMessage('cancel_match')
  handleCancelMatch(@MessageBody() payload: { playerId: string }): void {
    this.matchmakingService.dequeue(payload.playerId);
    this.waitingSockets.delete(payload.playerId);
  }

  handleDisconnect(client: Socket): void {
    for (const [playerId, socket] of this.waitingSockets) {
      if (socket.id === client.id) {
        this.matchmakingService.dequeue(playerId);
        this.waitingSockets.delete(playerId);
        break;
      }
    }
  }
}
