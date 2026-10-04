import { RotateCcw } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { useSettings } from '../contexts/SettingsContext';
import { launcherIPC } from '../services/ipc/launcherIPC';
import { useForceRestart } from '../features/launcher/hooks/useForceRestart';

export function RestartGameButton() {
  const { t } = useSettings();
  const { restart, pending, error } = useForceRestart(t);
  if (!launcherIPC.has('killAndRestart')) return null;
  return (
    <div className="flex max-w-full flex-col items-end gap-1">
      <Button variant="ghost" size="sm" data-testid="restart-game-button" isLoading={pending} onClick={() => { void restart(); }}>
        <RotateCcw className="h-4 w-4" />
        {t(pending ? 'status.force_restart_pending' : 'status.force_restart')}
      </Button>
      {error && <p className="text-sm text-red-500" role="alert">{error}</p>}
    </div>
  );
}
