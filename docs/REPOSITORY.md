# Основная версия и откат

Обычный URL [malyarq/burrow](https://github.com/malyarq/burrow) открывает `rebuild/burrow-next`: текущие код, README, PLAN, документацию и демо. Репозиторий PRIVATE: просмотр требует авторизованный доступ GitHub. Версия Next.6 - preview, не подтверждённый стабильный релиз. CI запускается и на этой ветке: [workflow](../.github/workflows/ci.yml).

Прежняя default branch была `main`, опубликованный HEAD - `241578e09a2540f7a4685927a929ef972dbf0777`. Перед переключением он сохранён в [archive/main-before-next-2026-10-04](https://github.com/malyarq/burrow/tree/archive/main-before-next-2026-10-04). История не переписана, `main` не удалена.

Откат основной ветки на точную сохранённую версию:

```bash
gh repo edit malyarq/burrow --default-branch archive/main-before-next-2026-10-04
```

Команда требует авторизацию владельца GitHub. Она меняет только default branch, не сбрасывает рабочие файлы и не переписывает историю. Возврат к Next:

```bash
gh repo edit malyarq/burrow --default-branch rebuild/burrow-next
```

Старые установщики GitHub Releases относятся к прежней линии. Их наличие не подтверждает готовность текущего preview. Перед новым релизом нужны проверки окончательного HEAD и устранение блокеров из [PLAN](../PLAN.md).
