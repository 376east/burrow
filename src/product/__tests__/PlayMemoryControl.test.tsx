// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PlayMemoryControl } from '../PlayMemoryControl';

const t = (key: string) => key;
describe('PlayMemoryControl', () => {
  it('keeps the canonical value and blocks duplicate writes while persistence is pending', async () => {
    let finish!: () => void;
    const onChange = vi.fn(() => new Promise<void>(resolve => { finish = resolve; }));
    const { rerender } = render(<PlayMemoryControl value={4} disabled={false} onChange={onChange} t={t} />);
    const slider = screen.getByRole('slider');
    fireEvent.change(slider, { target: { value: '8' } });
    fireEvent.change(slider, { target: { value: '12' } });
    expect(onChange).toHaveBeenCalledExactlyOnceWith(8);
    expect(slider).toHaveProperty('disabled', true);
    await act(async () => finish());
    rerender(<PlayMemoryControl value={8} disabled={false} onChange={onChange} t={t} />);
    expect(slider).toHaveProperty('value', '8');
    expect(slider).toHaveProperty('disabled', false);
  });
  it('retains non-preset memory and makes persistence failure visible', async () => {
    const onChange = vi.fn().mockRejectedValue(new Error('disk unavailable'));
    render(<PlayMemoryControl value={64} disabled={false} onChange={onChange} t={t} />);
    const slider = screen.getByRole('slider');
    expect(slider.getAttribute('max')).toBe('64');
    fireEvent.change(slider, { target: { value: '32' } });
    expect((await screen.findByRole('alert')).textContent).toContain('play_workspace.memory_error');
    expect(slider).toHaveProperty('value', '64');
  });
  it('does not persist changes while the real launcher owns configuration', () => {
    const onChange = vi.fn();
    render(<PlayMemoryControl value={6} disabled onChange={onChange} t={t} />);
    fireEvent.change(screen.getByRole('slider'), { target: { value: '8' } });
    expect(onChange).not.toHaveBeenCalled();
  });
});
