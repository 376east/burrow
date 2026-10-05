import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';
import { Entry } from 'yauzl';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ValidatedZip } from '../../../../security/archivePolicy';
import { writeArchiveTasks } from '../archiveExtraction';

vi.mock('electron', () => ({ app: { getPath: () => os.tmpdir() } }));

const roots: string[] = [];
afterEach(() => {
  vi.restoreAllMocks();
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

function target(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'burrow-archive-write-'));
  roots.push(root);
  return path.join(root, 'config', 'options.txt');
}

function archive(openReadStream = vi.fn(async () => Readable.from(['archive bytes']))): ValidatedZip {
  return { getEntries: () => [], getEntry: () => undefined, getData: async () => Buffer.alloc(0), openReadStream, close: () => {} };
}

describe('archive entry writes', () => {
  it('reports the exclusive-open error and preserves an existing file with a delayed source', async () => {
    const targetPath = target();
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.writeFileSync(targetPath, 'existing bytes');
    let collisionObserved!: () => void;
    const collision = new Promise<void>((resolve) => { collisionObserved = resolve; });
    const createWriteStream = fs.createWriteStream.bind(fs);
    // Force the former race: the output error arrives before openReadStream resolves.
    // Capture it so the regression reports the wrong result rather than crashing Vitest.
    vi.spyOn(fs, 'createWriteStream').mockImplementation((...args) => {
      const output = createWriteStream(...args);
      output.once('error', collisionObserved);
      return output;
    });
    const zip = archive(vi.fn(async () => {
      await collision;
      return Readable.from(['archive bytes']);
    }));
    const error = await writeArchiveTasks(zip, [{ entry: new Entry(), targetPath }]).catch((cause: unknown) => cause);
    expect.soft(error).toMatchObject({ code: 'EEXIST' });
    expect.soft(fs.existsSync(targetPath)).toBe(true);
    if (fs.existsSync(targetPath)) expect(fs.readFileSync(targetPath, 'utf8')).toBe('existing bytes');
    expect(zip.openReadStream).not.toHaveBeenCalled();
  });

  it('writes a new entry and closes its file', async () => {
    const targetPath = target();
    await writeArchiveTasks(archive(), [{ entry: new Entry(), targetPath }]);
    expect(fs.readFileSync(targetPath, 'utf8')).toBe('archive bytes');
    fs.unlinkSync(targetPath);
  });

  it('removes its new file when opening the source fails', async () => {
    const targetPath = target();
    const error = new Error('archive source failed');
    await expect(writeArchiveTasks(archive(vi.fn(async () => { throw error; })), [{ entry: new Entry(), targetPath }])).rejects.toBe(error);
    expect(fs.existsSync(targetPath)).toBe(false);
  });

  it('removes a partial new file and stops subsequent tasks after a source error', async () => {
    const targetPath = target();
    const error = new Error('archive read failed');
    const zip = archive(vi.fn(async () => Readable.from((async function* () {
      yield 'partial bytes';
      throw error;
    })())));
    await expect(writeArchiveTasks(zip, [
      { entry: new Entry(), targetPath },
      { entry: new Entry(), targetPath: `${targetPath}.next` },
    ])).rejects.toBe(error);
    expect(fs.existsSync(targetPath)).toBe(false);
    expect(fs.existsSync(`${targetPath}.next`)).toBe(false);
    expect(zip.openReadStream).toHaveBeenCalledTimes(1);
  });

  it('does not remove a target when opening the output fails', async () => {
    const targetPath = target();
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.writeFileSync(targetPath, 'existing bytes');
    const error = Object.assign(new Error('output denied'), { code: 'EACCES' });
    vi.spyOn(fs.promises, 'open').mockRejectedValueOnce(error);
    await expect(writeArchiveTasks(archive(), [{ entry: new Entry(), targetPath }])).rejects.toBe(error);
    expect(fs.readFileSync(targetPath, 'utf8')).toBe('existing bytes');
  });

  it('allows explicit overrides to replace existing content', async () => {
    const targetPath = target();
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.writeFileSync(targetPath, 'existing bytes');
    await writeArchiveTasks(archive(), [{ entry: new Entry(), targetPath, overwrite: true }]);
    expect(fs.readFileSync(targetPath, 'utf8')).toBe('archive bytes');
  });
});
