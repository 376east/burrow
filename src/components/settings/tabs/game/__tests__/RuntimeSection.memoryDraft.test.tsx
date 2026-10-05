// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { GameTab } from '../../GameTab';

vi.mock('../../../../../services/ipc/javaRuntimeIPC', () => ({
  javaRuntimeIPC: {
    scan: vi.fn(async () => []),
    get: vi.fn(async () => ({ installationId: null })),
  },
}));

describe('GameTab memory draft ownership', () => {
  it('discards the previous instance draft even when both instances allocate the same memory', () => {
    const saveAlpha = vi.fn();
    const saveBeta = vi.fn();
    const props = {
      setMinMemoryGb: vi.fn(), setVmOptions: vi.fn(), setGameExtraArgs: vi.fn(),
      setGameResolution: vi.fn(), setAutoConnectServer: vi.fn(),
      t: (key: string) => key, getAccentStyles: () => ({}),
    };
    const alpha = { id: 'alpha', name: 'Alpha', runtime: { minecraft: '1.20.1' }, memory: { maxMb: 4096 } };
    const beta = { id: 'beta', name: 'Beta', runtime: { minecraft: '1.20.1' }, memory: { maxMb: 4096 } };
    const view = render(<GameTab {...props} modpackConfig={alpha} setMemoryGb={saveAlpha} />);
    let input = screen.getByRole('spinbutton', { name: 'Memory in GB' });
    fireEvent.change(input, { target: { value: '128' } });
    expect(input).toHaveProperty('value', '128');
    expect(saveAlpha).not.toHaveBeenCalled();

    view.rerender(<GameTab {...props} modpackConfig={beta} setMemoryGb={saveBeta} />);
    input = screen.getByRole('spinbutton', { name: 'Memory in GB' });
    expect(input).toHaveProperty('value', '4');
    fireEvent.blur(input);
    expect(saveBeta).toHaveBeenCalledWith(4);
    expect(saveAlpha).not.toHaveBeenCalled();

    fireEvent.change(input, { target: { value: '8' } });
    view.rerender(<GameTab {...props} modpackConfig={{ ...beta, name: 'Renamed' }} setMemoryGb={saveBeta} />);
    expect(input).toHaveProperty('value', '8');
    fireEvent.blur(input);
    expect(saveBeta).toHaveBeenLastCalledWith(8);
  });
});
