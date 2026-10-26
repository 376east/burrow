// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createTranslator } from '../../contexts/settings/i18n';
import { PlayConfigurationRetry } from '../PlayConfigurationRetry';

describe('PlayConfigurationRetry', () => {
  it('does not issue duplicate reads and becomes usable after a rejected recovery', async () => {
    let fail!: (error: Error) => void;
    const onRetry = vi.fn(() => new Promise<void>((_, reject) => { fail = reject; }));
    render(<PlayConfigurationRetry onRetry={onRetry} t={createTranslator('ru')} />);
    const button = screen.getByRole('button');
    fireEvent.click(button); fireEvent.click(button);
    expect(onRetry).toHaveBeenCalledOnce();
    expect(button).toHaveProperty('disabled', true);
    await act(async () => fail(new Error('Error: C:\\private\\config.json unavailable')));
    expect(screen.getByRole('alert').textContent).toContain('Не удалось обновить настройки');
    expect(screen.getByRole('alert').textContent).not.toContain('private');
    expect(button).toHaveProperty('disabled', false);
    onRetry.mockResolvedValueOnce(undefined);
    await act(async () => fireEvent.click(button));
    expect(onRetry).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
