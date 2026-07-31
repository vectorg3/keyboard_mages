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
}

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
    const match = this.matchmakingService.enqueue(
      payload.playerId,
      payload.school,
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
