// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createTranslator } from '../../contexts/settings/i18n';
import { RestartGameButton } from '../RestartGameButton';

const restart = vi.fn();
const has = vi.fn();
vi.mock('../../services/ipc/launcherIPC', () => ({ launcherIPC: { has: () => has(), killAndRestart: () => restart() } }));
vi.mock('../../contexts/SettingsContext', () => ({ useSettings: () => ({ t: createTranslator('en') }) }));

describe('RestartGameButton', () => {
  beforeEach(() => { restart.mockReset(); has.mockReset().mockReturnValue(true); });

  it('disables repeated clicks until termination completes', async () => {
    let finish!: () => void;
    restart.mockImplementation(() => new Promise<void>((resolve) => { finish = resolve; }));
    render(<RestartGameButton />);
    const button = screen.getByRole('button', { name: 'Force restart' });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(button).toHaveProperty('disabled', true);
    expect(button.getAttribute('aria-busy')).toBe('true');
    expect(restart).toHaveBeenCalledTimes(1);
    await act(async () => finish());
    expect(button).toHaveProperty('disabled', false);
  });

  it('shows a failure, keeps the page usable and permits a successful retry', async () => {
    restart.mockRejectedValueOnce(new Error('Process did not stop')).mockResolvedValueOnce(undefined);
    render(<RestartGameButton />);
    fireEvent.click(screen.getByRole('button', { name: 'Force restart' }));
    expect((await screen.findByRole('alert')).textContent).toContain('Process did not stop');
    const button = screen.getByRole('button', { name: 'Force restart' });
    expect(button).toHaveProperty('disabled', false);
    fireEvent.click(button);
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
    expect(restart).toHaveBeenCalledTimes(2);
  });

  it('uses localized recovery copy for technical failures', async () => {
    restart.mockRejectedValue(new Error('Error at C:\\private\\launcher.js:42:3'));
    render(<RestartGameButton />);
    fireEvent.click(screen.getByRole('button', { name: 'Force restart' }));
    expect((await screen.findByRole('alert')).textContent).toBe('Could not stop the game and restart Burrow. Try again.');
  });

  it('hides the action when process restart is unavailable', () => {
    has.mockReturnValue(false);
    render(<RestartGameButton />);
    expect(screen.queryByRole('button')).toBeNull();
  });
});
