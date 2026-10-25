import { useRef, useState } from 'react';
import { MAX_INSTANCE_MEMORY_GB } from '../contexts/instances/utils/configPatching';

type Props = {
  value: number;
  disabled: boolean;
  onChange: (gb: number) => Promise<void>;
  onSavingChange?: (saving: boolean) => void;
  t: (key: string) => string;
};

export function PlayMemoryControl({ value, disabled, onChange, onSavingChange, t }: Props) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);
  const pending = useRef(false);
  const current = Number.isFinite(value) ? Math.min(MAX_INSTANCE_MEMORY_GB, Math.max(1, value)) : 4;
  const maximum = Math.max(16, current);
  const change = async (requested: number) => {
    if (disabled || pending.current || !Number.isFinite(requested)) return;
    pending.current = true;
    setSaving(true);
    onSavingChange?.(true);
    setError(false);
    try { await onChange(Math.min(MAX_INSTANCE_MEMORY_GB, Math.max(1, requested))); }
    catch { setError(true); }
    finally { pending.current = false; setSaving(false); onSavingChange?.(false); }
  };
  return <div className="next-quick-memory">
    <label className="control-label">
      <span>{t('settings.ram')}<strong>{current} GB</strong></span>
      <input type="range" min={1} max={maximum} step={0.5} value={current}
        disabled={disabled || saving} aria-valuetext={`${current} GB`} aria-label={t('settings.ram')}
        onChange={event => { void change(Number(event.target.value)); }} />
    </label>
    <div className="next-memory-bounds" aria-hidden="true"><span>1 GB</span><span>{maximum} GB</span></div>
    <p className="helper-text">{t('play_workspace.memory_hint')}</p>
    {saving && <p className="helper-text" role="status">{t('play_workspace.memory_saving')}</p>}
    {error && <p className="text-xs text-red-500" role="alert">{t('play_workspace.memory_error')}</p>}
  </div>;
}
