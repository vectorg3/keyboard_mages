import {
  ConnectedSocket,
  MessageBody,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { MatchmakingService } from './matchmaking.service';

interface FindMatchPayload {
  playerId: string;
}

@WebSocketGateway({ cors: { origin: '*' } })
export class MatchmakingGateway implements OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly waitingSockets = new Map<string, Socket>(); // playerId -> сокет, пока он в очереди

  constructor(private readonly matchmakingService: MatchmakingService) {}

  @SubscribeMessage('find_match')
  handleFindMatch(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: FindMatchPayload,
  ): void {
    const match = this.matchmakingService.enqueue(payload.playerId);
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
      socket?.emit('match_found', {
        matchId: match.matchId,
        playerId,
        opponentId,
      });
    }
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
