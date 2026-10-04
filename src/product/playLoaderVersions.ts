import type { PlayWorkspaceProps } from './PlayWorkspace';

export function resolvePlayLoaderVersions(launch: PlayWorkspaceProps['launch'], fallback: { forgeVersions: string[]; fabricVersions: string[]; neoForgeVersions: string[] }) {
  return {
    forgeVersions: launch.supportedVersions.forge.length ? launch.supportedVersions.forge : fallback.forgeVersions,
    fabricVersions: launch.supportedVersions.fabric.length ? launch.supportedVersions.fabric : fallback.fabricVersions,
    neoForgeVersions: launch.supportedVersions.neoForge.length ? launch.supportedVersions.neoForge : fallback.neoForgeVersions,
  };
}
