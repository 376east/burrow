import { createHash } from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { DownloadManager } from '../downloadManager';
import { Agent } from 'undici';

const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true }); });

describe('real file-transfer checksum publication', () => {
  it('rejects a same-size corrupted response and publishes the verified fallback only', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'burrow-checksum-')); roots.push(root);
    const good = Buffer.from('verified download');
    const bad = Buffer.from('corrupt! download');
    const destination = path.join(root, 'content.bin');
    let partialWasPublished = false;
    const server = http.createServer((req, res) => {
      if (req.method === 'GET' && req.url === '/good' && fs.existsSync(destination)) partialWasPublished = true;
      const body = req.url === '/good' ? good : bad;
      res.writeHead(200, { 'content-length': body.length }); res.end(body);
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address(); if (!address || typeof address === 'string') throw new Error('missing server address');
    const origin = `http://127.0.0.1:${address.port}`;
    try {
      await DownloadManager.downloadSingle([`${origin}/bad`, `${origin}/good`], destination, {
        checksum: { algorithm: 'sha256', hash: createHash('sha256').update(good).digest('hex') },
        expectedTotal: good.length,
      });
      expect(fs.readFileSync(destination)).toEqual(good);
      expect(partialWasPublished).toBe(false);
      expect(fs.existsSync(`${destination}.pending`)).toBe(false);
    } finally { server.closeAllConnections(); await new Promise<void>((resolve) => server.close(() => resolve())); }
  });

  it('keeps cache probes inside the configured transport policy', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'burrow-checksum-')); roots.push(root);
    const destination = path.join(root, 'guarded.bin');
    let headRequests = 0;
    const server = http.createServer((req, res) => {
      if (req.method === 'HEAD') headRequests += 1;
      res.writeHead(200, { 'content-length': 4, etag: 'test' }); res.end('good');
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address(); if (!address || typeof address === 'string') throw new Error('missing server address');
    const dispatcher = new Agent();
    try {
      await DownloadManager.downloadSingle(`http://127.0.0.1:${address.port}/guarded`, destination, {
        dispatcher, checksum: { algorithm: 'sha1', hash: createHash('sha1').update('good').digest('hex') },
      });
      expect(fs.readFileSync(destination, 'utf8')).toBe('good');
      expect(headRequests).toBe(0);
    } finally {
      await dispatcher.close(); server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it('preserves an existing file when its replacement fails checksum validation', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'burrow-checksum-')); roots.push(root);
    const destination = path.join(root, 'existing.bin');
    fs.writeFileSync(destination, 'previous verified bytes');
    const server = http.createServer((_req, res) => { res.writeHead(200, { 'content-length': 3 }); res.end('bad'); });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address(); if (!address || typeof address === 'string') throw new Error('missing server address');
    try {
      await expect(DownloadManager.downloadSingle(`http://127.0.0.1:${address.port}/replacement`, destination, {
        checksum: { algorithm: 'sha1', hash: createHash('sha1').update('new verified bytes').digest('hex') },
      })).rejects.toThrow('checksum mismatch');
      expect(fs.readFileSync(destination, 'utf8')).toBe('previous verified bytes');
      expect(fs.existsSync(`${destination}.pending`)).toBe(false);
    } finally { server.closeAllConnections(); await new Promise<void>((resolve) => server.close(() => resolve())); }
  });

  it('rejects all bad candidates without leaving a final or pending file', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'burrow-checksum-')); roots.push(root);
    const server = http.createServer((_req, res) => { res.writeHead(200, { 'content-length': 3 }); res.end('bad'); });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address(); if (!address || typeof address === 'string') throw new Error('missing server address');
    const destination = path.join(root, 'rejected.bin');
    try {
      await expect(DownloadManager.downloadSingle(`http://127.0.0.1:${address.port}/bad`, destination, {
        checksum: { algorithm: 'sha1', hash: createHash('sha1').update('good').digest('hex') },
      })).rejects.toThrow('checksum mismatch');
      expect(fs.existsSync(destination)).toBe(false);
      expect(fs.existsSync(`${destination}.pending`)).toBe(false);
    } finally { server.closeAllConnections(); await new Promise<void>((resolve) => server.close(() => resolve())); }
  });
});
