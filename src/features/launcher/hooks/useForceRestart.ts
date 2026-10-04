import { useRef, useState } from 'react';
import { launcherIPC } from '../../../services/ipc/launcherIPC';
import { toRecoveryErrorMessage } from '../../../utils/displayError';

/** Keep process termination single-flight and surface failures without reloading. */
export function useForceRestart(t: (key: string) => string) {
  const inFlight = useRef(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  const restart = async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setPending(true);
    setError('');
    try {
      await launcherIPC.killAndRestart();
    } catch (failure) {
      setError(toRecoveryErrorMessage(failure, t('status.force_restart_failed')));
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  };

  return { restart, pending, error };
}
