import type { InstanceFailure } from '../../../shared/contracts/instances';
function unavailable(): InstanceFailure { return { code: 'INSTANCE_UNAVAILABLE', message: 'Instance state is unavailable.' }; }
export function isPublicFailure(value: unknown): value is InstanceFailure {
  return typeof value === 'object'
    && value !== null
    && 'code' in value
    && 'message' in value
    && typeof value.code === 'string'
    && typeof value.message === 'string';
}

export function publicText(value: string): string {
  if (value.includes('/') || value.includes('\\') || value.startsWith('~') || /^[a-z]:/i.test(value) || /^file:/i.test(value)) {
    throw unavailable();
  }

  return value;
}

export function optionalPublicText(value: string | undefined): string | undefined {
  return value === undefined ? undefined : publicText(value);
}
