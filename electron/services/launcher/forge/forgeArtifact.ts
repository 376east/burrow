export function isForgeInstallerSupportedMcVersion(versionId: string): boolean {
  const m = versionId.match(/^(\d+)\.(\d+)(?:\.(\d+))?$/);
  if (!m) return false;
  const major = Number(m[1]);
  const minor = Number(m[2]);
  if (!Number.isFinite(major) || !Number.isFinite(minor)) return false;
  return major > 1 || (major === 1 && minor >= 6);
}

export function getForgeArtifactVersion(version: { mcversion: string; version: string }) {
  // Keep this logic in sync with @xmcl/installer `getForgeArtifactVersion`.
  // For MC 1.7+ (minor >= 7), Forge uses artifact version with MC version suffix.
  // Examples:
  // - 1.7.10 -> 1.7.10-10.13.4.1614-1.7.10
  // - 1.8.9 -> 1.8.9-11.15.1.2318-1.8.9
  // - 1.9.4 -> 1.9.4-12.17.0.2317-1.9.4
  // - 1.10 -> 1.10-12.18.0.2000-1.10.0 (no patch, so add .0)
  const [, minor] = version.mcversion.split('.');
  const minorVersion = Number.parseInt(minor, 10);
  if (minorVersion >= 7) {
    // If mcversion has no patch (e.g., "1.10"), add ".0" suffix.
    const parts = version.mcversion.split('.');
    const suffix = parts.length >= 3 ? version.mcversion : `${version.mcversion}.0`;
    return `${version.mcversion}-${version.version}-${suffix}`;
  }
  if (version.version.startsWith(version.mcversion)) {
    return version.version;
  }
  return `${version.mcversion}-${version.version}`;
}

