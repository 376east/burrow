import { DefaultRangePolicy } from '@xmcl/file-transfer';
import type { AccountService } from '../account/accountService';
import { JavaManager } from '../java/provisioning';
import { createDispatcher, resolveDownloadConcurrency } from '../runtime/http';
import { RuntimeDownloadService } from '../runtime/downloadService';
import { TaskRunner } from '../runtime/taskRunner';
import { VanillaService } from '../runtime/vanillaService';
import { logInstalledMods } from '../mods/logInstalledMods';
import { parseRequestedVersion } from '../versions/versionResolver';
import { getRequiredJavaForMinecraftVersion } from './launchFlow/requiredJava';
import type { TaskProgressData } from './types';
import type { LaunchGameOptions } from './orchestratorTypes';
import { prepareLaunchContext, ensureAuthInjector, createOfflineSession } from './preLaunchSetup';
import { installModLoaderIfNeeded } from './modLoaderInstaller';
import { patchForgeVersionMetadata, prefetchLegacyForgeRuntimeDeps } from './legacyCompatibility';
import type { InstanceReadPort, LauncherRootResolver } from '../../domains/instances/ports';
import type { LaunchAdapters } from '../../infrastructure/instances/launchAdapters';


type PreparationDependencies = {
  instances: InstanceReadPort;
  rootResolver: LauncherRootResolver;
  launchAdapters: LaunchAdapters;
  launcherRootPath: string;
  downloads: RuntimeDownloadService;
  javaManager: JavaManager;
  vanilla: VanillaService;
  tasks: TaskRunner;
  logInstalledMods: typeof logInstalledMods;
  authServerUrl: string;
  accountService: AccountService | undefined;
};

export async function prepareMinecraftLaunch(deps: PreparationDependencies, options: LaunchGameOptions, onLog: (data: string) => void, onProgress: (data: TaskProgressData) => void, checkPreparation: () => void) {
  const { rootPath, instanceId, instancePath, record, effective } = await prepareLaunchContext({
    instances: deps.instances,
    rootResolver: deps.rootResolver,
    native: deps.launchAdapters,
    launcherRootPath: deps.launcherRootPath,
    options,
  });
  checkPreparation();

  const {
    requestedVersion,
    ramGb,
    effectiveJavaPath,
    effectiveVmOptions,
    effectiveMcArgs,
    effectiveResolution,
    effectiveServer,
    minRamGb,
  } = effective;

  const { isNeoForge, isForge, isFabric, isQuilt, mcVersion } = parseRequestedVersion(requestedVersion);

  onLog('═══════════════════════════════════════════════════════════');
  onLog(`[VERSION INFO] Launching version: ${requestedVersion}`);
  onLog(`[VERSION INFO] Minecraft version: ${mcVersion}`);
  onLog(`[VERSION INFO] Version type: ${isNeoForge ? 'NeoForge' : isForge ? 'Forge' : isFabric ? 'Fabric' : 'Vanilla'}`);
  if (instanceId) onLog(`[MODPACK] ${instanceId} @ ${instancePath}`);
  if (options.useOptiFine) {
    onLog(`[VERSION INFO] OptiFine: requested`);
  }
  onLog('═══════════════════════════════════════════════════════════');

  const downloadProvider = deps.downloads.getDownloadProvider(options.downloadProvider);
  await deps.downloads.warmupMirrors(downloadProvider);
  checkPreparation();
  const maxSockets = options.maxSockets ?? 64;
  const dispatcher = createDispatcher(maxSockets);
  const rangePolicy = new DefaultRangePolicy(5 * 1024 * 1024, 4);
  const concurrency = resolveDownloadConcurrency(options.autoDownloadThreads ?? true, options.downloadThreads);

  const downloadOptions = deps.downloads.buildInstallerOptions(downloadProvider, dispatcher, rangePolicy, concurrency);

  const requiredJava = getRequiredJavaForMinecraftVersion(mcVersion);
  if (requiredJava === 25) onLog(`Version ${mcVersion} requires Java 25.`);
  else if (requiredJava === 21) onLog(`Version ${mcVersion} requires Java 21.`);
  else if (requiredJava === 17) onLog(`Version ${mcVersion} requires Java 17.`);
  else onLog(`Version ${mcVersion} uses Legacy Java 8.`);

  const javaPath = await deps.launchAdapters.resolveJavaPath({
    javaManager: deps.javaManager,
    requiredJava,
    customJavaPath: effectiveJavaPath,
    onLog,
    onProgress,
  });
  checkPreparation();

  onLog(`Ensuring Minecraft ${mcVersion} is installed...`);
  await deps.vanilla.ensureVanillaInstalled(mcVersion, rootPath, onLog, onProgress, downloadProvider, downloadOptions);
  checkPreparation();

  const launchVersion = await installModLoaderIfNeeded({
    rootPath,
    instancePath,
    mcVersion,
    javaPath,
    requestedVersion,
    isForge,
    isNeoForge,
    isFabric,
    isQuilt,
    useOptiFine: options.useOptiFine,
    downloadProvider,
    maxSockets,
    downloadOptions,
    tasks: deps.tasks,
    onLog,
    onProgress,
  });
  checkPreparation();

  if (isForge) {
    patchForgeVersionMetadata({ rootPath, launchVersion, mcVersion, onLog });
    await prefetchLegacyForgeRuntimeDeps({ instancePath, mcVersion, downloadProvider, onLog });
    checkPreparation();
  }

  await deps.logInstalledMods(rootPath, onLog, instancePath);
  checkPreparation();

  const { destInjectorPath } = await ensureAuthInjector({
    rootPath,
    modpackPath: instancePath,
    downloadProvider,
    maxSockets,
    onLog,
  });
  checkPreparation();

  const { resolvedAuthServerUrl, accessToken, gameProfile } = await resolveLaunchAccount(deps, options, onLog);

  onLog(`[LAUNCH] Launching Minecraft ${launchVersion}...`);
  onLog(`[LAUNCH] Java: ${javaPath}`);
  onLog(`[LAUNCH] RAM: Max ${ramGb}GB${minRamGb ? `, Min ${minRamGb}GB` : ''}`);

  checkPreparation();

  return { rootPath, instanceId, instancePath, record, effectiveVmOptions, effectiveMcArgs, effectiveResolution, effectiveServer, minRamGb, ramGb, requiredJava, javaPath, launchVersion, gameProfile, accessToken, destInjectorPath, resolvedAuthServerUrl };
}

async function resolveLaunchAccount(deps: Pick<PreparationDependencies, "authServerUrl" | "accountService">, options: LaunchGameOptions, onLog: (data: string) => void) {
  let resolvedAuthServerUrl = deps.authServerUrl;
  let accessToken: string;
  let gameProfile: { id: string; name: string };

  const activeAccount = await deps.accountService?.ensureActiveAccountValid();

  if (activeAccount?.type === 'third-party' && activeAccount.authServerUrl) {
    resolvedAuthServerUrl = activeAccount.authServerUrl;
    accessToken = activeAccount.accessToken!;
    gameProfile = { id: activeAccount.id, name: activeAccount.name };
    onLog(`[AUTH] Using Third-Party Account: ${activeAccount.name} (${activeAccount.authServerUrl})`);
  } else {
    // Offline (either explicit account or fallback nickname)
    const nickname = activeAccount?.name ?? options.nickname;
    const offlineUser = createOfflineSession(nickname);
    accessToken = offlineUser.accessToken;
    gameProfile = offlineUser.selectedProfile;
    onLog(`[AUTH] Using Offline Account: ${nickname}`);
  }

  return { resolvedAuthServerUrl, accessToken, gameProfile };
}
