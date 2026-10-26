import { PlayLaunchStatus } from './PlayLaunchStatus';
import { getPlayLaunchBlocker, getPlayLaunchLabel } from './playReadiness';
import { PlayConfigurationRetry } from './PlayConfigurationRetry';
import { LoaderSelection } from './LoaderSelection';
import { PlayMemoryControl } from './PlayMemoryControl';
import { PlayArtwork } from './PlayArtwork';
import { resolvePlayLoaderVersions } from './playLoaderVersions';
import { useCallback, useId, useMemo, useRef, useState } from 'react';
import { ChevronDown, Play } from 'lucide-react';
import type { AppLayoutProps } from '../components/AppLayout';
import { GameTab } from '../components/settings/tabs/GameTab';
import { ClassicContentTabs } from '../components/simple-play/ClassicContentTabs';
import { DegradedStateView } from '../components/layout/DegradedStateView';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { useSettings, useUIMode } from '../contexts/SettingsContext';
import { useEffectiveInstance } from '../features/instances/hooks/useEffectiveInstance';
import {
  dispatchInstanceConfigCommand,
  useInstanceConfigCommands,
} from '../features/instances/hooks/useInstanceConfigCommands';
import { useInstanceInvalidation } from '../features/instances/hooks/useInstanceInvalidation';
import { useModSupportedVersions } from '../features/launcher/hooks/useModSupportedVersions';
import {
  isLoaderSupported,
} from '../features/launcher/services/launcherService';
import { buildModpackRuntimeSummary } from '../features/modpacks/hooks/useModpackRuntimeSummary';
import { usePersistentModpackNavigation } from '../features/modpacks/navigation/ModpackNavigationContext';
import { OptifineToggle } from '../components/sidebar/OptifineToggle';
import { CLASSIC_MODPACK_ID } from '../../shared/constants';
import { toDisplayErrorMessage } from '../utils/displayError';
import { getInstanceRamGb } from '../contexts/instances/utils/memory';

export type PlayWorkspaceProps = Pick<AppLayoutProps, 'launch' | 'runtime' | 'actions'>;

function text(t: (key: string) => string, key: string, fallback: string) {
  const translated = t(key);
  return translated === key ? fallback : translated;
}

function CurrentGame({ name, version, loader, t }: { name?: string; version: string; loader: string; t: (key: string) => string }) {
  return <div className="next-current-game">
    <h2>{name ?? text(t, 'play_workspace.launch_title', 'Запуск игры')}</h2>
    <span>Minecraft {version} · {loader === 'vanilla' ? 'Vanilla' : loader}</span>
  </div>;
}

export function PlayWorkspace({ launch, runtime, actions }: PlayWorkspaceProps) {
  const { t, getAccentStyles, disableAnimations } = useSettings();
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [memorySaving, setMemorySaving] = useState(false);
  const advancedId = useId();
  const statusId = useId();
  const launchPanel = useRef<HTMLElement>(null);
  const advancedTrigger = useRef<HTMLButtonElement>(null);
  const { setMode } = useUIMode();
  const effectiveInstance = useEffectiveInstance();
  const instanceId = effectiveInstance.status === 'ready' ? effectiveInstance.data.id : null;
  const configCommands = useInstanceConfigCommands(instanceId);
  const { invalidateInstance } = useInstanceInvalidation();
  const { forgeVersions, fabricVersions, neoForgeVersions, optiFineVersions } = useModSupportedVersions();
  const modpackNavigation = usePersistentModpackNavigation();
  const busy = runtime.isLaunching || memorySaving;
  const config = effectiveInstance.status === 'ready' ? effectiveInstance.data.snapshot : null;
  const runtimeSummary = useMemo(() => (
    config ? buildModpackRuntimeSummary({ config, optiFineVersions }) : null
  ), [config, optiFineVersions]);
  const loaderVersions = resolvePlayLoaderVersions(launch, { forgeVersions, fabricVersions, neoForgeVersions });
  const loaderSupported = isLoaderSupported({
    loaderType: launch.loaderType,
    mcVersion: launch.version,
    ...loaderVersions,
  });
  const blocker = getPlayLaunchBlocker({ memorySaving, version: launch.version, loaderSupported });
  const canLaunch = !runtime.isLaunching && blocker === null && effectiveInstance.status === 'ready';
  const actionLabel = getPlayLaunchLabel(runtime.launchStage, t);
  const showProgress = busy && runtime.launchStage === 'downloading' && typeof runtime.progress === 'number';

  const retry = useCallback(() => {
    return invalidateInstance(CLASSIC_MODPACK_ID);
  }, [invalidateInstance]);
  const updateVersion = useCallback((version: string) => {
    launch.setVersion(version);
  }, [launch]);
  const updateLoader = useCallback((loader: PlayWorkspaceProps['launch']['loaderType']) => {
    launch.setLoader(loader);
  }, [launch]);
  const openGuidedContent = useCallback((contentType: 'resourcepack' | 'shader') => {
    if (!instanceId) return;
    modpackNavigation.navigate({
      type: contentType === 'resourcepack' ? 'addResourcePack' : 'addShader',
      modpackId: instanceId,
    });
    setMode('modpacks');
  }, [instanceId, modpackNavigation, setMode]);

  if (effectiveInstance.status === 'idle' || effectiveInstance.status === 'loading') {
    return (
      <main className="h-full overflow-y-auto px-4 py-6 sm:px-7 lg:px-10" aria-label={text(t, 'play_workspace.title', 'Играть')}>
        <DegradedStateView
          variant="unavailable"
          layout="workspace"
          testId="play-workspace-loading"
          title={text(t, 'play_workspace.loading_title', 'Подготавливаем игру')}
          description={text(t, 'play_workspace.loading_desc', 'Читаем текущую игровую конфигурацию.')}
        >
          <LoadingSpinner size="md" variant="accent" />
        </DegradedStateView>
      </main>
    );
  }

  if (effectiveInstance.status === 'error' || effectiveInstance.status === 'uninitialized') {
    const unavailable = effectiveInstance.status === 'uninitialized';
    return (
      <main className="h-full overflow-y-auto px-4 py-6 sm:px-7 lg:px-10" aria-label={text(t, 'play_workspace.title', 'Играть')}>
        <DegradedStateView
          variant={unavailable ? 'unavailable' : 'error'}
          layout="workspace"
          testId={unavailable ? 'play-workspace-unavailable' : 'play-workspace-error'}
          title={text(t, unavailable ? 'play_workspace.unavailable_title' : 'play_workspace.error_title', unavailable ? 'Игра пока не готова' : 'Не удалось открыть игру')}
          description={unavailable
            ? text(t, 'play_workspace.unavailable_desc', 'Обновите конфигурацию и попробуйте снова.')
            : toDisplayErrorMessage(effectiveInstance.error.message, text(t, 'play_workspace.error_desc', 'Повторите попытку, не закрывая этот экран.'))}
          footer={<PlayConfigurationRetry onRetry={retry} t={t} />}
        />
      </main>
    );
  }

  return (
    <main className="h-full overflow-y-auto" aria-label={text(t, 'play_workspace.title', 'Играть')}>
      <div className="next-play-body mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-7 sm:py-8 lg:px-10">
        <header className="next-play-heading">
          <div className="next-play-hero-copy">
            <div className="next-play-title-row">
              <h1>{text(t, 'play_workspace.title', 'Играть')}</h1>
              <span className="next-game-edition">{text(t, 'play_workspace.kicker', 'Minecraft Java Edition')}</span>
            </div>
            <p className="next-hero-intro">{text(t, 'play_workspace.intro', 'Выберите версию и профиль, затем запустите игру.')}</p>
          </div>
        </header>

        <div className="next-play-workbench">
        <div className="next-play-overview">
          <PlayArtwork disableAnimations={disableAnimations} t={t} />

        <section ref={launchPanel} className="next-launch-panel grid gap-5 p-5 sm:p-6" aria-label={text(t, 'play_workspace.launch_title', 'Запуск игры')}>
          <CurrentGame name={config?.name} version={launch.version} loader={launch.loaderType} t={t} />
          <div className="next-launch-fields">
            <Select
              label={text(t, 'modpacks.minecraft_version', 'Версия Minecraft')}
              value={launch.version}
              onChange={(event) => updateVersion(event.target.value)}
              disabled={busy}
              data-testid="play-workspace-version"
            >
              {!launch.version && <option value="" disabled>{t('play_workspace.version_placeholder')}</option>}
              {launch.version && !launch.versions.some((version) => version.id === launch.version) && <option value={launch.version}>{launch.version}</option>}
              {launch.versions.map((version) => (
                <option key={version.id} value={version.id}>{version.id}</option>
              ))}
            </Select>
            <Input
              label={text(t, 'general.nickname', 'Никнейм')}
              value={launch.nickname}
              onChange={(event) => launch.setNickname(event.target.value)}
              disabled={busy}
              placeholder="Steve"
              data-testid="play-workspace-nickname"
            />

          </div>
          {launch.isOffline ? <p className="text-right text-xs text-secondary">{text(t, 'general.offline', 'Офлайн')}</p> : null}
          <fieldset className="min-w-0" data-testid="play-workspace-loader">
            <legend className="control-label mb-2">{text(t, 'general.modloader', 'Загрузчик модов')}</legend>
            <div className="next-loader-switch">
              <LoaderSelection index={['vanilla', 'fabric', 'forge', 'neoforge'].indexOf(launch.loaderType)} disableAnimations={disableAnimations} />
              {(['vanilla', 'fabric', 'forge', 'neoforge'] as const).map((loader) => {
                const supported = isLoaderSupported({
                  loaderType: loader, mcVersion: launch.version,
                  ...loaderVersions,
                });
                return <button key={loader} type="button" aria-pressed={launch.loaderType === loader}
                  disabled={busy || !supported} onClick={() => updateLoader(loader)}>
                  {loader === 'vanilla' ? text(t, 'play_workspace.vanilla', 'Vanilla') : loader === 'neoforge' ? 'NeoForge' : loader[0].toUpperCase() + loader.slice(1)}
                </button>;
              })}
            </div>
          </fieldset>
          <PlayMemoryControl value={getInstanceRamGb(config)} disabled={busy}
            onChange={configCommands.setMemoryGb} onSavingChange={setMemorySaving} t={t} />
          <div className="min-w-0">
            <Button
              variant="primary"
              size="md"
              onClick={runtime.onLaunch}
              disabled={!canLaunch}
              aria-describedby={statusId}
              progress={showProgress ? runtime.progress : undefined}
              className="w-full"
              data-testid="play-workspace-launch"
            >
              <Play className="h-5 w-5" fill="currentColor" />
              {actionLabel}
            </Button>
          </div>

        <PlayLaunchStatus runtime={runtime} showProgress={showProgress} t={t} blocker={blocker} id={statusId}
          onSettings={() => { setAdvancedOpen(true); advancedTrigger.current?.focus(); }}
          onChooseVersion={() => launchPanel.current?.querySelector('select')?.focus()}
          onChooseLoader={() => launchPanel.current?.querySelector<HTMLButtonElement>('[data-testid="play-workspace-loader"] button:not(:disabled)')?.focus()} />
        </section>
        </div>

        <section className="next-advanced-section border-y border-border/70 py-1">
          <button ref={advancedTrigger} type="button" className="next-disclosure-trigger" aria-expanded={advancedOpen}
            aria-controls={advancedId} onClick={() => setAdvancedOpen((open) => !open)}>
            <ChevronDown className={advancedOpen ? 'rotate-180' : ''} aria-hidden="true" />
            {text(t, 'play_workspace.advanced_title', 'Расширенные настройки')}
          </button>
          <div id={advancedId} className="next-disclosure" data-open={advancedOpen} data-motion={!disableAnimations} inert={!advancedOpen}>
          <div className="min-h-0 overflow-hidden"><div className="pt-5">
          <div className="mb-4 flex justify-end">
            <Button variant="ghost" size="sm" onClick={actions.onShowSettings} disabled={busy}>{text(t, 'general.settings', 'Настройки')}</Button>
          </div>
          <GameTab
            modpackConfig={config}
            setMemoryGb={(value) => dispatchInstanceConfigCommand(configCommands.setMemoryGb(value))}
            setMinMemoryGb={(value) => dispatchInstanceConfigCommand(configCommands.setMinMemoryGb(value))}
            setVmOptions={(value) => dispatchInstanceConfigCommand(configCommands.setVmOptions(value))}
            setGameExtraArgs={(value) => dispatchInstanceConfigCommand(configCommands.setGameExtraArgs(value))}
            setGameResolution={(value) => dispatchInstanceConfigCommand(configCommands.setGameResolution(value))}
            setAutoConnectServer={(value) => dispatchInstanceConfigCommand(configCommands.setAutoConnectServer(value))}
            t={t}
            getAccentStyles={getAccentStyles}
            isReadOnly={busy}
          />
          <div className="mt-4">
            <OptifineToggle
              isOptiFineSupported={launch.supportedVersions.optiFine.includes(launch.version)}
              useForge={launch.useForge}
              useOptiFine={launch.useOptiFine}
              setUseOptiFine={launch.setUseOptiFine}
              disabled={busy}
              t={t}
              getAccentStyles={getAccentStyles}
            />
          </div>
          </div></div></div>
        </section>

        {runtimeSummary ? (
          <section className="next-content-section" aria-labelledby="play-workspace-content">
            <div className="mb-4">
              <h2 id="play-workspace-content" className="text-xl font-semibold text-foreground">{text(t, 'dashboard.content', 'Контент')}</h2>
            </div>
            <ClassicContentTabs
              presentation="inline"
              isReadOnly={busy}
              instanceId={effectiveInstance.data.id}
              showMods={Boolean(runtimeSummary.runtime.modLoader)}
              runtimeSummary={runtimeSummary}
              onOpenGuidedContent={openGuidedContent}
            />
          </section>
        ) : null}
        </div>
        <div className="next-play-library-link">
          <p>{text(t, 'play_workspace.library_hint', 'Нужна другая сборка? Все установленные сборки находятся в библиотеке.')}</p>
          <Button variant="secondary" size="sm" disabled={busy} onClick={() => setMode('modpacks')}>{text(t, 'next.nav.library', 'Библиотека')}</Button>
        </div>
      </div>
    </main>
  );
}
