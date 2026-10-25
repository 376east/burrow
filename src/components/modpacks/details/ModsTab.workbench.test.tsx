// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ModEntry } from '@shared/types/mods';
import { ModsTab } from './ModsTab';

const { list, setEnabled, remove, toastError, confirm } = vi.hoisted(() => ({ list: vi.fn(), setEnabled: vi.fn(), remove: vi.fn(), toastError: vi.fn(), confirm: vi.fn() }));
vi.mock('../../../contexts/SettingsContext', () => ({ useSettings: () => ({ t: (key: string) => key }) }));
vi.mock('../../../contexts/ConfirmContext', () => ({ useConfirm: () => ({ confirm }) }));
vi.mock('../../../contexts/ToastContext', () => ({ useToast: () => ({ error: toastError }) }));
vi.mock('../../../services/ipc/instanceModsIPC', () => ({ instanceModsIPC: { list, setEnabled, remove } }));
vi.mock('../AddModModal', () => ({ AddModModal: () => null }));
const mod = (id: string, name: string): ModEntry => ({ id, name, version: '1', loaders: ['fabric'], deps: [], file: { path: `/mods/${id}.jar`, name: `${id}.jar`, size: 1, mtimeMs: 1 }, hash: { sha1: 'test' } });
describe('ModsTab workbench', () => {
  beforeEach(() => { vi.clearAllMocks(); list.mockResolvedValue([mod('sodium', 'Sodium'), mod('iris', 'Iris Shaders')]); setEnabled.mockResolvedValue(undefined); });
  it('filters real installed entries by name or filename without changing them', async () => {
    render(<ModsTab instanceId="classic" compact />);
    await screen.findByText('Sodium');
    const search = screen.getByRole('searchbox');
    fireEvent.change(search, { target: { value: ' IRIS.JAR ' } });
    expect(screen.queryByText('Sodium')).toBeNull(); expect(screen.getByText('Iris Shaders')).toBeTruthy();
    fireEvent.change(search, { target: { value: 'absent' } });
    expect(screen.getByText('modpacks.search_installed_empty')).toBeTruthy();
    fireEvent.change(search, { target: { value: '' } });
    expect(screen.getByText('Sodium')).toBeTruthy(); expect(setEnabled).not.toHaveBeenCalled();
  });
  it('keeps entries visible but prevents mutation during launch', async () => {
    render(<ModsTab instanceId="classic" compact showAddButton isReadOnly />);
    await screen.findByText('Sodium');
    expect(screen.getByRole('button', { name: 'modpacks.add_mod_btn' })).toHaveProperty('disabled', true);
    for (const button of screen.getAllByRole('button', { name: 'general.disable' })) {
      expect(button).toHaveProperty('disabled', true); fireEvent.click(button);
    }
    expect(setEnabled).not.toHaveBeenCalled(); expect(remove).not.toHaveBeenCalled();
  });
  it('blocks double toggles until IPC settles and restores truth on rejection', async () => {
    let reject!: (error: Error) => void;
    setEnabled.mockImplementation(() => new Promise<void>((_, fail) => { reject = fail; }));
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<ModsTab instanceId="classic" compact />);
    await screen.findByText('Sodium');
    const button = screen.getAllByRole('button', { name: 'general.disable' })[0];
    fireEvent.click(button); fireEvent.click(button);
    expect(setEnabled).toHaveBeenCalledExactlyOnceWith('classic', 'sodium.jar', false);
    await act(async () => reject(new Error('write failed')));
    expect(toastError).toHaveBeenCalledWith('modpacks.mod_toggle_error');
    expect(screen.getAllByRole('button', { name: 'general.disable' })).toHaveLength(2);
    errorLog.mockRestore();
  });
  it('does not remove a mod if launch starts while confirmation is open', async () => {
    let approve!: (value: boolean) => void;
    confirm.mockImplementation(() => new Promise<boolean>(resolve => { approve = resolve; }));
    const { rerender } = render(<ModsTab instanceId="classic" compact />);
    await screen.findByText('Sodium');
    fireEvent.click(screen.getAllByRole('button', { name: 'modpacks.remove_mod_confirm' })[0]);
    rerender(<ModsTab instanceId="classic" compact isReadOnly />);
    await act(async () => approve(true));
    expect(remove).not.toHaveBeenCalled();
  });
});
