# AGENTS.md — Burrow

## Project Purpose
Burrow is an Electron-based Minecraft launcher with vanilla play, modpacks, updater flows, account management, and Burrow Link multiplayer.

Stack: `Electron` + `React` + `TypeScript` + `TailwindCSS` + `Vite`.

## Start Here
- Current Next shell: `src/product/ProductShell.tsx`, `PlayWorkspace.tsx`, `SettingsWorkspace.tsx`, `FriendsWorkspace.tsx`.
- Onboarding: `docs/AGENT_GUIDE.md`; implemented vs planned: `PLAN.md`; demo: `docs/DEMO.md`.
- App shell and renderer boot: `src/main.tsx`, `src/App.tsx`, `src/components/AppLayout.tsx`
- Main process boot and windows: `electron/app/bootstrap.ts`, `electron/app/lifecycle.ts`, `electron/window/windowManager.ts`
- Preload and exposed browser APIs: `electron/preload.ts`, `electron/preload/bridges/*`
- IPC contract and handler registration: `shared/contracts/*`, `shared/contracts/windowApi.ts`, `electron/ipc/ipcManager.ts`, `electron/ipc/handlers/*`, `src/services/ipc/*`
- UI areas:
  - classic/simple play: `src/components/SimplePlayDashboard.tsx`, `src/components/Sidebar.tsx`
  - modpacks: `src/components/modpacks/*`, `src/features/modpacks/*`
  - settings/theme/i18n: `src/components/settings/*`, `src/contexts/SettingsContext.tsx`, `src/contexts/settings/i18n.ts`
  - accounts: `src/features/accounts/*`
  - multiplayer: `src/features/multiplayer/*`
- Current product limitations and QA context: `docs/KNOWN_ISSUES.md`, `docs/en/known-issues.md`, and `docs/ru/known-issues.md`

## Directory Guide
- `electron/` — main-process lifecycle, windows, preload, IPC handlers, native services. See `electron/AGENTS.md`.
- `src/` — renderer UI, contexts, features, IPC wrappers, manual verification UI. See `src/AGENTS.md`.
- `shared/` — contracts and types shared by main and renderer. See `shared/AGENTS.md`.
- `docs/` — architecture, roadmap, testing, contracts, known issues. See `docs/AGENTS.md`.
- Product direction and accepted limitations live in the mirrored roadmaps and known-issues documents under `docs/{en,ru}/`. Historical implementation detail belongs in Git history, not in an active planning tree.

## Build And Verify
- `npx tsc --noEmit` — TypeScript type check. Must pass after code changes.
- `npx eslint src/` — renderer lint.
- `npx eslint electron/` — main-process lint.
- `npx vitest run` — test suite.
- `npm run lint` — full lint with zero warnings.
- `npm run dev` — interactive Vite dev session. Use only when manual verification is necessary.
- `npm run build` — production build.

## Non-Negotiables
- Use TypeScript strict mode. Prefer exact types or `unknown`; any unavoidable explicit `any` must stay narrowly scoped, justified, and lint-clean.
- Define IPC contracts in `shared/contracts/*`, register channels in `electron/ipc/ipcManager.ts`, expose preload surface through `electron/preload/bridges/*` and `electron/preload.ts`, and consume them through `src/services/ipc/*`.
- Renderer UI should not call `window.*` APIs directly when an IPC wrapper exists.
- All user-facing strings belong in `src/locales/en.json` and `src/locales/ru.json`.
- Update both `docs/en/contracts-map.md` and `docs/ru/contracts-map.md` when adding or changing IPC channels.
- Update both `docs/en/roadmap.md` and `docs/ru/roadmap.md` only when product direction or accepted limitations change; completed work belongs in `CHANGELOG.md`.
- Run `npm run docs:check` after changing maintained Markdown documentation.
- Prefer nearby `__tests__` as the behavioral reference before changing a feature.

## Agent Workflow
- Read the nearest `AGENTS.md` before editing inside a subdirectory.
- Start from the narrowest relevant entrypoint instead of scanning the whole repository.
- For UI bugs, inspect the component, its hooks, its IPC wrapper, and nearby tests together.
- For IPC work, trace the full path in this order: shared contract -> preload bridge -> IPC handler -> renderer wrapper -> UI consumer.
- For documentation tasks, treat Russian as the primary project language, then keep the English mirror aligned when the document exists in both `docs/ru` and `docs/en`.

## Process Hygiene
- Do not leave long-lived processes, terminals, browser sessions, watchers, or spawned agents running after the task.
- Before final handoff, stop any `npm run dev`, `vite`, `electron`, `vitest --watch`, manual verification server, headless browser, or MCP watch that you started.
- Reuse an existing interactive session when possible; do not open duplicate dev servers for the same repo.
- If you are unsure what is still running, inspect process command lines for this checkout and stop only helpers started for this task. Do not stop another project or the user's app.
- If you spawned sub-agents, watches, or background PTY sessions, close or unwatch them before finishing.

## Git
- Пользователь разрешил routine commit/push в рамках порученных задач именно Burrow. Разрешение не касается других проектов, пользовательских данных, разрушительных действий или выхода за согласованную цель продукта.
- До работы: `git fetch origin`, актуальные ветки, открытые PR/issues. У задачи должны быть владелец и границы файлов; не дублируй взятую работу. Отдельная ветка на задачу: обычные задачи от default branch `main`. `archive/*` сохраняет прежнюю версию; изменять архив только по отдельному поручению.
- Коммить часто: после небольшого законченного проверенного изменения и перед передачей работы. Пушь рабочую ветку, чтобы прогресс был виден; не копи независимые готовые изменения в огромном коммите.
- Не force-push, не перезаписывай чужие изменения и не переходи в занятую рабочую ветку. Пересечение границ согласуй с владельцем. Частые коммиты не заменяют координацию.
- При передаче: ветка, SHA, файлы, проверки, блокеры. Падение verify на зависимости нельзя называть зелёным результатом.
- Make one commit for one finished, coherent result; do not preserve intermediate agent iterations as history.
- Read the staged diff before committing. Write a short, concrete lowercase English subject, usually three to eight words, that names the finished result without task context or a trailing period.
- Do not add conventional prefixes such as `feat:` or `fix:`; the project history uses plain human-readable subjects.
- Never put phase, plan, wave, review, or agent-task numbers in commit messages. Avoid subjects such as `progress`, `checkpoint`, `address feedback`, or `continue work`.
- Never add `Co-authored-by`, `Generated-by`, agent, model, or automation attribution to the subject, body, or trailers.
- Add a body only when a maintainer needs the reason, migration consequence, or non-obvious tradeoff.

## README maintenance
- Keep the root README aligned with the shared project format: useful standard Shields.io flat badges at their natural size, navigation and the six existing sections in their current order. Update screenshots, metadata and release archive labels together; preserve the English mirror and verify the rendered default-branch page through authorized access. Never imply CI success or stable release from a documentation update.

- Badge links must support their claim. CI requires a live status badge visible through authorized access or an ordinary workflow link; never fake green CI. Do not send private metadata or credentials to badge services.

## Разрешённый цикл улучшений

Прямое поручение пользователя от 05.10.2026 в чате «Инструменты» `01a10967-c5f8-7373-8069-a3c5b4197693`: после описания автономного цикла с включением проверенного кода в main пользователь ответил «исправь».

Самостоятельно выбирай следующий ограниченный блок улучшений в рамках продукта, реализуй, проверяй и ревьюь diff, делай частые законченные коммиты, включай проверенный результат в main и выполняй обычный push. Проверь итоговый удалённый SHA и CI; затем продолжай следующую итерацию. PR используй только когда он помогает координации или требуется защитой ветки; сам заверши его слияние после необходимых проверок, без ожидания пользователя. Не накапливай зависимые PR вместо включения готового кода в main. Отдельный issue нужен при пересекающейся работе, а не для каждой самостоятельной правки.

Разрешение включает обычное слияние собственных проверенных изменений и push main, сохраняется после handoff и заменяет прежний запрет самостоятельного merge, обязательный PR и повторный выбор каждой задачи пользователем. Сохраняй чужие изменения, несведённые ветки, PRIVATE и опубликованную историю. Защиту веток и необходимые проверки не обходи; при конфликте безопасно согласуй код и повтори затронутые проверки. Расходы, смена цели, force-push, удаление чужой работы, публикация личных материалов и production-выкатка требуют отдельного основания. Если push main автоматически выкатывает production, остановись до этого действия и сообщи конкретный блокер.
