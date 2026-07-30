# Деплой

Монорепо, деплоится раздельно: backend (NestJS + Socket.io, нужен постоянно работающий
процесс) — на Render; frontend (статическая Angular-сборка) — на Cloudflare Pages.

## Backend — Render

1. На [render.com](https://render.com) → New → Blueprint, укажи этот репозиторий. Render
   найдёт `render.yaml` в корне и создаст web-сервис `keyboard-mages-backend`
   (root dir `backend`, план free).
   - Без Blueprint — вручную: New → Web Service, root directory `backend`,
     build command `npm install && npm run build`, start command `npm run start:prod`.
2. После первого деплоя Render покажет реальный адрес вида
   `https://keyboard-mages-backend.onrender.com` (или с другим суффиксом, если имя занято).
3. Если адрес отличается от `https://keyboard-mages-backend.onrender.com` — поправь
   `apiUrl` в `frontend/src/environments/environment.prod.ts` под реальный.
4. Free-план Render засыпает после ~15 минут простоя и просыпается ~30–60 сек на первый
   запрос — для реалтайм-дуэли это означает разрыв соединения/долгий коннект после простоя.
   Для стабильной игры со временем стоит перейти на платный план (без sleep).

## Frontend — Cloudflare Pages

1. [dash.cloudflare.com](https://dash.cloudflare.com) → Workers & Pages → Create → Pages →
   подключить репозиторий.
2. Настройки сборки:
   - Root directory: `frontend`
   - Build command: `npm run build`
   - Build output directory: `dist/frontend/browser`
3. Деплой запускается автоматически при пуше в `master`.

## Порядок деплоя

Сначала backend (нужен готовый URL для `environment.prod.ts`), затем при необходимости
поправить URL и запушить — Cloudflare Pages передеплоит фронт с уже верным адресом.

## Что уже подготовлено в коде

- `frontend/src/environments/environment.ts` (dev, `localhost:3000`) и
  `environment.prod.ts` (адрес Render) — подключены через `fileReplacements` в
  `angular.json` (`ng build --configuration production` берёт `environment.prod.ts`).
- `frontend/src/app/socket.service.ts` берёт адрес backend из `environment.apiUrl` вместо
  хардкода.
- `backend/src/main.ts` — добавлен `app.enableCors({ origin: '*' })` для обычных HTTP-
  запросов (WebSocket-гейтвеи уже разрешали CORS отдельно).
- `render.yaml` в корне репозитория — Render Blueprint для backend.
