// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createTranslator } from '../../contexts/settings/i18n';
import { PlayLaunchStatus } from '../PlayLaunchStatus';
import { getPlayLaunchBlocker } from '../playReadiness';
import type { PlayWorkspaceProps } from '../PlayWorkspace';
vi.mock('../../contexts/SettingsContext', () => ({ useSettings: () => ({ getAccentStyles: () => ({ className: '', style: {} }) }) }));

const runtime: PlayWorkspaceProps['runtime'] = {
  isLaunching: false, launchStage: 'idle', statusText: '', statusDetail: '', canForceRestart: false,
  onLaunch: vi.fn(), showConsole: false, logs: [], logEndRef: { current: document.createElement('div') }, onCopyLogs: vi.fn(), iconPath: '',
};
const props = { runtime, blocker: null, showProgress: false, t: createTranslator('ru'), id: 'launch-status', onSettings: vi.fn(), onChooseVersion: vi.fn(), onChooseLoader: vi.fn() };
describe('PlayLaunchStatus', () => {
  it('describes readiness to prepare without claiming Java or game files are installed', () => {
    render(<PlayLaunchStatus {...props} />);
    expect(screen.getByRole('status').textContent).toContain('Можно начать подготовку');
    expect(screen.getByRole('status').textContent).toContain('недостающие файлы');
    expect(getPlayLaunchBlocker({ memorySaving: false, version: '', loaderSupported: true })).toBe('version');
    expect(getPlayLaunchBlocker({ memorySaving: true, version: '1.20.1', loaderSupported: true })).toBe('saving');
    expect(getPlayLaunchBlocker({ memorySaving: false, version: '1.20.1', loaderSupported: false })).toBe('loader');
  });
  it('shows real failure and recovery, with technical paths confined to deliberate log disclosure', () => {
    const onSettings = vi.fn();
    render(<PlayLaunchStatus {...props} onSettings={onSettings} runtime={{ ...runtime, launchStage: 'failed', statusDetail: 'Error: C:\\private\\runtime\\java.exe failed', logs: Array.from({ length: 105 }, (_, i) => `log-${i}`) }} />);
    const alert = screen.getByRole('alert');
    expect(alert.querySelector('p')?.textContent).not.toContain('private');
    expect(alert.textContent).toContain('Повторить запуск');
    fireEvent.click(screen.getByRole('button', { name: 'Проверить настройки игры' }));
    expect(onSettings).toHaveBeenCalledOnce();
    const log = alert.querySelector('pre')!;
    expect(log.textContent).not.toContain('log-0\n');
    expect(log.textContent).toContain('log-104');
  });
  it('uses the canonical stage for activity even without runtime text', () => {
    render(<PlayLaunchStatus {...props} runtime={{ ...runtime, isLaunching: true, launchStage: 'downloading', progress: 40 }} showProgress />);
    expect(screen.getByRole('status').textContent).toContain('40%');
    expect(screen.getByRole('status').getAttribute('data-state')).toBe('active');
  });
});
