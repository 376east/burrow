import type { PlayWorkspaceProps } from './PlayWorkspace';
import { ProgressBar } from '../components/ui/ProgressBar';
import { getLaunchStageTitle } from '../features/launcher/services/launcherService';
import { RestartGameButton } from './RestartGameButton';

function text(t: (key: string) => string, key: string, fallback: string) {
  const translated = t(key);
  return translated === key ? fallback : translated;
}

export function PlayLaunchStatus({ runtime, showProgress, t }: { runtime: PlayWorkspaceProps['runtime']; showProgress: boolean; t: (key: string) => string }) {
  const stageTitle = getLaunchStageTitle(runtime.launchStage, t);
  return (<>
        {runtime.statusText || runtime.statusDetail ? (
          <section className="border-y border-border/70 py-4" aria-live="polite" aria-label={text(t, 'dashboard.launch_status', 'Статус запуска')}>
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <p className="text-sm font-medium text-foreground">{runtime.statusText || stageTitle}</p>
              {runtime.canForceRestart && <RestartGameButton />}
            </div>
            {runtime.statusDetail ? <p className="mt-1 text-sm leading-6 text-secondary">{runtime.statusDetail}</p> : null}
            {showProgress ? <ProgressBar className="mt-4" value={runtime.progress ?? 0} valueLabel={`${Math.round(runtime.progress ?? 0)}%`} /> : null}
          </section>
        ) : null}

  </>);
}
