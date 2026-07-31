import { Module } from '@nestjs/common';
import { DuelModule } from '../duel/duel.module';
import { MatchmakingService } from './matchmaking.service';
import { MatchmakingGateway } from './matchmaking.gateway';
import { BotService } from './bot.service';

@Module({
  imports: [DuelModule],
  providers: [MatchmakingService, MatchmakingGateway, BotService],
})
export class MatchmakingModule {}
