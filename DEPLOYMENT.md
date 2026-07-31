# Деплой

Монорепо, деплоится раздельно: backend (NestJS + Socket.io, нужен постоянно работающий
процесс) — на Render; frontend (статическая Angular-сборка) — на Vercel.

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

## Frontend — Vercel

Настройки сборки в `frontend/vercel.json` (build command, output directory
`dist/frontend/browser`, SPA-рерайты) — Vercel подхватывает их автоматически.

- Через дашборд: [vercel.com](https://vercel.com) → Add New → Project → подключить
  репозиторий, Root Directory `frontend`. Деплой запускается автоматически при пуше в
  `master` (если Git-интеграция подключена).
- Вручную через CLI (например, если Git-интеграция не настроена или подвисла):
  ```bash
  cd frontend
  npx vercel login   # один раз, откроет браузер для авторизации
  npx vercel --prod --yes
  ```
  Прод-домен: `https://frontend-nine-tau-70.vercel.app` (проект
  `vectorg3s-projects/frontend`).

## Порядок деплоя

Сначала backend (нужен готовый URL для `environment.prod.ts`), затем при необходимости
поправить URL и запушить/передеплоить фронт.

## Что уже подготовлено в коде

- `frontend/src/environments/environment.ts` (dev, `localhost:3000`) и
  `environment.prod.ts` (адрес Render) — подключены через `fileReplacements` в
  `angular.json` (`ng build --configuration production` берёт `environment.prod.ts`).
- `frontend/src/app/socket.service.ts` берёт адрес backend из `environment.apiUrl` вместо
  хардкода.
- `backend/src/main.ts` — добавлен `app.enableCors({ origin: '*' })` для обычных HTTP-
  запросов (WebSocket-гейтвеи уже разрешали CORS отдельно).
- `render.yaml` в корне репозитория — Render Blueprint для backend.
- `frontend/vercel.json` — build/output настройки и SPA-рерайт для Vercel.
