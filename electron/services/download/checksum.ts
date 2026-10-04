import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';

export type DownloadChecksum = { algorithm: string; hash: string };

export async function validateDownloadChecksum(file: string, expected: DownloadChecksum): Promise<void> {
  const hash = createHash(expected.algorithm);
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  const actual = hash.digest('hex');
  if (actual.toLowerCase() !== expected.hash.toLowerCase()) {
    throw new Error(`Download checksum mismatch (${expected.algorithm}): expected ${expected.hash}, got ${actual}`);
  }
}

export async function hasValidDownloadChecksum(file: string, expected?: DownloadChecksum): Promise<boolean> {
  if (!expected) return true;
  try { await validateDownloadChecksum(file, expected); return true; } catch { return false; }
}
