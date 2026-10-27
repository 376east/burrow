import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { RefObject } from 'react';
import type { ModLoaderType } from '../../../contexts/instances/types';
import {
  dispatchInstanceConfigCommand,
  useInstanceConfigCommands,
} from '../../instances/hooks/useInstanceConfigCommands';
import { useEffectiveInstance } from '../../instances/hooks/useEffectiveInstance';
import {
  computeLaunchVersion,
  loadPlayerNickname,
  savePlayerNickname,
  type LaunchStage,
  type LoaderType,
} from '../services/launcherService';

/** Canonical renderer-owned selection state; native launch authority remains in main. */
export function useLauncherState() {
  const [nickname, setNickname] = useState(loadPlayerNickname);
  const [isOffline, setIsOffline] = useState(() => !navigator.onLine);
  const effectiveInstance = useEffectiveInstance();
  const isReady = effectiveInstance.status === 'ready';
  const instanceConfig = isReady ? effectiveInstance.data.snapshot : null;
  const commands = useInstanceConfigCommands(isReady ? effectiveInstance.data.id : null);
  const { setRuntimeMinecraft, setRuntimeLoader, patchConfig } = commands;

  useEffect(() => savePlayerNickname(nickname), [nickname]);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const version = isReady ? (instanceConfig?.runtime?.minecraft ?? '') : '';
  const loaderType = (isReady ? (instanceConfig?.runtime?.modLoader?.type ?? 'vanilla') : 'vanilla') as LoaderType;
  const useForge = loaderType === 'forge';
  const useFabric = loaderType === 'fabric';
  const useNeoForge = loaderType === 'neoforge';
  const useOptiFine = Boolean(instanceConfig?.game?.useOptiFine);

  const setVersion = useCallback((next: string) => {
    dispatchInstanceConfigCommand(setRuntimeMinecraft(next));
  }, [setRuntimeMinecraft]);
  const setUseForge = useCallback((enabled: boolean) => {
    dispatchInstanceConfigCommand(setRuntimeLoader(enabled ? 'forge' : 'vanilla'));
  }, [setRuntimeLoader]);
  const setUseFabric = useCallback((enabled: boolean) => {
    dispatchInstanceConfigCommand(setRuntimeLoader(enabled ? 'fabric' : 'vanilla'));
  }, [setRuntimeLoader]);
  const setUseNeoForge = useCallback((enabled: boolean) => {
    dispatchInstanceConfigCommand(setRuntimeLoader(enabled ? 'neoforge' : 'vanilla'));
  }, [setRuntimeLoader]);
  const setLoader = useCallback((loader: Exclude<LoaderType, 'quilt'>) => {
    dispatchInstanceConfigCommand(setRuntimeLoader(loader as ModLoaderType));
  }, [setRuntimeLoader]);
  const setUseOptiFine = useCallback((enabled: boolean) => {
    if (!instanceConfig) return;
    dispatchInstanceConfigCommand(patchConfig({
      game: {
        ...(instanceConfig.game ?? {}),
        useOptiFine: enabled,
      },
    }));
  }, [instanceConfig, patchConfig]);

  // Remote compatibility inventories can be empty during startup or a network
  // failure. They control launch availability, never the saved pack contents.
  useEffect(() => {
    if (!useOptiFine || loaderType === 'forge') return;
    // OptiFine requires Forge regardless of what the remote inventory reports.
    setUseOptiFine(false);
  }, [loaderType, setUseOptiFine, useOptiFine]);

  const launchVersion = useMemo(
    () => computeLaunchVersion({ loaderType, mcVersion: version }),
    [loaderType, version],
  );

  return {
    modpackConfig: instanceConfig,
    nickname,
    setNickname,
    version,
    setVersion,
    loaderType,
    useForge,
    setUseForge,
    useFabric,
    setUseFabric,
    useNeoForge,
    setUseNeoForge,
    setLoader,
    useOptiFine,
    setUseOptiFine,
    isOffline,
    launchVersion,
  };
}

/** Internal process/session state for the active launcher invocation. */
export function useLauncherProcessState() {
  const [progress, setProgress] = useState<number | null>(null);
  const [statusText, setStatusText] = useState('');
  const [statusDetail, setStatusDetail] = useState('');
  const [logs, setLogs] = useState<string[]>([]);
  const [isLaunching, setIsLaunching] = useState(false);
  const [launchStage, setLaunchStageState] = useState<LaunchStage>('idle');

  // `useRef(null)` would widen to `HTMLDivElement | null` and cause invariant RefObject mismatches.
  const logEndRef = useRef<HTMLDivElement>(null!) as RefObject<HTMLDivElement>;
  const launchStageRef = useRef<LaunchStage>('idle');

  const appendLog = useCallback((log: string) => setLogs((prev) => [...prev, log]), []);
  const resetLogs = useCallback(() => setLogs([]), []);
  const setLaunchStage = useCallback((stage: LaunchStage) => {
    launchStageRef.current = stage;
    setLaunchStageState(stage);
  }, []);
  const getLaunchStage = useCallback(() => launchStageRef.current, []);

  return {
    progress,
    setProgress,
    statusText,
    setStatusText,
    statusDetail,
    setStatusDetail,
    logs,
    setLogs,
    appendLog,
    resetLogs,
    isLaunching,
    setIsLaunching,
    launchStage,
    setLaunchStage,
    getLaunchStage,
    logEndRef,
  };
}
