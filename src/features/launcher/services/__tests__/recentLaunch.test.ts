// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadRecentLaunch } from '../launcherService';

const legacyKey = 'simple_play_lastGame';
const currentKey = 'lastGame_classic';
const recent = { versionId: '1.20.1', nickname: 'Steve', loader: 'fabric', launchVersion: '1.20.1-Fabric', timestamp: 1700000000000 };

describe('recent launch migration', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it('moves a valid classic launch after persisting the new key', () => {
    localStorage.setItem(legacyKey, JSON.stringify(recent));
    expect(loadRecentLaunch('classic')).toEqual(recent);
    expect(JSON.parse(localStorage.getItem(currentKey)!)).toEqual(recent);
    expect(localStorage.getItem(legacyKey)).toBeNull();
  });

  it('keeps the source and returns the launch when storage refuses the replacement', () => {
    const raw = JSON.stringify(recent);
    localStorage.setItem(legacyKey, raw);
    const write = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('Full', 'QuotaExceededError'); });
    expect(loadRecentLaunch('classic')).toEqual(recent);
    expect(localStorage.getItem(legacyKey)).toBe(raw);
    expect(localStorage.getItem(currentKey)).toBeNull();
    write.mockRestore();
    expect(loadRecentLaunch('classic')).toEqual(recent);
    expect(localStorage.getItem(currentKey)).toBe(raw);
    expect(localStorage.getItem(legacyKey)).toBeNull();
  });

  it.each(['{', JSON.stringify({ timestamp: 1 }), JSON.stringify({ ...recent, loader: 'quilt' }), JSON.stringify({ ...recent, versionId: '' }), JSON.stringify({ ...recent, launchVersion: '' })])('leaves malformed compatibility data intact: %s', (raw) => {
    localStorage.setItem(legacyKey, raw);
    expect(loadRecentLaunch('classic')).toBeNull();
    expect(localStorage.getItem(legacyKey)).toBe(raw);
    expect(localStorage.getItem(currentKey)).toBeNull();
  });

  it('prefers current history and never migrates another instance', () => {
    localStorage.setItem(currentKey, JSON.stringify(recent));
    localStorage.setItem(legacyKey, JSON.stringify({ ...recent, nickname: 'Alex' }));
    expect(loadRecentLaunch('classic')).toEqual(recent);
    expect(loadRecentLaunch('other-pack')).toBeNull();
    expect(localStorage.getItem(legacyKey)).not.toBeNull();
  });

  it('keeps both valid copies when removal fails after the write', () => {
    const raw = JSON.stringify(recent);
    localStorage.setItem(legacyKey, raw);
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new DOMException('Blocked', 'SecurityError'); });
    expect(loadRecentLaunch('classic')).toEqual(recent);
    expect(localStorage.getItem(currentKey)).toBe(raw);
    expect(localStorage.getItem(legacyKey)).toBe(raw);
  });

  it('returns null when storage itself is inaccessible', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new DOMException('Blocked', 'SecurityError'); });
    expect(loadRecentLaunch('classic')).toBeNull();
  });
});
