# Основная версия и откат

Обычный URL [malyarq/burrow](https://github.com/malyarq/burrow) открывает `main`: текущие код, README, PLAN, документацию и демо. Репозиторий PRIVATE: просмотр требует авторизованный доступ GitHub. Версия 0.14.0 - preview, не подтверждённый стабильный релиз. CI запускается и на этой ветке: [workflow](../.github/workflows/ci.yml).

Прежняя версия `main`, опубликованный HEAD - `241578e09a2540f7a4685927a929ef972dbf0777`. Перед переключением он сохранён в [archive/main-before-next-2026-10-04](https://github.com/malyarq/burrow/tree/archive/main-before-next-2026-10-04). История сохранена через merge; текущая `main` содержит 0.14.0.

Откат основной ветки на точную сохранённую версию:

```bash
gh repo edit malyarq/burrow --default-branch archive/main-before-next-2026-10-04
```

Команда требует авторизацию владельца GitHub. Она меняет только default branch, не сбрасывает рабочие файлы и не переписывает историю. Возврат к Next:

```bash
gh repo edit malyarq/burrow --default-branch main
```

Старые установщики GitHub Releases относятся к прежней линии. Их наличие не подтверждает готовность текущего preview. Перед новым релизом нужны проверки окончательного HEAD и устранение блокеров из [PLAN](../PLAN.md).
