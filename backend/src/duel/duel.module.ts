import { Module } from '@nestjs/common';
import { EffectsModule } from '../effects/effects.module';
import { SpellsModule } from '../spells/spells.module';
import { DuelService } from './duel.service';
import { DuelGateway } from './duel.gateway';

@Module({
  imports: [SpellsModule, EffectsModule],
  providers: [DuelService, DuelGateway],
  exports: [DuelService],
})
export class DuelModule {}
