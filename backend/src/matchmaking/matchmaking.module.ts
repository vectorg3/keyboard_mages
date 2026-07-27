import { Module } from '@nestjs/common';
import { DuelModule } from '../duel/duel.module';
import { MatchmakingService } from './matchmaking.service';
import { MatchmakingGateway } from './matchmaking.gateway';

@Module({
  imports: [DuelModule],
  providers: [MatchmakingService, MatchmakingGateway],
})
export class MatchmakingModule {}
