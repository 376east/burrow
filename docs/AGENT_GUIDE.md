# Вход в Burrow для нового агента

Начни с [README](../README.md), [PLAN](../PLAN.md) и ближайшего `AGENTS.md`. Это маршрут по Next без истории чата. Детальные руководства - в [индексе](README.md).

## Точки входа

| Задача | Файлы |
| --- | --- |
| UI | [main.tsx](../src/main.tsx) → [App](../src/App.tsx) → [AppLayout](../src/components/AppLayout.tsx) → [ProductShell](../src/product/ProductShell.tsx). |
| Экраны | [src/product](../src/product), [модпаки](../src/components/modpacks), [настройки](../src/components/settings). |
| Electron | [main.ts](../electron/main.ts), [bootstrap](../electron/app/bootstrap.ts), [lifecycle](../electron/app/lifecycle.ts), [окна](../electron/window/windowManager.ts). |
| Владение | [compositionRoot](../electron/app/compositionRoot.ts), [InstanceApplication](../electron/domains/instances/instanceApplication.ts). Не создавать второй store/runner в handler. |
| API между процессами | [shared/contracts](../shared/contracts), [windowApi](../shared/contracts/windowApi.ts), [bridges](../electron/preload/bridges), [IPCManager](../electron/ipc/ipcManager.ts), [handlers](../electron/ipc/handlers), [wrappers](../src/services/ipc). |
| Изменения данных | [operations](../electron/services/operations), [журнал](../electron/services/operations/operationJournal.ts), [манифесты](../electron/services/instances/manifestManager.ts). |
| Запуск и загрузка | [launcher](../electron/services/launcher), [java](../electron/services/java), [runtime](../electron/services/runtime), [download](../electron/services/download). |
| Контент/API | [modPlatformService](../electron/services/mods/platform/modPlatformService.ts), [modpacks](../electron/services/modpacks). |
| Аккаунты/сеть | [AccountService](../electron/services/account/accountService.ts), [network](../electron/services/network). |

Точный список каналов - в [карте IPC](ru/contracts-map.md). Изменение API проследить через shared → preload → validation/handler → service → wrapper → consumer; обновить обе языковые карты. Проверить ошибки и revision, а не только успешный ответ. `skip-validation` не подтверждает совместимость.

## Данные

Каталоги игры определяет [paths.ts](../electron/services/instances/paths.ts); не зашивай путь разработчика. Сборки, манифесты и журнал хранятся локально; JSON записывается через [atomicJsonStore](../electron/services/storage/atomicJsonStore.ts). UI-настройки - в [SettingsContext](../src/contexts/SettingsContext.tsx). Аккаунты лежат в `userData/accounts.json`, токены зависят от безопасного backend Electron ([код](../electron/services/account/accountService.ts)). Реальные профили и журналы не публикуются.

Обязательного собственного облачного сервера нет: main получает metadata/файлы у внешних провайдеров. Сеть может быть недоступна. [Приватность](ru/privacy.md) и [безопасность](ru/security.md) описывают границы.

Тестовый профиль: `NODE_ENV=test` и абсолютный `BURROW_TEST_USER_DATA`. [Bootstrap](../electron/app/bootstrap.ts) проверяет оба условия. Путь должен быть новым синтетическим профилем, не реальными данными пользователя.

## Установка и конфигурация

```bash
npm ci
npm run dev
```

Node/npm закреплены в [package.json](../package.json) и [.nvmrc](../.nvmrc). `npm ci` запускает [postinstall patch XMCL](../scripts/postinstall-fix-xmcl-bytebuffer.cjs); не удалять без проверки причины.

[.env.example](../.env.example) - справочник без секретов. Для обычного запуска ничего не заполняют. Vite читает renderer `.env`, но main получает `process.env`: переменные main экспортируют в запускающей оболочке. PowerShell: `$env:VARIABLE = 'value'`; bash: `export VARIABLE='value'`. Реальный секрет нельзя помещать в публикуемый сценарий.

`CURSEFORGE_API_KEY` используется [клиентом](../electron/services/mods/platform/modPlatformService.ts), но не решает условия публичного распространения. PostHog-переменные необязательны ([analyticsClient](../src/features/analytics/analyticsClient.ts)). Подпись/публикация настраиваются только для release; [руководство](ru/releasing.md).

## Проверки

| Команда | Граница |
| --- | --- |
| `npm test` | Unit/component/service. Не игровой запуск. |
| `npm run lint` | ESLint без warning. |
| `npx tsc -p tsconfig.json --noEmit` | Типы. |
| `npm run docs:check` | Ссылки и структура документации. |
| `npm run contracts:check && npm run ipc:check` | Карты и allowlist каналов. |
| `npm run architecture:check` | Проверяемые границы владения. |
| `npm run audit:prod` | Проверка production-зависимостей. На 05.10.2026 - 0 уязвимостей; это не аудит dev-зависимостей или игровых установок. Цепочка XMCL обновлена ([provenance](../vendor/README.md), [CI Next.7](https://github.com/malyarq/burrow/actions/runs/37166880329)). |
| `npm run verify` | Последовательность из [package.json](../package.json), включая audit. Не считать предыдущие успешные этапы зелёным verify. |
| `npx playwright install chromium` | Браузер для UI-проверок. |
| `npx playwright test tests/visual/product-next.spec.ts --project=chromium --workers=1` | Next UI. Остальная матрица - в [testing](ru/testing.md). |
| `npm run build -- --publish never` | Production renderer/main и локальный установщик. Не публикация. |
| `node scripts/package-smoke.js --release-dir release/0.14.0 --version 0.14.0 --output work/package-smoke.json` | Запуск пакета в отдельном профиле и штатное закрытие на текущей ОС. Версию брать из package.json. |

Реальная установка - [test-full.js](../scripts/test-full.js) и [testing](ru/testing.md). Она скачивает файлы; не нужна просто ради правки текста. [CI](../.github/workflows/ci.yml) исполняет quality contract и macOS Chromium visual job. Локальные результаты Windows не заменяют CI.

## Первый проход

1. Fetch, ветки, открытые PR/issues; незанятая задача, владелец, границы файлов.
2. UI, wrapper, контракт, handler, service и соседний тест нужного пути.
3. При записи - ошибка до commit, recovery и отмена. При UI - размер окна, темы, язык, фокус и reduced motion.
4. Коммит/push законченного результата; SHA, проверки и блокер при передаче. Не force-push.

Необновлённые платформенные/игровые проверки, Microsoft-вход, Quilt, подпись и XMCL перечислены в [PLAN](../PLAN.md) и [known issues](ru/known-issues.md).
