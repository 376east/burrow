import type { OperationSnapshot, RootMutationCommandResult, RootMutationFailure } from './operationTypes';
import type { InstanceCommand } from '../../domains/instances/instanceTypes';
export function isCancelled(snapshot: OperationSnapshot): boolean {
  return snapshot.status === 'cancelling';
}

export function isTerminal(snapshot: OperationSnapshot): boolean {
  return ['succeeded', 'recovered', 'degraded', 'cancelled', 'failed', 'recovery-required'].includes(snapshot.status);
}

export function isArchiveExportRecovery(snapshot: OperationSnapshot): boolean {
  return snapshot.kind === 'export'
    && snapshot.input.kind === 'export'
    && (snapshot.input.format === 'zip' || snapshot.input.format === 'multimc')
    && snapshot.recovery !== undefined
    && 'outputPath' in snapshot.recovery;
}

export function hasCanonicalRecoveryCommand(snapshot: OperationSnapshot): boolean {
  return snapshot.recovery?.canonicalCommand !== undefined;
}

export function canonicalCommandInstanceId(command: InstanceCommand, result: RootMutationCommandResult): string | undefined {
  if ('code' in result) return undefined;
  switch (command.type) {
    case 'commit-published':
    case 'reconcile-update':
      return command.record.id;
    case 'create':
      return result.snapshot.selectedId ?? undefined;
    default:
      return command.id;
  }
}

export function sameJson(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function toSafeMessage(error: unknown): string {
  const message = error instanceof Error ? error.message.trim() : '';
  return (message || 'Operation failed').slice(0, 240);
}

export function rootMutationFailure(code: RootMutationFailure['code'], message: string): RootMutationFailure {
  return { status: 'failed', code, message };
}

export function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
