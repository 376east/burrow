# Репак XMCL Installer 6.3.1

Исходник - [официальный npm-архив `@xmcl/installer@6.3.1`](https://registry.npmjs.org/@xmcl/installer/-/installer-6.3.1.tgz), SHA-256 `91aa24de7c0a12adf81bf177e95213099b8adc5ee9ef3b5d76b2d665565bddd4`. Скрипт проверяет этот хеш до изменения архива; другой исходник не принимается. [Код проверки](repack-installer.py).

Архив `xmcl-installer-6.3.1-fixed.tgz` воспроизводится командой `python vendor/repack-installer.py` из корня проекта. SHA-256 текущего результата: `4efab74659ef9f82de9d23510f86d7f39d2037244eb66f356cec39a8d30685a3`. Gzip timestamp и имя обнулены; остальные записи и метаданные берутся из закреплённого исходника. Замена результата происходит после успешного применения всех патчей и проверки, что архив не изменил другой процесс. [Сборка архива](repack-installer.py).

Версия 6.3.1 выбрана для ограниченной совместимости с текущим workflow launcher. Обновление до 6.3.5 затрагивает дополнительные workflow API и не входит в эту миграцию. Поле лицензии из исходного `package.json` сохраняется без изменения; остальные записи архива, включая файлы лицензии при их наличии, копируются без изменений. [Список изменяемых записей](repack-installer.py).

Замена `@xmcl/file-transfer@2.0.3` на 2.1.4 нужна для удаления `http-cache-semantics`: в [исходном lock на `3f8fd53`](https://github.com/malyarq/burrow/blob/3f8fd53/package-lock.json) уже стояла версия 4.2.0, а на 4 октября 2026 [GHSA-ch52-4w7c-c8xp](https://github.com/advisories/GHSA-ch52-4w7c-c8xp) охватывает версии `<=4.2.0` и не указывает исправленную версию. Поэтому override на 4.2.0 не устраняет finding. [Manifest 2.0.3](https://registry.npmjs.org/@xmcl/file-transfer/2.0.3) содержит эту зависимость, [manifest 2.1.4](https://registry.npmjs.org/@xmcl/file-transfer/2.1.4) её удаляет.

## Исправления публикации

В исходном `package.json` entrypoints указывают на отсутствующие файлы, а зависимости содержат workspace-ссылки. Репак указывает на опубликованные `dist/index.js`, `dist/index.mjs`, `dist/index.d.ts` и закрепляет версии зависимостей. Недоступный внутренний импорт `@xmcl/core/utils` заменён его точным используемым предикатом `v !== undefined`. Для native ESM добавлены default import CommonJS-модуля `@xmcl/asm` и `createRequire` для встроенного CommonJS-кода `yazl`. [Патчи публикации](repack-installer.py).

## Целостность и отмена

Патчи одинаково применяются к CJS и ESM. После закрытия загруженного файла проверяется SHA1 библиотек и assets через `downloadMultiple.onFileComplete`. Также проверяются asset index до JSON parsing, log configuration, Forge installer, Java manifest, Java raw/LZMA и результат распаковки LZMA. При несовпадении файл удаляется; библиотеки/assets используют ограниченный fallback, остальные пути завершают операцию ошибкой. Если отмена произошла во время SHA1 свежей загрузки assets, её файл удаляется, чтобы следующий запуск не принял его по одному размеру. Cached-проверки этим cleanup не затрагиваются. SHA1 применяется только при наличии ожидаемого хеша в метаданных. [Реализация `patch_runtime`](repack-installer.py).

Asset-index fallback сохраняет исходные байты HTTP-ответа: JSON reserialization меняет SHA1. Исправлена привязка ошибки assets к первоначальному индексу результата. Missing log configuration обрабатывается как возвращаемый `Issue`, а ошибка или отмена загрузки больше не поглощается. Java batch download получает signal и проверяет все settled results перед распаковкой; валидный cached LZMA распаковывается, если raw-файл отсутствует. [Реализация `patch_runtime`](repack-installer.py).

Адаптер launcher передаёт один объединённый сигнал в обе опции XMCL: `signal` для библиотек/Java и `abortSignal` для assets. [Адаптер](../electron/services/runtime/installerTasks.ts).

## Проверки и границы

[Loopback fixtures](../electron/services/runtime/__tests__/installerIntegrity.fixture.test.ts) запускают реальные CJS/ESM API с локальным HTTP-сервером: корректные и повреждённые ответы, SHA1, Java batch failures, asset-index bytes и остановка медленной загрузки Java/assets. [Тесты адаптера](../electron/services/runtime/__tests__/installerTasks.test.ts) проверяют прогресс, передачу опций и сигналов, а также отмену без повторной установки.

После ошибки SHA1 библиотеки/assets пробуют оставшиеся уникальные URL-кандидаты; транспортный fallback между ними выполняет штатный `download`. После повреждённого ответа список сокращается по фактически использованному URL. Число проверок ограничено числом кандидатов; отмена и ошибки вне проверки SHA1 не запускают дополнительный цикл. Для retries используется исходный progress tracker, поэтому скачанные повреждённые байты не увеличивают итоговые total/progress. [Реализация и ограничение цикла](repack-installer.py). Опции старого API `librariesConcurrency` и `assetsConcurrency` отсутствуют в `CompleteOptions` нового установщика; они не восстанавливаются репаком. Настроенный dispatcher остаётся способом управления транспортом. Реальная установка Minecraft/Forge/Java и запуск игры этими fixtures не подтверждаются. Источник API - `dist/installer.d.ts`, `dist/assets.d.ts` и `dist/libraries.d.ts` в [закреплённом исходном архиве](https://registry.npmjs.org/@xmcl/installer/-/installer-6.3.1.tgz).
