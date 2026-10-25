// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PlayArtwork } from '../PlayArtwork';

const scene = vi.hoisted(() => ({ render: vi.fn(), fail: false }));
vi.mock('../PlayWorldIllustration', () => ({ default: () => { scene.render(); if (scene.fail) throw new Error('GPU unavailable'); return <div data-testid="world-loaded" />; } }));
const t = (key: string) => key;
let preferenceChanged: (() => void) | undefined;
let matches = false;
beforeEach(() => {
  matches = false; scene.fail = false; scene.render.mockClear();
  vi.stubGlobal('matchMedia', vi.fn(() => ({ get matches() { return matches; }, addEventListener: (_: string, change: () => void) => { preferenceChanged = change; }, removeEventListener: vi.fn() })));
});
afterEach(() => vi.unstubAllGlobals());
describe('PlayArtwork', () => {
  it('keeps the GPU subtree unmounted until requested and unmounts it on close', async () => {
    render(<PlayArtwork disableAnimations={false} t={t} />);
    expect(scene.render).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'play_workspace.world_open' }));
    expect(await screen.findByTestId('world-loaded')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'play_workspace.world_close' }));
    expect(screen.queryByTestId('world-loaded')).toBeNull();
    expect(screen.getByRole('button').getAttribute('aria-expanded')).toBe('false');
  });
  it('uses the static illustration when the app disables animation', () => {
    render(<PlayArtwork disableAnimations t={t} />);
    expect(screen.getByRole('button')).toHaveProperty('disabled', true);
    expect(screen.getByText('play_workspace.world_static')).toBeTruthy();
    expect(scene.render).not.toHaveBeenCalled();
  });
  it('immediately removes the open scene when reduced motion is enabled live', async () => {
    render(<PlayArtwork disableAnimations={false} t={t} />);
    fireEvent.click(screen.getByRole('button'));
    await screen.findByTestId('world-loaded');
    act(() => { matches = true; preferenceChanged?.(); });
    expect(screen.queryByTestId('world-loaded')).toBeNull();
    expect(screen.getByRole('button')).toHaveProperty('disabled', true);
  });
  it('retains a usable static fallback after the scene fails', async () => {
    scene.fail = true;
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<PlayArtwork disableAnimations={false} t={t} />);
    fireEvent.click(screen.getByRole('button'));
    expect(await screen.findByText('play_workspace.world_unavailable')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'play_workspace.world_close' }));
    expect(screen.getByRole('button', { name: 'play_workspace.world_open' })).toHaveProperty('disabled', false);
    errorLog.mockRestore();
  });
});
