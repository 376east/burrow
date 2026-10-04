import type { Account } from '@shared/types';
export type PersistedAccount = Account & {
    accessToken?: string;
    clientToken?: string;
    encryptedAccessToken?: string;
    encryptedClientToken?: string;
};

export type PersistedAccountState = {
    accounts: PersistedAccount[];
    selectedAccountId: string | null;
};

export function isOptionalString(value: unknown): value is string | undefined {
    return value === undefined || typeof value === 'string';
}

export function isPersistedAccount(value: unknown): value is PersistedAccount {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const account = value as Partial<PersistedAccount>;
    return typeof account.id === 'string'
        && typeof account.name === 'string'
        && (account.type === 'offline' || account.type === 'third-party')
        && isOptionalString(account.authServerUrl)
        && isOptionalString(account.accessToken)
        && isOptionalString(account.clientToken)
        && isOptionalString(account.encryptedAccessToken)
        && isOptionalString(account.encryptedClientToken);
}

export function isPersistedAccountState(value: unknown): value is PersistedAccountState {
    if (!value || typeof value !== 'object') return false;
    const candidate = value as Partial<PersistedAccountState>;
    return Array.isArray(candidate.accounts)
        && candidate.accounts.every(isPersistedAccount)
        && (candidate.selectedAccountId === null || typeof candidate.selectedAccountId === 'string');
}
