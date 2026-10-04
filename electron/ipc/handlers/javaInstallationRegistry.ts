import type { JavaRuntimeInstallationDto } from '../../../shared/contracts/javaRuntime';
import type { LauncherRoot } from '../../domains/instances/instanceTypes';
import type { DetectedJava } from '../../services/java/javaScanner';

const MAX_INSTALLATIONS_PER_SCAN = 64;
const MAX_ROOT_REGISTRIES = 4;
const INSTALLATION_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

type AuthorizedInstallation = Readonly<{
  executable: string;
  dto: JavaRuntimeInstallationDto;
}>;

/**
 * Keeps native Java executable details inside the main process. Each scan
 * replaces only the requesting root's entries, invalidating its stale IDs.
 */
export class JavaInstallationRegistry {
  private readonly entriesByRoot = new Map<LauncherRoot, Map<string, AuthorizedInstallation>>();

  public replace(root: LauncherRoot, detections: readonly DetectedJava[], nextId: () => string): readonly JavaRuntimeInstallationDto[] {
    const entries = new Map<string, AuthorizedInstallation>();
    const installations: JavaRuntimeInstallationDto[] = [];

    for (const detection of detections) {
      if (installations.length >= MAX_INSTALLATIONS_PER_SCAN) break;
      if (!this.isUsable(detection)) continue;

      const id = nextId();
      if (!INSTALLATION_ID_PATTERN.test(id) || entries.has(id)) continue;
      const dto: JavaRuntimeInstallationDto = {
        id,
        version: detection.version,
        majorVersion: detection.majorVersion,
        ...(detection.arch ? { arch: detection.arch } : {}),
      };
      entries.set(id, { executable: detection.path, dto });
      installations.push(dto);
    }

    if (this.entriesByRoot.has(root)) {
      this.entriesByRoot.delete(root);
    } else if (this.entriesByRoot.size >= MAX_ROOT_REGISTRIES) {
      const oldestRoot = this.entriesByRoot.keys().next().value;
      if (oldestRoot !== undefined) this.entriesByRoot.delete(oldestRoot);
    }
    this.entriesByRoot.set(root, entries);
    return installations;
  }

  public resolve(root: LauncherRoot, id: string): AuthorizedInstallation | undefined {
    return this.entriesByRoot.get(root)?.get(id);
  }

  public findIdByExecutable(root: LauncherRoot, executable: string | undefined): string | null {
    if (!executable) return null;
    for (const [id, installation] of this.entriesByRoot.get(root) ?? []) {
      if (installation.executable === executable) return id;
    }
    return null;
  }

  private isUsable(detection: DetectedJava): boolean {
    return detection.valid
      && typeof detection.path === 'string'
      && detection.path.length > 0
      && typeof detection.version === 'string'
      && detection.version.length > 0
      && Number.isInteger(detection.majorVersion)
      && detection.majorVersion > 0;
  }
}
