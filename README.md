# Keyboard Mages

Браузерная PvP-игра: два игрока сражаются в дуэли 1v1, применяя заклинания через быстрый и точный
ввод слов-триггеров на клавиатуре.

Полное игровое и архитектурное описание — в [`game-design.md`](./game-design.md).

## Стек

- **Backend:** NestJS + Socket.IO, состояние боя — в памяти сервера (`backend/`)
- **Frontend:** Angular, standalone-компоненты, signals (`frontend/`)
- **Боевая сцена:** чистый CSS (спрайт-анимации через `background-position` + `steps()`), без Pixi/GSAP

## Структура репозитория

```
keyboard-mage/
├── game-design.md   # игровой дизайн, протокол, открытые вопросы
├── backend/         # NestJS-сервер (matchmaking, дуэли, заклинания, эффекты)
└── frontend/        # Angular-клиент (лобби, поиск матча, каркас боя)
```

## Backend

```bash
cd backend
npm install
npm run start:dev   # http://localhost:3000, WebSocket на том же порту
```

Модули: `SpellsModule`, `EffectsModule`, `DuelModule` (включает `DuelGateway`), `MatchmakingModule`.
Подробности протокола WebSocket-событий — в разделе 3 `game-design.md`.

## Frontend

```bash
cd frontend
npm install
npm start   # http://localhost:4200
```

Реализованы: лобби с поиском матча через `MatchmakingGateway` (`find_match` →
`queue_joined`/`match_found`) и боевая сцена с двумя анимированными бойцами по краям арены,
HP-баром над каждым и idle/attack-анимациями на спрайт-листах (`frontend/public/<mage-type>/`).
Тип мага у каждого бойца независим от стороны («вы»/«соперник») — сейчас доступны `fire`,
`frost`, `chaos` (`App.youMageType`/`foeMageType` в `frontend/src/app/app.ts`). Оформление —
светлая 8-bit-тема, шрифты Press Start 2P (заголовок/акценты) и JetBrains Mono (кириллица,
UI-текст). Подключение к WebSocket — `SocketService` (`frontend/src/app/socket.service.ts`),
адрес backend захардкожен на `http://localhost:3000`.

На сцене пока есть временная (помечена `TEMP` в `app.html`) debug-панель — кнопки ручного вызова
атаки и переключения типа мага, для проверки анимаций без реальных событий боя.

## Статус

Backend: базовый скаффолдинг всех модулей готов (реестр заклинаний, тикер эффектов, боевая логика,
матчмейкинг). Открытые вопросы дизайна и нерешённые механики — раздел 7 `game-design.md`.

Frontend: лобби, поиск матча и визуальная боевая сцена (спрайты, HP-бар, анимации) готовы.
Не хватает: выбора типа мага игроком перед поиском матча (сейчас захардкожены дефолты),
реальных событий каста заклинания и урона с бэкенда вместо debug-кнопок, ввода
триггеров-заклинаний.
