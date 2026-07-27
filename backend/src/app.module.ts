import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { SpellsModule } from './spells/spells.module';
import { EffectsModule } from './effects/effects.module';
import { DuelModule } from './duel/duel.module';
import { MatchmakingModule } from './matchmaking/matchmaking.module';

@Module({
  imports: [SpellsModule, EffectsModule, DuelModule, MatchmakingModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
