import taskPackage, { type Task } from '@xmcl/task';

const { AbortableTask, CancelledError, TaskState } = taskPackage;
import type { MinecraftLocation, ResolvedVersion } from '@xmcl/core';
import type {
  CompleteOptions, CompleteTrackerEvents, ForgeTrackerEvents, InstallForgeOptions,
  InstallJavaRuntimeOptions, JavaRuntimeTrackerEvents, MinecraftVersionBaseInfo, Tracker,
} from '@xmcl/installer';

type ProgressHandle = { progress: number; total: number };
type TaskOptions<Events extends object> = { signal?: AbortSignal; abortSignal?: AbortSignal; tracker?: Tracker<Events> };
type ExecutionContext<Events extends object> = { signal: AbortSignal; abortSignal: AbortSignal; tracker: Tracker<Events> };

// New XMCL installers expose mutable progress handles instead of Task objects.
class InstallerTask<T, Events extends object> extends AbortableTask<T> {
  private controller = new AbortController();
  private readonly handles = new Set<ProgressHandle>();

  constructor(
    name: string,
    private readonly options: TaskOptions<Events>,
    private readonly execute: (context: ExecutionContext<Events>) => Promise<T>,
  ) {
    super();
    this.setName(name);
  }

  private publishProgress() {
    let progress = 0;
    let total = 0;
    for (const handle of this.handles) {
      progress += handle.progress;
      total += handle.total;
    }
    const delta = progress - this._progress;
    if (delta === 0 && total === this._total) return;
    this._progress = progress;
    this._total = total;
    this.update(delta);
  }

  protected async process(): Promise<T> {
    this.controller = new AbortController();
    this.handles.clear();
    this._progress = 0;
    this._total = 0;
    const signal = AbortSignal.any([
      this.controller.signal,
      ...[this.options.signal, this.options.abortSignal].filter((candidate): candidate is AbortSignal => Boolean(candidate)),
    ]);
    signal.throwIfAborted();
    const tracker: Tracker<Events> = (event) => {
      this.name = event.phase === 'libraries' ? 'library' : String(event.phase);
      const payload: unknown = event.payload;
      if (payload && typeof payload === 'object' && 'progress' in payload) {
        const handle = payload.progress;
        if (handle && typeof handle === 'object' && 'progress' in handle && 'total' in handle
          && typeof handle.progress === 'number' && typeof handle.total === 'number') {
          this.handles.add(handle as ProgressHandle);
        }
      }
      this.publishProgress();
      this.options.tracker?.(event);
    };
    const interval = setInterval(() => this.publishProgress(), 250);
    try {
      const result = await this.execute({ signal, abortSignal: signal, tracker });
      signal.throwIfAborted();
      return result;
    } finally {
      clearInterval(interval);
      this.publishProgress();
    }
  }

  protected abort(isCancelled: boolean): void {
    // AbortableTask retries aborted work before BaseTask.cancel marks it cancelled.
    // Publish cancellation first so an abort cannot start another installation.
    if (isCancelled) this._state = TaskState.Cancelled;
    this.controller.abort();
  }

  protected cancelTask(): Promise<void> {
    if (this.state === TaskState.Idle) {
      this.controller.abort();
      return Promise.resolve();
    }
    return super.cancelTask();
  }
  protected isAbortedError(error: unknown): boolean {
    return this.controller.signal.aborted && !(error instanceof CancelledError);
  }
}

export function installTask(version: MinecraftVersionBaseInfo, minecraft: MinecraftLocation, options: CompleteOptions = {}): Task<ResolvedVersion> {
  return new InstallerTask<ResolvedVersion, CompleteTrackerEvents>('installMinecraft', options, async (context) => {
    const installer = await import('@xmcl/installer');
    context.signal.throwIfAborted();
    const resolved = await installer.installMinecraft(version, minecraft, { ...options, ...context });
    context.signal.throwIfAborted();
    await installer.completeInstallation(resolved, { ...options, ...context });
    return resolved;
  });
}

export function installDependenciesTask(version: ResolvedVersion, options: CompleteOptions = {}): Task<void> {
  return new InstallerTask<void, CompleteTrackerEvents>('installDependencies', options, async (context) => {
    const { completeInstallation } = await import('@xmcl/installer');
    context.signal.throwIfAborted();
    await completeInstallation(version, { ...options, ...context });
  });
}

export function installForgeTask(version: Parameters<typeof import('@xmcl/installer').installForge>[0], minecraft: MinecraftLocation, options: InstallForgeOptions = {}): Task<string> {
  return new InstallerTask<string, ForgeTrackerEvents>('installForge', options, async (context) => {
    const { installForge } = await import('@xmcl/installer');
    context.signal.throwIfAborted();
    return installForge(version, minecraft, { ...options, ...context });
  });
}

export function installNeoForgedTask(project: 'forge' | 'neoforge', version: string, minecraft: MinecraftLocation, options: InstallForgeOptions = {}): Task<string> {
  return new InstallerTask<string, ForgeTrackerEvents>('installNeoForge', options, async (context) => {
    const { installNeoForge } = await import('@xmcl/installer');
    context.signal.throwIfAborted();
    return installNeoForge(project, version, minecraft, { ...options, ...context });
  });
}

export function installJavaRuntimeTask(options: InstallJavaRuntimeOptions): Task<void> {
  return new InstallerTask<void, JavaRuntimeTrackerEvents>('installJavaRuntime', options, async (context) => {
    const { installJavaRuntime } = await import('@xmcl/installer');
    context.signal.throwIfAborted();
    await installJavaRuntime({ ...options, ...context });
  });
}
