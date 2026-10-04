import { randomUUID } from 'node:crypto';
import { ipcMain } from 'electron';
import {
  JAVA_RUNTIME_CHANNELS,
  type JavaRuntimeGetRequest,
  type JavaRuntimeInstallationDto,
  type JavaRuntimeSelectRequest,
} from '../../../shared/contracts/javaRuntime';
import type { InstanceApplication } from '../../domains/instances/instanceApplication';
import type { LauncherRoot } from '../../domains/instances/instanceTypes';
import type { DetectedJava } from '../../services/java/javaScanner';
import { JavaInstallationRegistry } from './javaInstallationRegistry';

const INSTALLATION_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

export type JavaRuntimeHandlerDependencies = Readonly<{
  application: InstanceApplication;
  /** Main owns this root authority; renderer input is never consulted. */
  getDefaultInstanceRoot(): Promise<LauncherRoot>;
  scanJava(): Promise<readonly DetectedJava[]>;
  createInstallationId?(): string;
}>;

function unavailable(): Error {
  return new Error('Java runtime selection is unavailable. Scan again.');
}

function validateSelectionRequest(value: unknown): JavaRuntimeSelectRequest {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('Java runtime selection request must be an object.');
  }

  const record = value as Record<string, unknown>;
  if (Object.keys(record).some((key) => key !== 'instanceId' && key !== 'installationId')) {
    throw new Error('Java runtime selection request contains unsupported fields.');
  }

  if (typeof record.instanceId !== 'string' || !INSTALLATION_ID_PATTERN.test(record.instanceId)
    || (record.installationId !== null && (typeof record.installationId !== 'string' || !INSTALLATION_ID_PATTERN.test(record.installationId)))) {
    throw new Error('Java runtime selection request installation ID is invalid.');
  }

  return { instanceId: record.instanceId, installationId: record.installationId as string | null };
}

function validateGetRequest(value: unknown): JavaRuntimeGetRequest {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('Java runtime selection request must be an object.');
  }
  const record = value as Record<string, unknown>;
  if (Object.keys(record).some((key) => key !== 'instanceId')
    || typeof record.instanceId !== 'string' || !INSTALLATION_ID_PATTERN.test(record.instanceId)) {
    throw new Error('Java runtime selection request instance ID is invalid.');
  }
  return { instanceId: record.instanceId };
}

/** Registers the path-free Java scan and canonical selection IPC boundary. */
export function registerJavaRuntimeHandlers(deps: JavaRuntimeHandlerDependencies): void {
  const registry = new JavaInstallationRegistry();
  const nextId = deps.createInstallationId ?? randomUUID;
  const pendingScans = new Map<LauncherRoot, Promise<readonly JavaRuntimeInstallationDto[]>>();

  ipcMain.removeHandler(JAVA_RUNTIME_CHANNELS.scan);
  ipcMain.handle(JAVA_RUNTIME_CHANNELS.scan, async (_event, request: unknown) => {
    if (typeof request !== 'object' || request === null || Array.isArray(request) || Object.keys(request).length !== 0) {
      throw new Error('Java runtime scan request must be empty.');
    }

    try {
      const root = await deps.getDefaultInstanceRoot();
      const pending = pendingScans.get(root);
      if (pending) return await pending;
      // Overlapping screens share IDs; only a later, completed rescan invalidates them.
      const scan = deps.scanJava().then((detections) => registry.replace(root, detections, nextId));
      pendingScans.set(root, scan);
      try {
        return await scan;
      } finally {
        pendingScans.delete(root);
      }
    } catch {
      throw new Error('Java runtime scan is unavailable.');
    }
  });

  ipcMain.removeHandler(JAVA_RUNTIME_CHANNELS.get);
  ipcMain.handle(JAVA_RUNTIME_CHANNELS.get, async (_event, request: unknown) => {
    const parsed = validateGetRequest(request);
    try {
      const root = await deps.getDefaultInstanceRoot();
      const state = await deps.application.read(root);
      if (state.status !== 'ready') throw unavailable();
      const record = state.snapshot.records.find((candidate) => candidate.id === parsed.instanceId);
      if (!record) throw unavailable();
      return { installationId: registry.findIdByExecutable(root, record.config.java?.executable) };
    } catch (error) {
      if (error instanceof Error && error.message === unavailable().message) throw error;
      throw new Error('Java runtime selection is unavailable.');
    }
  });

  ipcMain.removeHandler(JAVA_RUNTIME_CHANNELS.select);
  ipcMain.handle(JAVA_RUNTIME_CHANNELS.select, async (_event, request: unknown) => {
    const parsed = validateSelectionRequest(request);
    try {
      const root = await deps.getDefaultInstanceRoot();
      let installation: ReturnType<JavaInstallationRegistry['resolve']>;
      if (parsed.installationId !== null) {
        installation = registry.resolve(root, parsed.installationId);
        if (!installation) throw unavailable();
      }
      const state = await deps.application.read(root);
      if (state.status !== 'ready') throw unavailable();
      const record = state.snapshot.records.find((candidate) => candidate.id === parsed.instanceId);
      if (!record) throw unavailable();

      if (parsed.installationId === null) {
        const configWithoutJava = { ...record.config };
        delete configWithoutJava.java;
        await deps.application.execute(root, {
          version: 1,
          type: 'save-config',
          id: record.id,
          config: configWithoutJava,
        });
        return { status: 'auto' as const };
      }
      if (!installation) throw unavailable();
      await deps.application.execute(root, {
        version: 1,
        type: 'save-config',
        id: record.id,
        config: {
          ...record.config,
          java: { executable: installation.executable },
        },
      });
      return { status: 'selected' as const };
    } catch (error) {
      if (error instanceof Error && error.message === unavailable().message) throw error;
      throw new Error('Java runtime selection is unavailable.');
    }
  });
}
