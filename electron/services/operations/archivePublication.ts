import path from 'node:path';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
export function digestFile(filePath: string): string {
  return createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

export function publishArchiveNoReplace(stagedPath: string, outputPath: string): void {
  fs.linkSync(stagedPath, outputPath);
  fsyncDirectory(path.dirname(outputPath));
  fs.unlinkSync(stagedPath);
  fsyncDirectory(path.dirname(stagedPath));
}

export function fsyncDirectory(directory: string): void {
  try {
    const descriptor = fs.openSync(directory, 'r');
    try { fs.fsyncSync(descriptor); } finally { fs.closeSync(descriptor); }
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (!['EINVAL', 'ENOTSUP', 'EPERM', 'EISDIR'].includes(code ?? '')) throw error;
  }
}

export function validateClosedArchive(stagedPath: string): void {
  const stats = fs.statSync(stagedPath);
  if (!stats.isFile() || stats.size === 0) throw new Error('Staged archive output is invalid');
  const descriptor = fs.openSync(stagedPath, 'r');
  try {
    const header = Buffer.alloc(4);
    if (fs.readSync(descriptor, header, 0, header.length, 0) !== header.length || !header.subarray(0, 2).equals(Buffer.from('PK'))) {
      throw new Error('Staged archive output is invalid');
    }
  } finally {
    fs.closeSync(descriptor);
  }
}
