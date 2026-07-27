import { Module } from '@nestjs/common';
import { EffectsService } from './effects.service';

@Module({
  providers: [EffectsService],
  exports: [EffectsService],
})
export class EffectsModule {}
