import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { pipeline } from 'node:stream/promises';
import { assertAbsolutePath, assertRelativePath, resolvePathWithinRoot } from '../../../security/pathGuards';
import { resolveApprovedInstancePath } from '../../instances/paths';
import type { ValidatedZip, ValidatedZipEntry } from '../../../security/archivePolicy';
export type ArchiveWriteTask = {
  entry: ValidatedZipEntry;
  targetPath: string;
  overwrite?: boolean;
};

export function normalizeArchiveRelativePath(value: string, label: string): string {
  const trimmedValue = value.replace(/[\\/]+$/, '');
  if (!trimmedValue) throw new Error(`${label} must stay inside the launcher root`);
  return assertRelativePath(trimmedValue, label).split(path.sep).join('/');
}

export function collectZipExtractionTasks(zip: ValidatedZip, targetDir: string): ArchiveWriteTask[] {
  const safeTargetDir = resolveApprovedInstancePath(targetDir);
  const tasks: ArchiveWriteTask[] = [];
  for (const entry of zip.getEntries()) {
    const normalizedEntryPath = normalizeArchiveRelativePath(entry.fileName, 'Archive entry path');
    if (entry.fileName.endsWith('/')) continue;
    tasks.push({
      entry,
      targetPath: resolvePathWithinRoot(safeTargetDir, normalizedEntryPath, `Archive entry "${entry.fileName}"`),
    });
  }
  return tasks;
}

export function buildZipEntryLookup(zip: ValidatedZip): Map<string, ValidatedZipEntry> {
  const entryMap = new Map<string, ValidatedZipEntry>();
  for (const entry of zip.getEntries()) {
    const normalizedEntryPath = normalizeArchiveRelativePath(entry.fileName, 'Archive entry path');
    const existingEntry = entryMap.get(normalizedEntryPath);
    if (!existingEntry || existingEntry.fileName.endsWith('/')) entryMap.set(normalizedEntryPath, entry);
  }
  return entryMap;
}

export async function writeArchiveTasks(zip: ValidatedZip, tasks: ArchiveWriteTask[]): Promise<void> {
  for (const task of tasks) {
    await fs.promises.mkdir(path.dirname(task.targetPath), { recursive: true });
    const outputFile = await fs.promises.open(task.targetPath, task.overwrite ? 'w' : 'wx');
    let completed = false;
    try {
      const input = await zip.openReadStream(task.entry);
      await pipeline(input, outputFile.createWriteStream());
      completed = true;
    } finally {
      await outputFile.close();
      if (!completed && !task.overwrite) await fs.promises.rm(task.targetPath, { force: true });
    }
  }
}

export async function writeArchiveEntry(zip: ValidatedZip, entry: ValidatedZipEntry, targetPath: string): Promise<void> {
  await writeArchiveTasks(zip, [{ entry, targetPath }]);
}

export async function verifyManifestFile(filePath: string, label: string, hashes: { sha1?: string; sha512?: string } | undefined): Promise<void> {
  const checks = ([['sha1', hashes?.sha1], ['sha512', hashes?.sha512]] as const)
    .flatMap(([algorithm, expected]) => expected ? [{ hash: crypto.createHash(algorithm), expected }] : []);
  if (checks.length === 0) return;
  for await (const chunk of fs.createReadStream(filePath)) {
    for (const { hash } of checks) hash.update(chunk);
  }
  for (const { hash, expected } of checks) {
    if (hash.digest('hex').toLowerCase() !== expected.toLowerCase()) {
      throw new Error(`Bundled Modrinth file hash mismatch: ${label}`);
    }
  }
}

export async function extractOverrides(zip: ValidatedZip, targetDir: string, zipPath: string): Promise<void> {
  const safeTargetDir = assertAbsolutePath(targetDir, 'Overrides directory');
  const safeZipPath = normalizeArchiveRelativePath(zipPath, 'Archive overrides path');
  const tasks: ArchiveWriteTask[] = [];
  for (const entry of zip.getEntries()) {
    const normalizedEntryPath = normalizeArchiveRelativePath(entry.fileName, 'Archive entry path');
    if (normalizedEntryPath !== safeZipPath && !normalizedEntryPath.startsWith(`${safeZipPath}/`)) continue;
    const relativePath = normalizedEntryPath === safeZipPath ? '' : normalizedEntryPath.slice(safeZipPath.length + 1);
    if (!relativePath || entry.fileName.endsWith('/')) continue;
    tasks.push({
      entry,
      targetPath: resolvePathWithinRoot(safeTargetDir, relativePath, `Archive entry "${entry.fileName}"`),
      overwrite: true,
    });
  }
  await writeArchiveTasks(zip, tasks);
}
