# Keyboard Mages

Браузерная PvP-игра: два игрока сражаются в дуэли 1v1, применяя заклинания через быстрый и точный
ввод слов-триггеров на клавиатуре.

Полное игровое и архитектурное описание — в [`game-design.md`](./game-design.md).

## Стек

- **Backend:** NestJS + Socket.IO, состояние боя — в памяти сервера (`backend/`)
- **Frontend:** Angular (пока не начат)
- **Боевая сцена:** PixiJS + GSAP (пока не начата)

## Структура репозитория

```
keyboard-mage/
├── game-design.md   # игровой дизайн, протокол, открытые вопросы
├── backend/         # NestJS-сервер (matchmaking, дуэли, заклинания, эффекты)
└── frontend/        # (пока не создан)
```

## Backend

```bash
cd backend
npm install
npm run start:dev   # http://localhost:3000, WebSocket на том же порту
```

Модули: `SpellsModule`, `EffectsModule`, `DuelModule` (включает `DuelGateway`), `MatchmakingModule`.
Подробности протокола WebSocket-событий — в разделе 3 `game-design.md`.

## Статус

Backend: базовый скаффолдинг всех модулей готов (реестр заклинаний, тикер эффектов, боевая логика,
матчмейкинг). Открытые вопросы дизайна и нерешённые механики — раздел 7 `game-design.md`.

Frontend: не начат.
