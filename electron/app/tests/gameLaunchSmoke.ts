import type { LauncherManager } from '../../services/launcher/orchestrator';
import type { DownloadProviderId } from '../../services/mirrors/providers';

export type GameLaunchSmokeResult = Readonly<{
  version: string;
  ok: boolean;
  ms: number;
  signals: readonly string[];
  error?: string;
}>;

type GameLaunchPort = Pick<LauncherManager, 'launchGame' | 'killGameProcess'>;

const READY_SIGNALS = [
  { id: 'render-backend', pattern: /Backend library:\s*LWJGL|LWJGL Version/i },
  { id: 'resources-ready', pattern: /OpenAL initialized|Created:\s*\d+x\d+.*atlas|Reloading ResourceManager/i },
] as const;

const FATAL_DIAGNOSTICS = [
  { id: 'authlib-injector-incompatible-java', pattern: /Unsupported class file major version/i },
  { id: 'authlib-injector-error', pattern: /\[authlib-injector\].*\[ERROR\]/i },
] as const;

export async function runGameLaunchSmoke(params: {
  launcher: GameLaunchPort;
  version: string;
  modLoader?: 'vanilla' | 'fabric';
  providerId?: DownloadProviderId;
  onLog(line: string): void;
  timeoutMs?: number;
  settleMs?: number;
}): Promise<GameLaunchSmokeResult> {
  const { launcher, version, providerId, onLog } = params;
  const startedAt = Date.now();
  const timeoutMs = params.timeoutMs ?? 180_000;
  const settleMs = params.settleMs ?? 5_000;
  const signals = new Set<string>();
  const requiredSignals = params.modLoader === 'fabric'
    ? [...READY_SIGNALS, { id: 'fabric-loader', pattern: /Loading Minecraft .+ with Fabric Loader /i }]
    : READY_SIGNALS;
  let closed = false;
  let closeCode: number | undefined;
  let resolveReady: (() => void) | undefined;
  let rejectReady: ((error: Error) => void) | undefined;
  let settled = false;
  let fatalDiagnostic: string | undefined;

  const ready = new Promise<void>((resolve, reject) => {
    resolveReady = resolve;
    rejectReady = reject;
  });
  const finishReady = () => {
    if (settled || signals.size !== requiredSignals.length) return;
    settled = true;
    resolveReady?.();
  };
  const failReady = (error: Error) => {
    if (settled) return;
    settled = true;
    rejectReady?.(error);
  };
  const onGameLog = (line: string) => {
    onLog(line);
    const fatal = FATAL_DIAGNOSTICS.find(({ pattern }) => pattern.test(line));
    if (fatal) {
      fatalDiagnostic = fatal.id;
      failReady(new Error(`Minecraft reported a fatal launch diagnostic: ${fatal.id}`));
      return;
    }
    for (const signal of requiredSignals) {
      if (signal.pattern.test(line)) signals.add(signal.id);
    }
    finishReady();
  };

  const timer = setTimeout(() => {
    failReady(new Error(`Minecraft did not reach the main-menu readiness boundary within ${timeoutMs}ms`));
  }, timeoutMs);

  try {
    await launcher.launchGame(
      { nickname: 'BurrowSmoke', version, ram: 2, instanceId: 'game-smoke', downloadProvider: providerId },
      onGameLog,
      () => undefined,
      (code) => {
        closed = true;
        closeCode = code;
        failReady(new Error(`Minecraft exited before the main-menu readiness boundary (code ${code})`));
      },
    );
    await ready;
    if (settleMs > 0) await new Promise((resolve) => setTimeout(resolve, settleMs));
    if (fatalDiagnostic) throw new Error(`Minecraft reported a fatal launch diagnostic: ${fatalDiagnostic}`);
    if (closed) throw new Error(`Minecraft exited during the readiness hold (code ${closeCode ?? 'unknown'})`);
    return { version, ok: true, ms: Date.now() - startedAt, signals: [...signals].sort() };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { version, ok: false, ms: Date.now() - startedAt, signals: [...signals].sort(), error: message };
  } finally {
    clearTimeout(timer);
    await launcher.killGameProcess();
  }
}
