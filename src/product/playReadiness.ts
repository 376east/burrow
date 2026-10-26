import { getLaunchActionLabel, type LaunchStage } from '../features/launcher/services/launcherService';

type Translate = (key: string) => string;
export type PlayLaunchBlocker = 'saving' | 'version' | 'loader' | null;
export function getPlayLaunchBlocker({ memorySaving, version, loaderSupported }: { memorySaving: boolean; version: string; loaderSupported: boolean }): PlayLaunchBlocker {
  if (memorySaving) return 'saving';
  if (!version.trim()) return 'version';
  if (!loaderSupported) return 'loader';
  return null;
}
export function getPlayLaunchLabel(stage: LaunchStage, t: Translate) {
  return stage === 'failed' ? t('play_workspace.retry_launch') : getLaunchActionLabel(stage, t);
}

