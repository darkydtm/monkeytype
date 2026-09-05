# Race (клавогонки) - design

Date: 2026-09-05. Status: approved (transport A). No commit per repo rule (AI artifacts untracked).

## Goal
Гонка 1v1 с другом по коду. Тот же текст, что в сингле, выбирает хост. Финиш - оба допечатали. Near-realtime via REST polling, без WS.

## Non-goals
Матчмейкинг, >2 игроков, античит, рейтинг, WebSocket.

## Flow
1. Хост: `/race` -> Create -> получает `code` (6 символов), `state=lobby`, ждет.
2. Гость: вводит `code` -> Join -> оба видят друг друга.
3. Хост: Start -> `state=countdown`, `startsAt=now+3s` -> оба стартуют одновременно.
4. `state=running`: каждый печатает; клиент шлет progress 4Hz, тянет соперника 2Hz.
5. Каждый финиш шлет `done:true`. `state=finished` когда оба `done` или таймаут 5мин. Таблица: место, wpm, acc, время.

## API (packages/contracts `racesContract`, prefix `/races`)
- `POST /` body `{text, mode, mode2, language}` -> `{code}` (auth, create `lobby`)
- `POST /:code/join` -> `{text, config, startsAt}` (второй игрок; 409 если full)
- `POST /:code/start` -> `{startsAt}` (только хост, из lobby)
- `PATCH /:code/progress` body `{wpm, acc, progress, done}` (4Hz throttle, 409 если не running)
- `GET /:code` -> `{state, players:[{name,wpm,progress,done,finishTime}], startsAt, text}` (poll 500ms в lobby/running)

## DB (native driver, zod в packages/schemas `races.ts`, DAL `backend/src/dal/race.ts`)
`races` doc: `{code unique, text, config:{mode,mode2,language}, state, startsAt, players:[{uid,name,wpm,acc,progress,done,finishTime}], createdAt, expiresAt}`. TTL-index на `expiresAt` (+1h после finish). Код: `nanoid(6)` uppercase, retry на collision.

## Frontend (`frontend/src/ts/components/pages/RacePage.tsx`, id `race`)
- Route `/race` + `/race/:code` (route-controller, page-controller solidPage, mount.tsx, index.html слот).
- Подстраницы состоянием: lobby (create/join/code share) / countdown (3-2-1 по `startsAt`) / running (существующий движок печати vanilla `#words` + два бара: свой live из `states/test.ts currentLiveStats`, чужой из poll) / finished (таблица).
- Текст гонки: хост берет текущий конфиг/текст из генератора (`words-generator`), кладет в `POST /`; гость рендерит полученный `text` через `test-words` reset+push (без generateWords).
- Отправка: на `timerStep` (1Hz) + ввод-throttle 250мс; получение: `setInterval 500мс` пока lobby/running, стоп на finished/unmount.
- Ошибки: 404 код (показать invalid), 409 full/already started, обрыв poll (ретрай 3x -> баннер reconnect).

## Edge
- Обновление страницы: rejoin по коду (uid из auth), прогресс сброшен, соперник видит reset.
- Хост вышел в lobby: комната удаляется (или передается; v1 - удаляется, гость видит closed).
- Читерский wpm: v1 доверяем клиенту; capped 300 для отображения.
- Нагрузка: 2 req/s на комнату; без rate-limit исключений, общий лимит хватает.

## Verify
- `pnpm vitest run backend/src/__tests__/dal/race.spec.ts` (create/join/start/progress/finish/TTL)
- `pnpm vitest run frontend/src/ts/components/pages/__tests__/race-progress.spec.ts` (throttle, бары, countdown math)
- Ручное: 2 браузера, один код, синхронный старт, live-бары, таблица.
