// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PlayWorldIllustration from '../PlayWorldIllustration';

vi.mock('@react-three/fiber', () => ({ Canvas: ({ frameloop }: { frameloop: string }) => <div data-testid="canvas-mode" data-mode={frameloop} />, useThree: vi.fn() }));
vi.mock('@react-three/drei', () => ({ OrbitControls: () => null }));
const t = (key: string) => key;
let intersect: (entries: Array<{ isIntersecting: boolean }>) => void;
let hidden = false;
const originalHidden = Object.getOwnPropertyDescriptor(document, 'hidden');
const disconnect = vi.fn();
beforeEach(() => {
  hidden = false; disconnect.mockClear();
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
  vi.stubGlobal('IntersectionObserver', class { constructor(callback: typeof intersect) { intersect = callback; } observe() {} disconnect = disconnect; });
});
afterEach(() => { vi.unstubAllGlobals(); if (originalHidden) Object.defineProperty(document, 'hidden', originalHidden); else Reflect.deleteProperty(document, 'hidden'); });
describe('PlayWorldIllustration', () => {
  it('renders on demand only while both visible and intersecting and cleans observers', () => {
    const { unmount } = render(<PlayWorldIllustration fallback={<div>fallback</div>} t={t} />);
    const mode = () => screen.getByTestId('canvas-mode').getAttribute('data-mode');
    expect(mode()).toBe('demand');
    act(() => intersect([{ isIntersecting: false }])); expect(mode()).toBe('never');
    act(() => document.dispatchEvent(new Event('visibilitychange'))); expect(mode()).toBe('never');
    act(() => { hidden = true; intersect([{ isIntersecting: true }]); document.dispatchEvent(new Event('visibilitychange')); }); expect(mode()).toBe('never');
    act(() => { hidden = false; document.dispatchEvent(new Event('visibilitychange')); }); expect(mode()).toBe('demand');
    unmount(); expect(disconnect).toHaveBeenCalledOnce();
  });
  it('offers ordinary keyboard-accessible day/night, biome and camera controls', () => {
    render(<PlayWorldIllustration fallback={<div>fallback</div>} t={t} />);
    fireEvent.click(screen.getByRole('button', { name: 'play_workspace.world_night' }));
    expect(screen.getByRole('button', { name: 'play_workspace.world_day' }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'play_workspace.world_snow' }));
    expect(screen.getByRole('button', { name: 'play_workspace.world_green' }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'play_workspace.world_rotate' }));
    expect(screen.getByTestId('canvas-mode').getAttribute('data-mode')).toBe('demand');
  });
});
