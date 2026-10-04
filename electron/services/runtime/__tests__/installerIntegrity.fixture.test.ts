import { createHash } from 'node:crypto';
import { createServer, type Server, type ServerResponse } from 'node:http';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CancelledError } from '@xmcl/task';
import { MinecraftFolder, Version, type ResolvedLibrary, type ResolvedVersion } from '@xmcl/core';
import type { JavaRuntimeManifest } from '@xmcl/installer';
import { installDependenciesTask, installJavaRuntimeTask } from '../installerTasks';

const require = createRequire(import.meta.url);
const installedBundle = require.resolve('@xmcl/installer');
const cjs = require(installedBundle) as typeof import('@xmcl/installer');
const esm = await import(/* @vite-ignore */ pathToFileURL(join(dirname(installedBundle), 'index.mjs')).href) as typeof cjs;
const sha1 = (bytes: Buffer) => createHash('sha1').update(bytes).digest('hex');
const valid = Buffer.from('valid-fixture-content');
const corrupt = Buffer.from('wrong-fixture-content');

type Route = (response: ServerResponse) => void;
let server: Server;
let root: string;
let base: string;
let routes: Map<string, Route>;
let requests: string[];

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'burrow-installer-fixture-'));
  routes = new Map();
  requests = [];
  server = createServer((request, response) => {
    const route = request.url ?? '/';
    requests.push(route);
    const handler = routes.get(route);
    if (handler) handler(response);
    else { response.writeHead(404); response.end(); }
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Fixture server has no TCP address');
  base = `http://127.0.0.1:${address.port}`;
});
afterEach(async () => {
  server.closeAllConnections();
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  await rm(root, { recursive: true, force: true });
});

function serve(route: string, bytes: Buffer) {
  routes.set(route, (response) => {
    response.writeHead(200, { 'content-length': bytes.length });
    response.end(bytes);
  });
  return `${base}${route}`;
}
function library(path: string, url: string): ResolvedLibrary {
  const result = Version.resolveLibrary({ name: 'fixture:library:1', downloads: { artifact: { path, url, sha1: sha1(valid), size: valid.length } } });
  if (!result) throw new Error('Fixture library could not be resolved');
  return result;
}
function version(indexUrl: string, indexBytes: Buffer, logging?: ResolvedVersion['logging']): ResolvedVersion {
  return {
    id: 'fixture', minecraftVersion: 'fixture', minecraftDirectory: root, assets: 'fixture', downloads: {}, libraries: [],
    assetIndex: { id: 'fixture', url: indexUrl, sha1: sha1(indexBytes), size: indexBytes.length, totalSize: 0 }, logging,
    arguments: { game: [], jvm: [] }, mainClass: 'fixture.Main', minimumLauncherVersion: 0,
    releaseTime: '2026-01-01T00:00:00Z', time: '2026-01-01T00:00:00Z', type: 'release',
    javaVersion: { component: 'java-runtime-delta', majorVersion: 21 }, inheritances: ['fixture'], pathChain: [],
  };
}
function javaManifest(url: string): JavaRuntimeManifest {
  return { target: 'java-runtime-delta', version: { name: '21', released: '2026-01-01T00:00:00Z' }, files: {
    'bin/java.exe': { type: 'file', executable: true, downloads: { raw: { url, sha1: sha1(valid), size: valid.length } } },
  } };
}

for (const [mode, installer] of [['CJS', cjs], ['ESM', esm]] as const) {
  describe(`real ${mode} installer integrity`, () => {
    it('accepts verified libraries and rejects same-size corrupt responses after download', async () => {
      const url = serve('/library', corrupt);
      await expect(installer.installResolvedLibraries([library('fixture/library.jar', url)], root, { libraryHost: () => url })).rejects.toThrow();
      await expect(readFile(join(root, 'libraries/fixture/library.jar'))).rejects.toMatchObject({ code: 'ENOENT' });
      serve('/library', valid);
      await installer.installResolvedLibraries([library('fixture/library.jar', url)], root, { libraryHost: () => url });
      expect(await readFile(join(root, 'libraries/fixture/library.jar'))).toEqual(valid);
    });

    it('verifies assets and associates a rejected result with its original asset', async () => {
      const first = Buffer.from('first-valid-asset');
      const firstHash = sha1(first);
      const secondHash = sha1(valid);
      serve(`/${firstHash.slice(0, 2)}/${firstHash}`, first);
      serve(`/${secondHash.slice(0, 2)}/${secondHash}`, corrupt);
      const folder = MinecraftFolder.from(root);
      const assets = [{ name: 'first', hash: firstHash, size: first.length }, { name: 'second', hash: secondHash, size: valid.length }];
      try {
        await installer.installResolvedAssets(assets, folder, 'fixture', { assetsHost: base });
        throw new Error('Corrupt asset was accepted');
      } catch (error) {
        expect(error).toMatchObject({ issue: { assets: [{ name: 'second', hash: secondHash }] } });
      }
      expect(await readFile(folder.getAsset(firstHash))).toEqual(first);
      await expect(readFile(folder.getAsset(secondHash))).rejects.toMatchObject({ code: 'ENOENT' });
    });

    it('falls back once from a corrupt library mirror to a verified candidate', async () => {
      const badUrl = serve('/library-bad', corrupt);
      const goodUrl = serve('/library-good', valid);
      let transferred: { progress: number; total: number } | undefined;
      await installer.installResolvedLibraries([library('fixture/fallback.jar', badUrl)], root, {
        libraryHost: () => [badUrl, goodUrl],
        tracker: (event) => { if (event.phase === 'libraries') transferred = event.payload.progress; },
      });
      expect(transferred?.progress).toBe(valid.length);
      expect(transferred?.total).toBe(valid.length);
      expect(await readFile(join(root, 'libraries/fixture/fallback.jar'))).toEqual(valid);
      expect(requests).toEqual(['/library-bad', '/library-good']);
    });

    it('fails after each corrupt library candidate and preserves network fallback before SHA1 retry', async () => {
      const badUrl = serve('/bad-library', corrupt);
      const otherBadUrl = serve('/other-bad-library', corrupt);
      await expect(installer.installResolvedLibraries([library('fixture/all-bad.jar', badUrl)], root, { libraryHost: () => [badUrl, otherBadUrl] })).rejects.toThrow();
      expect(requests).toEqual(['/bad-library', '/other-bad-library']);
      await expect(readFile(join(root, 'libraries/fixture/all-bad.jar'))).rejects.toMatchObject({ code: 'ENOENT' });
      requests.length = 0;
      const goodUrl = serve('/good-library', valid);
      await installer.installResolvedLibraries([library('fixture/network-fallback.jar', badUrl)], root, { libraryHost: () => [`${base}/missing`, badUrl, goodUrl] });
      expect(await readFile(join(root, 'libraries/fixture/network-fallback.jar'))).toEqual(valid);
      expect(requests).toContain('/missing');
      expect(requests.filter((path) => path === '/good-library')).toHaveLength(1);
    });

    it('preserves HTTP fallback after SHA1 failure without retrying cancelled transfers', async () => {
      const badUrl = serve('/sha-bad', corrupt);
      const goodUrl = serve('/sha-good', valid);
      await installer.installResolvedLibraries([library('fixture/sha-network-fallback.jar', badUrl)], root, { libraryHost: () => [badUrl, `${base}/missing-middle`, goodUrl] });
      expect(await readFile(join(root, 'libraries/fixture/sha-network-fallback.jar'))).toEqual(valid);
      expect(requests).toEqual(['/sha-bad', '/missing-middle', '/sha-good']);
      requests.length = 0;
      const controller = new AbortController();
      let received!: () => void;
      const requested = new Promise<void>((resolve) => { received = resolve; });
      routes.set('/sha-slow', (response) => {
        response.writeHead(200, { 'content-length': valid.length }); response.write(valid.subarray(0, 1)); received();
      });
      const operation = installer.installResolvedLibraries([library('fixture/sha-cancel.jar', badUrl)], root, { signal: controller.signal, libraryHost: () => [badUrl, `${base}/sha-slow`, goodUrl] }).catch((error: unknown) => error);
      await requested;
      const reason = new Error('Fallback cancelled');
      controller.abort(reason);
      expect(await operation).toBe(reason);
      expect(requests).toEqual(['/sha-bad', '/sha-slow']);
    });

    it('falls back from a corrupt asset mirror and fails when all candidates are corrupt', async () => {
      const hash = sha1(valid);
      const path = `${hash.slice(0, 2)}/${hash}`;
      const folder = MinecraftFolder.from(root);
      const assets = [{ name: 'fallback', hash, size: valid.length }];
      serve(`/bad/${path}`, corrupt);
      serve(`/good/${path}`, valid);
      let transferred: { progress: number; total: number } | undefined;
      await installer.installResolvedAssets(assets, folder, 'fixture', {
        assetsHost: [`${base}/bad`, `${base}/good`],
        tracker: (event) => { if (event.phase === 'assets.assets') transferred = event.payload.progress; },
      });
      expect(transferred?.progress).toBe(valid.length);
      expect(transferred?.total).toBe(valid.length);
      expect(await readFile(folder.getAsset(hash))).toEqual(valid);
      expect(requests).toEqual([`/bad/${path}`, `/good/${path}`]);
      await rm(folder.getAsset(hash));
      requests.length = 0;
      serve(`/good/${path}`, corrupt);
      await expect(installer.installResolvedAssets(assets, folder, 'fixture', { assetsHost: [`${base}/bad`, `${base}/good`] })).rejects.toThrow();
      expect(requests).toEqual([`/bad/${path}`, `/good/${path}`]);
      await expect(readFile(folder.getAsset(hash))).rejects.toMatchObject({ code: 'ENOENT' });
    });

    it.each([false, true])('removes a completed unverified asset on checksum-time cancellation (retry=%s)', async (duringRetry) => {
      const hash = sha1(valid);
      const suffix = `${hash.slice(0, 2)}/${hash}`;
      const folder = MinecraftFolder.from(root);
      const assets = [{ name: 'cancelled-complete', hash, size: valid.length }];
      serve(`/primary/${suffix}`, corrupt);
      serve(`/secondary/${suffix}`, corrupt);
      const controller = new AbortController();
      let entered!: () => void;
      const checking = new Promise<void>((resolve) => { entered = resolve; });
      let release!: () => void;
      const gate = new Promise<void>((resolve) => { release = resolve; });
      let checks = 0;
      const checksum = async (file: string) => {
        const bytes = await readFile(file);
        if (++checks === (duringRetry ? 2 : 1)) { entered(); await gate; }
        return sha1(bytes);
      };
      const operation = installer.installResolvedAssets(assets, folder, 'fixture', { assetsHost: [`${base}/primary`, `${base}/secondary`], abortSignal: controller.signal, checksum }).catch((error: unknown) => error);
      await checking;
      const reason = new Error('Cancelled before SHA1 completed');
      controller.abort(reason);
      release();
      expect(await operation).toBe(reason);
      await expect(readFile(folder.getAsset(hash))).rejects.toMatchObject({ code: 'ENOENT' });
      serve(`/primary/${suffix}`, valid);
      requests.length = 0;
      await installer.installResolvedAssets(assets, folder, 'fixture', { assetsHost: [`${base}/primary`, `${base}/secondary`] });
      expect(requests).toEqual([`/primary/${suffix}`]);
      expect(await readFile(folder.getAsset(hash))).toEqual(valid);
    });

    it('validates asset-index raw bytes and preserves formatting during fetch fallback', async () => {
      const bytes = Buffer.from(' { "objects": {} }\n');
      let hits = 0;
      routes.set('/index', (response) => {
        const body = ++hits === 1 ? Buffer.from(' { "objects": [] }\n') : bytes;
        response.writeHead(200, { 'content-length': body.length }); response.end(body);
      });
      await installer.installAssets(version(`${base}/index`, bytes));
      expect(hits).toBeGreaterThanOrEqual(2);
      expect(await readFile(join(root, 'assets/indexes/fixture.json'))).toEqual(bytes);
    });

    it('repairs missing log configuration and rejects its corrupt download', async () => {
      const bytes = Buffer.from('{"objects":{}}');
      const indexUrl = serve('/index', bytes);
      const logUrl = serve('/log', corrupt);
      const logging = { client: { file: { id: 'fixture.xml', url: logUrl, sha1: sha1(valid), size: valid.length }, argument: '', type: 'log4j2-xml' } };
      await expect(installer.installAssets(version(indexUrl, bytes, logging))).rejects.toThrow('SHA1 mismatch');
      serve('/log', valid);
      await installer.installAssets(version(indexUrl, bytes, logging));
      expect(await readFile(MinecraftFolder.from(root).getLogConfig('fixture.xml'))).toEqual(valid);
    });

    it('rejects Java SHA1 mismatches and settled HTTP failures rather than reporting success', async () => {
      const manifest = javaManifest(serve('/java', corrupt));
      await expect(installer.installJavaRuntime({ destination: join(root, 'java'), manifest })).rejects.toThrow('Java runtime downloads failed');
      await expect(readFile(join(root, 'java/bin/java.exe'))).rejects.toMatchObject({ code: 'ENOENT' });
      manifest.files['bin/java.exe'] = { type: 'file', executable: true, downloads: { raw: { url: `${base}/missing`, sha1: sha1(valid), size: valid.length } } };
      await expect(installer.installJavaRuntime({ destination: join(root, 'java'), manifest })).rejects.toThrow('Java runtime downloads failed');
      manifest.files['bin/java.exe'] = javaManifest(serve('/java', valid)).files['bin/java.exe'];
      await installer.installJavaRuntime({ destination: join(root, 'java'), manifest });
      expect(await readFile(join(root, 'java/bin/java.exe'))).toEqual(valid);
    });

    it('verifies a Java JSON manifest before parsing its contents', async () => {
      const bytes = Buffer.from(JSON.stringify(javaManifest(`${base}/unused`)));
      const url = serve('/manifest', Buffer.from('{}'));
      await expect(installer.installJavaRuntimeWithJson({ destination: join(root, 'java'), target: {
        availability: { group: 0, progress: 100 }, manifest: { url, sha1: sha1(bytes), size: bytes.length },
        version: { name: '21', released: '2026-01-01T00:00:00Z' },
      } })).rejects.toThrow('SHA1 mismatch');
      expect(requests).not.toContain('/unused');
    });

    it('checks compressed Java data and the raw file after unpacking', async () => {
      const packed = Buffer.from('valid-compressed-fixture');
      const manifest = javaManifest(`${base}/raw`);
      const entry = manifest.files['bin/java.exe'];
      if (entry.type !== 'file') throw new Error('Expected file entry');
      entry.downloads.lzma = { url: serve('/compressed', corrupt), sha1: sha1(packed), size: packed.length };
      let unpacked = false;
      const unpackLzma = async (_source: string, destination: string) => {
        unpacked = true;
        const { writeFile } = await import('node:fs/promises');
        await writeFile(destination, corrupt);
      };
      await expect(installer.installJavaRuntime({ destination: join(root, 'java'), manifest, unpackLzma })).rejects.toThrow('Java runtime downloads failed');
      expect(unpacked).toBe(false);
      serve('/compressed', packed);
      await expect(installer.installJavaRuntime({ destination: join(root, 'java'), manifest, unpackLzma })).rejects.toThrow('SHA1 mismatch');
      expect(unpacked).toBe(true);
      await expect(readFile(join(root, 'java/bin/java.exe'))).rejects.toMatchObject({ code: 'ENOENT' });
    });

    it.each(['java', 'asset'] as const)('propagates %s abort without accepting a partial body', async (kind) => {
      let received!: () => void;
      const requested = new Promise<void>((resolve) => { received = resolve; });
      const hash = sha1(valid);
      const route = kind === 'java' ? '/slow' : `/${hash.slice(0, 2)}/${hash}`;
      routes.set(route, (response) => {
        response.writeHead(200, { 'content-length': valid.length }); response.write(valid.subarray(0, 1)); received();
      });
      const controller = new AbortController();
      const operation = kind === 'java'
        ? installer.installJavaRuntime({ destination: join(root, 'java'), manifest: javaManifest(`${base}/slow`), signal: controller.signal })
        : installer.installResolvedAssets([{ name: 'slow', hash, size: valid.length }], MinecraftFolder.from(root), 'fixture', { assetsHost: base, abortSignal: controller.signal });
      const finished = operation.catch((error: unknown) => error);
      await requested;
      const reason = new Error('Fixture cancelled');
      controller.abort(reason);
      expect(await finished).toBe(reason);
      expect(requests).toEqual([route]);
    });

    it('rejects a corrupt Forge installer before opening or executing its archive', async () => {
      const url = serve('/forge', corrupt);
      await expect(installer.installForge({ mcversion: '1.21', version: '51.0.1', installer: { path: url, sha1: sha1(valid) } }, root, { libraryHost: () => url })).rejects.toThrow('SHA1 mismatch');
    });
  });
}

describe('real installer task cancellation', () => {
  it('aborts a slow Java HTTP body, settles Task.cancel and makes no further requests', async () => {
    let received!: () => void;
    const requested = new Promise<void>((resolve) => { received = resolve; });
    routes.set('/slow-java', (response) => {
      response.writeHead(200, { 'content-length': valid.length });
      response.write(valid.subarray(0, 1));
      received();
    });
    const task = installJavaRuntimeTask({ destination: join(root, 'java'), manifest: javaManifest(`${base}/slow-java`) });
    const finished = task.startAndWait().catch((error: unknown) => error);
    await requested;
    await task.cancel();
    expect(await finished).toBeInstanceOf(CancelledError);
    const count = requests.length;
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(requests).toHaveLength(count);
  });

  it('passes task cancellation to the assets abortSignal and stops a slow asset body', async () => {
    const hash = sha1(valid);
    const indexBytes = Buffer.from(JSON.stringify({ objects: { slow: { hash, size: valid.length } } }));
    const indexUrl = serve('/index', indexBytes);
    let received!: () => void;
    const requested = new Promise<void>((resolve) => { received = resolve; });
    routes.set(`/${hash.slice(0, 2)}/${hash}`, (response) => {
      response.writeHead(200, { 'content-length': valid.length }); response.write(valid.subarray(0, 1)); received();
    });
    const task = installDependenciesTask(version(indexUrl, indexBytes), { assetsHost: base });
    const finished = task.startAndWait().catch((error: unknown) => error);
    await requested;
    await task.cancel();
    expect(await finished).toBeInstanceOf(CancelledError);
    const count = requests.length;
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(requests).toHaveLength(count);
  });

});
