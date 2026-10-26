import type { PlayWorkspaceProps } from './PlayWorkspace';
import { ProgressBar } from '../components/ui/ProgressBar';
import { Button } from '../components/ui/Button';
import { getLaunchStageTitle } from '../features/launcher/services/launcherService';
import { toRecoveryErrorMessage } from '../utils/displayError';
import { RestartGameButton } from './RestartGameButton';

import type { PlayLaunchBlocker } from './playReadiness';
type Translate = (key: string) => string;

export function PlayLaunchStatus({ runtime, showProgress, t, blocker, id, onSettings, onChooseVersion, onChooseLoader }: {
  runtime: PlayWorkspaceProps['runtime']; showProgress: boolean; t: Translate; blocker: PlayLaunchBlocker; id: string;
  onSettings: () => void; onChooseVersion: () => void; onChooseLoader: () => void;
}) {
  const failed = runtime.launchStage === 'failed';
  const state = blocker ?? (failed ? 'failed' : runtime.isLaunching ? 'active' : 'ready');
  const title = state === 'active' ? getLaunchStageTitle(runtime.launchStage, t) : t(`play_workspace.readiness_${state}`);
  const fallback = t(`play_workspace.readiness_${state}_detail`);
  const detail = blocker ? fallback : toRecoveryErrorMessage(runtime.statusDetail || runtime.statusText, fallback);
  return <section id={id} className="next-launch-readiness" data-state={state} role={failed && !blocker ? 'alert' : 'status'} aria-atomic="true" aria-label={t('dashboard.launch_status')}>
    <div className="next-launch-readiness-heading"><h3>{title}</h3>{runtime.canForceRestart && <RestartGameButton />}</div>
    <p>{detail}</p>
    {state === 'failed' && <>
      <p className="next-launch-next-step">{t('play_workspace.failure_next_step')}</p>
      <Button variant="secondary" size="sm" onClick={onSettings}>{t('play_workspace.review_runtime')}</Button>
      {runtime.logs.length > 0 && <details className="next-launch-diagnostics"><summary>{t('play_workspace.failure_log')}</summary><pre>{runtime.logs.slice(-100).join('\n')}</pre></details>}
    </>}
    {state === 'version' && <Button variant="secondary" size="sm" onClick={onChooseVersion}>{t('play_workspace.choose_version')}</Button>}
    {state === 'loader' && <Button variant="secondary" size="sm" onClick={onChooseLoader}>{t('play_workspace.choose_loader')}</Button>}
    {showProgress && <ProgressBar value={runtime.progress ?? 0} valueLabel={`${Math.round(runtime.progress ?? 0)}%`} />}
  </section>;
}
