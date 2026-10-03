# Burrow

Настольный лаунчер Minecraft для игры соло, своих сборок и игры с друзьями.

[![Electron](https://img.shields.io/badge/Electron-43-47848F?logo=electron&logoColor=white)](package.json) [![React](https://img.shields.io/badge/React-19-149ECA?logo=react&logoColor=white)](package.json) [![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](package.json) [![Preview](https://img.shields.io/badge/1.0.0--next.6-preview-F0A43B)](CHANGELOG.md) [![CI](https://github.com/malyarq/burrow/actions/workflows/ci.yml/badge.svg?branch=rebuild%2Fburrow-next)](https://github.com/malyarq/burrow/actions/workflows/ci.yml?query=branch%3Arebuild%2Fburrow-next)

**Играй локально. Зови друга.**

Четыре раздела: играть, библиотека, вместе, настройки. Версия разработки - **1.0.0-next.6** ([package.json](package.json)).

[Демо с озвучкой, 45 секунд](docs/assets/demo/burrow-next-demo.mp4) · [Запуск](#запуск) · [План для ревью](PLAN.md) · [Вход для агента](docs/AGENT_GUIDE.md) · [English](README.en.md)

## Как выглядит сейчас

Next.6, синтетические локальные сборки. Без настоящих аккаунтов и запуска Minecraft.

**Играть: версия, никнейм и модлоадер рядом.**

<img src="docs/assets/screenshots/next/play.png" width="840" alt="Главный экран Burrow Next.6: панорама Minecraft и настройки запуска">

**Библиотека: компактные карточки и фильтры сборок.**

<img src="docs/assets/screenshots/next/library.png" width="840" alt="Библиотека Burrow Next.6 с синтетическими сборками">

**Светлая тема: те же элементы и расположение.**

<img src="docs/assets/screenshots/next/light.png" width="840" alt="Burrow Next.6 в тёплой светлой теме">

[Источник снимков](docs/assets/screenshots/next/provenance.json). [Как переснять демо](docs/DEMO.md).

## Что есть

- Выбор Minecraft/модлоадера, память и запуск: [экран игры](src/product/PlayWorkspace.tsx), [launcher](electron/services/launcher).
- Локальные сборки, импорт/экспорт, каталог и состав модпаков: [библиотека](src/components/modpacks), [провайдерный сервис](electron/services/mods/platform/modPlatformService.ts).
- Моды, ресурспаки, шейдеры, миры и скриншоты: [сервисы контента](electron/services).
- Burrow Link для подключения к открытому LAN-миру, с инструкцией рядом: [«Вместе»](src/product/FriendsWorkspace.tsx), [сеть](electron/services/network/burrowLinkService.ts).
- Темы, акценты, сохранённые темы, русский и английский: [настройки](src/product/SettingsWorkspace.tsx), [контекст](src/contexts/SettingsContext.tsx).

Это реализованные пути в коде, не обещание совместимости со всеми играми, модами и роутерами. Демо использует синтетические сборки без запуска Minecraft. Последний локальный smoke установщика Next выполнен на Windows; macOS/Linux требуют проверки этой версии. Microsoft-вход отсутствует, Quilt не поддерживается. [Остальные ограничения](docs/ru/known-issues.md).

На 04.10.2026 production audit сообщает high advisory в цепочке `http-cache-semantics → @xmcl/file-transfer → @xmcl/installer`. Поэтому полный `npm run verify` пока не зелёный. Миграция должна сохранить хеш-проверки загрузок: [PLAN](PLAN.md#ближайшие-задачи).

## Как устроено

```mermaid
flowchart LR
  UI[React: экраны и состояние] --> IPC[Типизированный IPC через preload]
  IPC --> Main[Electron: сервисы и операции]
  Main --> Disk[Локальные сборки и журнал]
  Main --> Providers[Minecraft / Java / Modrinth / сеть]
  Main --> IPC
  IPC --> UI
```

Кнопка отправляет запрос через [IPC-обёртку](src/services/ipc) и [общий контракт](shared/contracts). Main проверяет запрос, выполняет операцию и возвращает новое состояние. Файлы остаются у main; UI использует идентификаторы сборок. Владельцы создаются в одном [composition root](electron/app/compositionRoot.ts). [Подробная архитектура](docs/ru/architecture.md).

## Запуск

Нужны Node.js 24.x, npm 11.x и Git: [версии](package.json), [.nvmrc](.nvmrc).

```bash
git clone https://github.com/malyarq/burrow.git
cd burrow
npm ci
npm run dev
```

Для обычного запуска API-ключи не нужны. [`.env.example`](.env.example) описывает необязательные переменные; main не читает этот файл автоматически. Команды и окружение - во [входе для агента](docs/AGENT_GUIDE.md).

[GitHub Releases](https://github.com/malyarq/burrow/releases/latest) содержит пакеты прежней линии. Они не являются актуальной Next-preview; старые релизы оставлены как архив. Локальная сборка без публикации: `npm run build -- --publish never`.

Основная ветка GitHub - `rebuild/burrow-next`; `main` оставлена как legacy. [Архив и точная команда отката](docs/REPOSITORY.md).

## Работать вместе

Прочитай [AGENTS.md](AGENTS.md), затем [PLAN.md](PLAN.md). У задачи должен быть владелец и границы файлов. Небольшие законченные изменения коммитим и пушим в рабочую ветку; чужую работу не перезаписываем. [Как переснять демо](docs/DEMO.md).

[Документация](docs/README.md) · [Участие](CONTRIBUTING.md) · [Безопасность](SECURITY.md) · [Изменения](CHANGELOG.md)

Для кода сохранена существующая [MIT-лицензия](LICENSE). Minecraft и сторонние компоненты сохраняют свои права: [уведомления](THIRD_PARTY_NOTICES.md). Burrow не связан с Mojang или Microsoft.
