# Burrow: план для независимого ревью

Здесь описана Next-ветка. Реализованные возможности подтверждаются кодом; задачи ниже ещё не выполнены. Основа: [package.json](package.json), [архитектура](docs/ru/architecture.md), [ограничения](docs/ru/known-issues.md).

## Реализовано

| Область | Источник и граница |
| --- | --- |
| Четыре раздела продукта | [ProductShell](src/product/ProductShell.tsx): игра, библиотека, вместе, настройки. |
| Владение сборками | [InstanceApplication](electron/domains/instances/instanceApplication.ts), [composition root](electron/app/compositionRoot.ts): один владелец данных в main. |
| Изменения и восстановление | [operation runner](electron/services/operations/operationRunner.ts), [журнал](electron/services/operations/operationJournal.ts), соседние тесты. Recovery не гарантирует защиту от всех аппаратных сбоев. |
| Контент и каталог | [Провайдерный сервис](electron/services/mods/platform/modPlatformService.ts), импорт/экспорт и локальные файлы. |
| Совместная игра | [Burrow Link](electron/services/network/burrowLinkService.ts), LAN и UPnP; результат зависит от сети. |
| Аккаунты | [AccountService](electron/services/account/accountService.ts): офлайн и Yggdrasil; доступность безопасного хранения токенов проверяется. Microsoft-вход отсутствует. |
| Дизайн | Темы, компактные карточки, панорама и отклики без перестройки страниц: [экраны](src/product), [CHANGELOG](CHANGELOG.md). |

## Решения и компромиссы

Electron оставлен ради общей реализации Windows/macOS/Linux и существующих Node/XMCL-сервисов ([зависимости](package.json)). Цена - Chromium, память процессов, размер пакета и сопровождение сетевых библиотек. Нативная перезапись не утверждена: сначала сравниваем кандидатов на одинаковых сценариях. [Stress-стенд](scripts/stress-launcher.js) позволяет измерить текущую версию; его цифры нельзя переносить на чужой компьютер без повторного прогона.

Renderer не владеет файловыми путями операций. [Контракты](shared/contracts) и [composition root](electron/app/compositionRoot.ts) дают одну точку владения и восстановления. Цена - межпроцессные типы и проверки. Изменение API требует проверки обеих сторон; обход validation её не заменяет. Подробная схема - в [архитектуре](docs/ru/architecture.md).

Основной вход GitHub - `rebuild/burrow-next`, текущая версия остаётся preview. `main` - legacy; старый опубликованный HEAD сохранён отдельной архивной веткой. [Архив и откат](docs/REPOSITORY.md). Демо показывает UI и синтетические сборки; не подтверждает установку игры, настоящий multiplayer или авторизацию ([процесс записи](docs/DEMO.md)).

## ИИ, провайдеры и расходы

В runtime нет реализованной LLM-функции. Каталог, установка, статусы и гайды - обычный код и правила. OpenAI/Anthropic-ключ для запуска не нужен. Источники: [провайдерный сервис](electron/services/mods/platform/modPlatformService.ts), [переводы](src/locales/ru.json), [зависимости](package.json).

| Где | Используется | Расход и граница |
| --- | --- | --- |
| Приложение | Minecraft/Java metadata, Modrinth, сеть; CurseForge-клиент необязателен | Интернет и диск. Квоты и тарифы провайдеров здесь не оценены. Собственного inference-счёта в коде нет. |
| Панорама | Созданная генератором иллюстрация в [WebP](public/burrow-campfire.webp) | Только производство. Точная модель и стоимость в репозитории не зафиксированы; приложение генератор не вызывает. |
| Голос демо | `ru-RU-SvetlanaNeural`, Edge TTS, темп `+5%`: [сборщик](scripts/demo/assemble.py) | Сетевой сервис при создании ролика; передаётся публичный текст. Это не договор на бесплатный production API и не функция лаунчера. |
| Возможный AI-помощник | Не выбран и не реализован | Сначала решить, нужен ли он. Модель, провайдер, приватность и бюджет не утверждены. |

## Ближайшие задачи

1. **XMCL и реальные установки.** Обновлена цепочка зависимостей, локальный production audit сообщает 0 уязвимостей. Повреждённая публикация installer имеет воспроизводимые поправки, сохраняющие проверку хешей и отмену. Остаётся проверить настоящие Minecraft/Java и модлоадеры отдельно от HTTP-фикстур. [Provenance](vendor/README.md), [проверки](electron/services/runtime/__tests__/installerIntegrity.fixture.test.ts), [DownloadManager](electron/services/download/downloadManager.ts).
2. **Установки на трёх ОС.** Проверить окончательный пакет на чистых Windows/macOS/Linux: native dialogs, обновление данных и закрытие. Готово: evidence каждой платформы. Cross-platform код этого не подтверждает. [Package smoke](scripts/package-smoke.js), [testing](docs/ru/testing.md).
3. **Игровой маршрут.** Отдельно проверить Java/Minecraft, поддерживаемые модлоадеры, запуск и выход; Link - на двух устройствах и нескольких сетях. UI-демо не заменяет этот проход. [Installation harness](scripts/test-full.js), [руководство](docs/ru/user-guide.md).
4. **Дизайн с пользователями.** Молодая аудитория - выбранное направление, не доказанное предпочтение всех зумеров и альфа. Дать людям задачи: собрать запуск, найти состав модпака, настроить память и подключиться к другу. Исправлять зафиксированные ошибки и задержки. [Дизайн-система](docs/ru/design-system.md).

Microsoft-вход, подпись/notarization, Quilt и нативный стек - отдельные решения, не часть публикации документации. Общие условия - в [roadmap](docs/ru/roadmap.md).

## Маршрут ревью Данила

Публикация документации не означает зелёный CI продукта. На `main` commit `241578e09a2540f7a4685927a929ef972dbf0777` macOS job `Run visual closeout` упал на семи сравнениях screenshots: отличаются размеры и изображение. Источник: [прогон CI](https://github.com/malyarq/burrow/actions/runs/37159082787). Нельзя автоматически принять новые эталоны ради зелёного статуса: сначала просмотреть expected/actual и решить, что является утверждённым дизайном. Runtime-код main при публикации документации не менялся; это не причина игнорировать упавший этап.

В этом же завершённом прогоне `Shared quality contract` прошёл unit, lint, docs, contracts, IPC, architecture и dependency graph, затем остановился на complexity ratchet: текущие LOC/сложность превышают закреплённые лимиты нескольких файлов. Следующие этапы этим прогоном не подтверждены. Нужен отдельный разбор границ функций и лимитов; поднимать бюджеты автоматически ради зелёного CI нельзя. Источник - тот же [CI job](https://github.com/malyarq/burrow/actions/runs/37159082787), правила - в [quality contract](scripts/quality-contract.cjs).

Начать с [AGENT_GUIDE](docs/AGENT_GUIDE.md). Проследить одну запись сборки и один запуск от UI до диска; проверить прерывание, recovery и IPC. Затем оценить миграцию XMCL и границы Electron. Не считать тестовые сервисы production-провайдерами. Координация - по [AGENTS.md](AGENTS.md).
