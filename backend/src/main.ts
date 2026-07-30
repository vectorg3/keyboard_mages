import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // WebSocket-гейтвеи (duel/matchmaking) уже разрешают cors: { origin: '*' } отдельно —
  // это же для обычных HTTP-запросов (health-check и т.п.).
  app.enableCors({ origin: '*' });
  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
