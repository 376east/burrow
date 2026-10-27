import { RotateCcw } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { useSettings } from '../contexts/SettingsContext';
import { launcherIPC } from '../services/ipc/launcherIPC';
import { useForceRestart } from '../features/launcher/hooks/useForceRestart';

export function RestartGameButton({ preparing = false }: { preparing?: boolean }) {
  const { t } = useSettings();
  const { restart, pending, error } = useForceRestart(t);
  if (!launcherIPC.has('killAndRestart')) return null;
  return (
    <div className="flex max-w-full flex-col items-end gap-1">
      <Button variant="ghost" size="sm" data-testid="restart-game-button" isLoading={pending} onClick={() => { void restart(); }}>
        <RotateCcw className="h-4 w-4" />
        {t(preparing
          ? pending ? 'status.cancel_preparation_pending' : 'status.cancel_preparation'
          : pending ? 'status.force_restart_pending' : 'status.force_restart')}
      </Button>
      {preparing && pending && <p className="text-sm text-secondary" role="status">{t('status.cancel_preparation_detail')}</p>}
      {error && <p className="text-sm text-red-500" role="alert">{error}</p>}
    </div>
  );
}
