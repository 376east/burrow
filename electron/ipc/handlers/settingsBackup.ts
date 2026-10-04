import { isSettingsBackupKey, type SettingsBackupValues } from '@shared/contracts/settings';
const SETTINGS_BACKUP_MAX_BYTES = 512 * 1024;
const SETTINGS_BACKUP_MAX_KEYS = 96;
const SETTINGS_BACKUP_FIELDS = new Set(['schemaVersion', 'product', 'createdAt', 'values']);
export function isCanonicalIsoTimestamp(value: unknown): value is string {
  if (typeof value !== 'string') return false
  const timestamp = Date.parse(value)
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString() === value
}

export function hasExactSettingsBackupFields(value: Record<string, unknown>): boolean {
  const fields = Object.keys(value)
  return fields.length === SETTINGS_BACKUP_FIELDS.size
    && fields.every((field) => SETTINGS_BACKUP_FIELDS.has(field))
}

export function validateSettingsBackupValues(value: unknown): SettingsBackupValues {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Settings backup must contain a plain key-value object')
  }
  const entries = Object.entries(value)
  if (entries.length > SETTINGS_BACKUP_MAX_KEYS) throw new Error('Settings backup contains too many keys')

  const values: Record<string, string> = {}
  for (const [key, entry] of entries) {
    if (!isSettingsBackupKey(key) || typeof entry !== 'string') throw new Error(`Settings backup contains an unsupported key: ${key}`)
    if (Buffer.byteLength(entry, 'utf8') > 128 * 1024) throw new Error(`Settings backup value is too large: ${key}`)
    values[key] = entry
  }
  if (Buffer.byteLength(JSON.stringify(values), 'utf8') > SETTINGS_BACKUP_MAX_BYTES) {
    throw new Error('Settings backup is too large')
  }
  return values
}

export function parseSettingsBackup(value: unknown): SettingsBackupValues {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid Burrow settings backup')
  const backup = value as Record<string, unknown>
  if (backup.schemaVersion !== 1
    || backup.product !== 'Burrow'
    || !isCanonicalIsoTimestamp(backup.createdAt)
    || !hasExactSettingsBackupFields(backup)) {
    throw new Error('Unsupported Burrow settings backup')
  }
  return validateSettingsBackupValues(backup.values)
}
