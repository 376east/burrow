import { execFile } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { promisify } from 'node:util';
import ts from 'typescript';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CancelledError, TaskState } from '@xmcl/task';
import type { ResolvedVersion } from '@xmcl/core';
import type { CompleteOptions, InstallJavaRuntimeOptions } from '@xmcl/installer';
import {
  installTask, installDependenciesTask, installForgeTask, installNeoForgedTask, installJavaRuntimeTask,
} from '../installerTasks';

const api = vi.hoisted(() => ({
  installMinecraft: vi.fn(), completeInstallation: vi.fn(), installForge: vi.fn(),
  installNeoForge: vi.fn(), installJavaRuntime: vi.fn(),
}));
vi.mock('@xmcl/installer', () => api);

const resolved = { id: '1.21', minecraftDirectory: '/minecraft' } as ResolvedVersion;

beforeEach(() => {
  vi.resetAllMocks();
  api.installMinecraft.mockResolvedValue(resolved);
  api.completeInstallation.mockResolvedValue(undefined);
  api.installForge.mockResolvedValue('1.21-forge');
  api.installNeoForge.mockResolvedValue('1.21-neoforge');
  api.installJavaRuntime.mockResolvedValue(undefined);
});
afterEach(() => vi.useRealTimers());

describe('promise installer Task adapters', () => {
  it('installs vanilla metadata then completes its resolved runtime with mirror options', async () => {
    const metadata = { id: '1.21', url: 'https://manifest/version.json' };
    const options = { mavenHost: 'https://mirror/libraries', assetsHost: 'https://mirror/assets' };
    const task = installTask(metadata, '/minecraft', options);
    expect(api.installMinecraft).not.toHaveBeenCalled();
    expect(await task.startAndWait()).toBe(resolved);
    expect(api.installMinecraft).toHaveBeenCalledWith(metadata, '/minecraft', expect.objectContaining(options));
    expect(api.completeInstallation).toHaveBeenCalledWith(resolved, expect.objectContaining(options));
    expect(api.installMinecraft.mock.invocationCallOrder[0]).toBeLessThan(api.completeInstallation.mock.invocationCallOrder[0]);
  });

  it('preserves Forge, NeoForge, dependencies and Java return values and options', async () => {
    const forgeVersion = { mcversion: '1.21', version: '51.0.1' };
    expect(await installForgeTask(forgeVersion, '/minecraft', { java: '/java' }).startAndWait()).toBe('1.21-forge');
    expect(api.installForge).toHaveBeenCalledWith(forgeVersion, '/minecraft', expect.objectContaining({ java: '/java' }));
    expect(await installNeoForgedTask('neoforge', '21.0.1', '/minecraft', { java: '/java' }).startAndWait()).toBe('1.21-neoforge');
    expect(api.installNeoForge).toHaveBeenCalledWith('neoforge', '21.0.1', '/minecraft', expect.objectContaining({ java: '/java' }));
    await installDependenciesTask(resolved, { assetsHost: 'https://mirror/assets' }).startAndWait();
    expect(api.completeInstallation).toHaveBeenCalledWith(resolved, expect.objectContaining({ assetsHost: 'https://mirror/assets' }));
    const javaOptions: InstallJavaRuntimeOptions = { destination: '/java', manifest: { files: {}, target: 'java-runtime-delta', version: { name: '21', released: '2026-01-01T00:00:00Z' } } };
    await installJavaRuntimeTask(javaOptions).startAndWait();
    expect(api.installJavaRuntime).toHaveBeenCalledWith(expect.objectContaining(javaOptions));
  });

  it('polls mutable progress handles, forwards trackers and clears its interval on success', async () => {
    vi.useFakeTimers();
    const progress = { progress: 0, total: 100, url: 'https://mirror/file' };
    let finish!: () => void;
    const finished = new Promise<void>((resolve) => { finish = resolve; });
    api.completeInstallation.mockImplementation(async (_version, options: CompleteOptions) => {
      options.tracker?.({ phase: 'libraries', payload: { count: 1, progress } });
      await finished;
    });
    const externalTracker = vi.fn();
    const updates: number[] = [];
    const task = installDependenciesTask(resolved, { tracker: externalTracker });
    const waiting = task.startAndWait({ onUpdate: (current) => updates.push(current.progress) });
    await vi.advanceTimersByTimeAsync(0);
    progress.progress = 60;
    await vi.advanceTimersByTimeAsync(250);
    expect(updates).toContain(60);
    expect(task.name).toBe('library');
    expect(externalTracker).toHaveBeenCalledOnce();
    finish();
    await waiting;
    expect(vi.getTimerCount()).toBe(0);
  });

  it('aborts an active download through Task.cancel and clears polling', async () => {
    vi.useFakeTimers();
    let activeSignal: AbortSignal | undefined;
    api.completeInstallation.mockImplementation((_version, options: CompleteOptions) => new Promise<void>((_resolve, reject) => {
      activeSignal = options.signal;
      activeSignal?.addEventListener('abort', () => reject(activeSignal?.reason), { once: true });
    }));
    const task = installDependenciesTask(resolved);
    const cancelled = task.startAndWait().catch((error: unknown) => error);
    await vi.advanceTimersByTimeAsync(0);
    await task.cancel();
    expect(activeSignal?.aborted).toBe(true);
    expect(await cancelled).toBeInstanceOf(CancelledError);
    expect(task.state).toBe(TaskState.Cancelled);
    expect(api.completeInstallation).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('cancels an idle task without invoking the installer or waiting for an abort acknowledgement', async () => {
    const task = installDependenciesTask(resolved);
    const cancelled = task.wait().catch((error: unknown) => error);
    await task.cancel();
    expect(await cancelled).toBeInstanceOf(CancelledError);
    expect(task.state).toBe(TaskState.Cancelled);
    expect(api.completeInstallation).not.toHaveBeenCalled();
  });

  it('forwards external cancellation without retrying the aborted installation', async () => {
    const controller = new AbortController();
    api.completeInstallation.mockImplementation((_version, options: CompleteOptions) => new Promise<void>((_resolve, reject) => {
      options.signal?.addEventListener('abort', () => reject(options.signal?.reason), { once: true });
      controller.abort(new Error('Caller cancelled'));
    }));
    await expect(installDependenciesTask(resolved, { signal: controller.signal }).startAndWait()).rejects.toThrow('Caller cancelled');
    expect(api.completeInstallation).toHaveBeenCalledOnce();
  });

  it('merges an external assets abortSignal into both installer cancellation options', async () => {
    const controller = new AbortController();
    api.completeInstallation.mockImplementation((_version, options: CompleteOptions) => new Promise<void>((_resolve, reject) => {
      expect(options.signal).toBe(options.abortSignal);
      options.abortSignal?.addEventListener('abort', () => reject(options.abortSignal?.reason), { once: true });
      controller.abort(new Error('Assets cancelled'));
    }));
    await expect(installDependenciesTask(resolved, { abortSignal: controller.signal }).startAndWait()).rejects.toThrow('Assets cancelled');
    expect(api.completeInstallation).toHaveBeenCalledOnce();
  });

  it('does not complete dependencies after metadata failure and releases polling on errors', async () => {
    vi.useFakeTimers();
    api.installMinecraft.mockRejectedValue(new Error('Invalid manifest'));
    await expect(installTask({ id: '1.21', url: 'https://manifest/version.json' }, '/minecraft').startAndWait()).rejects.toThrow('Invalid manifest');
    expect(api.completeInstallation).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
});


describe('native Node ESM installer adapter', () => {
  it('completes verified work and cancels a real transfer using CommonJS Task exports', async () => {
    const adapter = ts.transpileModule(readFileSync(new URL('../installerTasks.ts', import.meta.url), 'utf8'), {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
    }).outputText;
    const fixture = `
      import assert from 'node:assert/strict';
      import { createServer } from 'node:http';
      import { createHash } from 'node:crypto';
      import { mkdtemp, readFile, rm } from 'node:fs/promises';
      import { tmpdir } from 'node:os';
      import { resolve, join, sep } from 'node:path';
      const root = await mkdtemp(join(tmpdir(), 'burrow-native-adapter-'));
      assert.ok(resolve(root).startsWith(resolve(tmpdir()) + sep + 'burrow-native-adapter-'));
      const bytes = Buffer.from('verified Java fixture');
      let received;
      const requested = new Promise(resolve => { received = resolve; });
      const server = createServer((request, response) => {
        response.writeHead(200, { 'content-length': bytes.length });
        if (request.url === '/slow') { response.write(bytes.subarray(0, 1)); received(); }
        else response.end(bytes);
      });
      try {
        await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
        const base = 'http://127.0.0.1:' + server.address().port;
        const manifest = route => ({ files: { 'bin/java': { type: 'file', executable: true, downloads: {
          raw: { url: base + route, sha1: createHash('sha1').update(bytes).digest('hex'), size: bytes.length },
        } } } });
        const successful = installJavaRuntimeTask({ destination: join(root, 'verified'), manifest: manifest('/good') });
        await successful.startAndWait();
        assert.equal(successful.state, TaskState.Succeed);
        assert.deepEqual(await readFile(join(root, 'verified/bin/java')), bytes);
        const cancelled = installJavaRuntimeTask({ destination: join(root, 'cancelled'), manifest: manifest('/slow') });
        const finished = cancelled.startAndWait().catch(error => error);
        await requested;
        await cancelled.cancel();
        assert.ok(await finished instanceof CancelledError);
        assert.equal(cancelled.state, TaskState.Cancelled);
        console.log('NATIVE_ADAPTER_PASS');
      } finally {
        server.closeAllConnections();
        await new Promise(resolve => server.close(resolve));
        await rm(root, { recursive: true, force: true });
      }
    `;
    const { stdout } = await promisify(execFile)(process.execPath, ['--input-type=module', '--eval', adapter + fixture], {
      cwd: process.cwd(), timeout: 4_000,
    });
    expect(stdout).toContain('NATIVE_ADAPTER_PASS');
  });
});
