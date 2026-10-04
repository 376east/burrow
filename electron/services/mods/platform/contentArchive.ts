import type { ProviderCatalogContents, ProviderCatalogContentsRequest } from '../../../../shared/contracts/providerCatalog';
import { parseCurseForgeManifest } from '../../modpacks/parsers/curseforgeParser';
import { parseModrinthManifest } from '../../modpacks/parsers/modrinthParser';
import fs from 'fs-extra';
import { openValidatedZip } from '../../../security/archivePolicy';
import { fetchPublicHttpsUrl } from '../../../security/remoteUrls';
import type { ModInstallRequest } from '../../../../shared/contracts/mods';
import type { GuidedContentInstallIssue, GuidedContentInstallIssueStatus, GuidedContentInstallResult } from './types';
export function isReleaseMinecraftVersion(value: string | null | undefined): value is string {
  return typeof value === 'string' && /^\d+\.\d+(?:\.\d+)?$/.test(value.trim());
}

export function compareMinecraftReleaseVersions(left: string, right: string): number {
  const leftParts = left.split('.').map((part) => Number.parseInt(part, 10));
  const rightParts = right.split('.').map((part) => Number.parseInt(part, 10));
  const maxLength = Math.max(leftParts.length, rightParts.length);

  for (let index = 0; index < maxLength; index += 1) {
    const leftPart = leftParts[index] ?? 0;
    const rightPart = rightParts[index] ?? 0;

    if (leftPart !== rightPart) {
      return rightPart - leftPart;
    }
  }

  return 0;
}

export function pickPreferredMinecraftVersion(values: Array<string | null | undefined>): string | undefined {
  const versions = Array.from(
    new Set(values.map((value) => value?.trim()).filter(isReleaseMinecraftVersion)),
  );

  versions.sort(compareMinecraftReleaseVersions);
  return versions[0];
}

export function isGuidedContentType(contentType: ModInstallRequest['contentType']): contentType is 'resourcepack' | 'shader' {
  return contentType === 'resourcepack' || contentType === 'shader';
}

export const DEFAULT_OVERRIDE_ROOTS = ['overrides', 'client-overrides', 'server-overrides'];

export function classifyPackPath(value: string | undefined, overrideRoots: readonly string[] = DEFAULT_OVERRIDE_ROOTS): 'mod' | 'resourcepack' | 'shader' | 'other' {
  const normalized = value?.replace(/\\/g, '/') ?? '';
  const root = overrideRoots.find((candidate) => normalized.toLowerCase().startsWith(`${candidate.toLowerCase()}/`));
  const path = (root ? normalized.slice(root.length + 1) : normalized).toLowerCase();
  if (path.startsWith('mods/')) return 'mod';
  if (path.startsWith('resourcepacks/')) return 'resourcepack';
  if (path.startsWith('shaderpacks/')) return 'shader';
  return 'other';
}

export const PREVIEW_ARCHIVE_MAX_BYTES = 32 * 1024 * 1024;

export const PREVIEW_ARCHIVE_TIMEOUT_MS = 20_000;

export async function downloadPreviewArchive(url: string, destination: string, label: string): Promise<void> {
  const response = await fetchPublicHttpsUrl(url, label, { signal: AbortSignal.timeout(PREVIEW_ARCHIVE_TIMEOUT_MS) });
  if (!response.ok || !response.body) throw new Error(`${label} could not be downloaded (${response.status})`);
  const length = Number(response.headers.get('content-length'));
  if (Number.isFinite(length) && length > PREVIEW_ARCHIVE_MAX_BYTES) {
    await response.body.cancel();
    throw new Error(`${label} exceeds the ${PREVIEW_ARCHIVE_MAX_BYTES / (1024 * 1024)} MB preview limit`);
  }
  const handle = await fs.promises.open(destination, 'w');
  let received = 0;
  try {
    const reader = response.body.getReader();
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        received += value.byteLength;
        if (received > PREVIEW_ARCHIVE_MAX_BYTES) {
          await reader.cancel();
          throw new Error(`${label} exceeds the ${PREVIEW_ARCHIVE_MAX_BYTES / (1024 * 1024)} MB preview limit`);
        }
        await handle.writeFile(value);
      }
    } finally {
      await reader.cancel().catch(() => undefined);
      reader.releaseLock();
    }
  } finally {
    await handle.close();
  }
}

export function createGuidedContentInstallIssue(
  fileName: string,
  status: GuidedContentInstallIssueStatus,
  message: string,
  ): GuidedContentInstallIssue {
  return { fileName, status, message };
}

export function createGuidedContentInstallResult(
  status: GuidedContentInstallResult['status'],
  details: Partial<Omit<GuidedContentInstallResult, 'status' | 'issues'>> = {},
  issues: GuidedContentInstallIssue[] = [],
  ): GuidedContentInstallResult {
  return {
    status,
    destination: details.destination,
    filename: details.filename,
    usedUrl: details.usedUrl,
    issues,
  };
}

export async function hasResourcePackPayload(filePath: string): Promise<boolean> {
  try {
    if (!filePath.toLowerCase().endsWith('.zip')) {
      return false;
    }

    const zip = await openValidatedZip(filePath, 'Mod archive');
    try {
      const mcmetaEntry = zip.getEntry('pack.mcmeta');
      if (!mcmetaEntry) return false;

      const content = JSON.parse((await zip.getData(mcmetaEntry, 1024 * 1024)).toString('utf8')) as {
        pack?: { pack_format?: number };
      };
      return typeof content.pack?.pack_format === 'number';
    } finally {
      zip.close();
    }
  } catch {
    return false;
}
}

export async function hasShaderPayload(filePath: string): Promise<boolean> {
  try {
    if (!filePath.toLowerCase().endsWith('.zip')) {
      return false;
    }

    const zip = await openValidatedZip(filePath, 'Mod archive');
    try {
      return zip.getEntries().some((entry) => entry.fileName.startsWith('shaders/'));
    } finally {
      zip.close();
    }
  } catch {
    return false;
}
}

export async function validateGuidedContentArchive(
  filePath: string,
  fileName: string,
  contentType: 'resourcepack' | 'shader',
  ): Promise<GuidedContentInstallIssue | null> {
  const isValid = contentType === 'resourcepack'
    ? await hasResourcePackPayload(filePath)
    : await hasShaderPayload(filePath);

  if (isValid) {
    return null;
}

  const message = contentType === 'resourcepack'
    ? 'The downloaded archive is missing a readable pack.mcmeta file.'
    : 'The downloaded archive does not contain a shaders/ directory.';

  return createGuidedContentInstallIssue(fileName, 'invalid-archive', message);
}

export function getGuidedContentFailureMessage(contentType: 'resourcepack' | 'shader'): string {
  return contentType === 'resourcepack'
    ? 'Burrow could not download this resource pack into the current modpack.'
    : 'Burrow could not download this shader pack into the current modpack.';
}

export async function readPreviewContents(archivePath: string, request: ProviderCatalogContentsRequest): Promise<ProviderCatalogContents> {
  const archive = await openValidatedZip(archivePath, `${request.platform} modpack preview`);
  try {
    const manifestName = request.platform === 'modrinth' ? 'modrinth.index.json' : 'manifest.json';
    const manifestEntry = archive.getEntry(manifestName);
    if (!manifestEntry) throw new Error(`${request.platform} modpack does not contain ${manifestName}`);
    const manifest = request.platform === 'modrinth'
      ? parseModrinthManifest((await archive.getData(manifestEntry, 8 * 1024 * 1024)).toString('utf8'))
      : parseCurseForgeManifest((await archive.getData(manifestEntry, 8 * 1024 * 1024)).toString('utf8'));
    const overrideRoots = Array.from(new Set(['overrides', 'client-overrides', 'server-overrides', manifest.overrides]
      .filter((root): root is string => typeof root === 'string' && root.length > 0)
      .map((root) => root.replace(/\\/g, '/').replace(/^\/+|\/+$/g, ''))));
    const entries = manifest.files.map((file) => ({
      kind: file.path ? classifyPackPath(file.path) : 'mod' as const,
      label: file.path ?? `CurseForge project ${file.projectID ?? '?'} / file ${file.fileID ?? '?'}`,
      required: file.required,
    }));
    for (const entry of archive.getEntries()) {
      if (entry.fileName === manifestName || entry.fileName.endsWith('/')) continue;
      const normalized = entry.fileName.replace(/\\/g, '/');
      if (!overrideRoots.some((root) => normalized.toLowerCase().startsWith(`${root.toLowerCase()}/`))) continue;
      entries.push({ kind: classifyPackPath(normalized, overrideRoots), label: normalized, required: true });
    }
    return { entries: entries.slice(0, 500), truncated: entries.length > 500 };
  } finally {
    archive.close();
  }
}
