import { EventEmitter } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { ChildProcess } from 'node:child_process';
import type { ResolvedVersion } from '@xmcl/core';
import { expect, it, vi } from 'vitest';
import { spawnMinecraft } from '../spawnMinecraft';

it.each([false, true])('checks cancellation after real XMCL prechecks, before native spawn: %s', async (cancelled) => {
  const root = await mkdtemp(join(tmpdir(), 'burrow-spawn-cancel-'));
  try {
    const version: ResolvedVersion = {
      id: 'fixture', minecraftVersion: 'fixture', minecraftDirectory: root, assets: 'fixture', downloads: {}, libraries: [],
      arguments: { game: [], jvm: [] }, mainClass: 'fixture.Main', minimumLauncherVersion: 0,
      releaseTime: '2026-01-01T00:00:00Z', time: '2026-01-01T00:00:00Z', type: 'release',
      javaVersion: { component: 'java-runtime-delta', majorVersion: 21 }, inheritances: ['fixture'], pathChain: [],
    };
    let finish!: () => void;
    let entered!: () => void;
    const precheck = new Promise<void>((resolve) => { finish = resolve; });
    const started = new Promise<void>((resolve) => { entered = resolve; });
    let cancel = false;
    const child = new EventEmitter() as ChildProcess;
    const nativeSpawn = vi.fn(() => child);
    const onSpawn = vi.fn();
    const launch = spawnMinecraft({
      requiredJava: 21, effectiveVmOptions: [], onLog: vi.fn(), onSpawn,
      checkPreparation: () => { if (cancel) throw new Error('cancelled before Java'); },
      launchOptions: { gamePath: root, javaPath: 'java', version, spawn: nativeSpawn,
        prechecks: [async () => { entered(); await precheck; }] },
    });
    await started;
    cancel = cancelled;
    const result = cancelled ? expect(launch).rejects.toThrow('cancelled before Java') : expect(launch).resolves.toBe(child);
    finish();
    await result;
    expect(nativeSpawn).toHaveBeenCalledTimes(cancelled ? 0 : 1);
    expect(onSpawn).toHaveBeenCalledTimes(cancelled ? 0 : 1);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
