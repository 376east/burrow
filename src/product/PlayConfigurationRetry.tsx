import { useRef, useState } from 'react';
import { Button } from '../components/ui/Button';
import { toRecoveryErrorMessage } from '../utils/displayError';

export function PlayConfigurationRetry({ onRetry, t }: { onRetry: () => Promise<void>; t: (key: string) => string }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const inFlight = useRef(false);
  const retry = async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setPending(true);
    setError('');
    try { await onRetry(); }
    catch (cause) { setError(toRecoveryErrorMessage(cause, t('play_workspace.retry_config_error'))); }
    finally { inFlight.current = false; setPending(false); }
  };
  return <div className="next-config-retry">
    <Button variant="secondary" size="sm" isLoading={pending} onClick={() => { void retry(); }}>
      {t(pending ? 'play_workspace.retry_config_pending' : 'operations.retry')}
    </Button>
    {error && <p className="text-sm text-red-500" role="alert">{error}</p>}
  </div>;
}
