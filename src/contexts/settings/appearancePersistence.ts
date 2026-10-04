import type { AccentColor, AppearanceSettingsState, CustomThemeConfig, SavedTheme, Theme, ThemePresetId } from './types';
import { DEFAULT_ACCENT_COLOR } from './accent';
import { getThemePreset, getThemePresetAccent, inferThemePresetId, isLegacyPresetConfig } from './theme-presets';
import { extractThemeOverrides, pruneThemeConfig, resolveAccentColor } from './theme';

const DEFAULT_APPEARANCE_STATE: AppearanceSettingsState = {
    accentColor: DEFAULT_ACCENT_COLOR,
    accentColorSource: 'preset',
    customTheme: {},
    theme: 'dark',
    themePresetId: 'default',
};

function parseStoredTheme(raw: string | null): Theme {
    return raw === 'light' ? 'light' : 'dark';
}

function parseStoredThemePresetId(raw: string | null): ThemePresetId | null {
    if (raw === 'light-plus') return 'default';
    if (!raw) {
        return null;
    }

    return getThemePreset(raw)?.id ?? null;
}

function parseStoredAccentColor(raw: unknown): AccentColor {
    return typeof raw === 'string' && raw.trim() ? raw : DEFAULT_APPEARANCE_STATE.accentColor;
}

function parseStoredCustomTheme(raw: string | null): CustomThemeConfig {
    if (!raw) {
        return {};
    }

    try {
        return pruneThemeConfig(JSON.parse(raw) as CustomThemeConfig);
    } catch {
        return {};
    }
}

export function normalizeAppearanceState(state: AppearanceSettingsState): AppearanceSettingsState {
    const normalizedTheme = state.theme === 'light' ? 'light' : 'dark';
    const parsedPresetId = state.themePresetId ? parseStoredThemePresetId(state.themePresetId) : null;
    const normalizedPresetId = parsedPresetId === 'midnight' && normalizedTheme === 'light'
        ? 'default'
        : parsedPresetId;
    const normalizedAccentSource = state.accentColorSource === 'user'
        ? 'user'
        : state.accentColorSource === 'preset'
            ? 'preset'
            : normalizedPresetId
                ? state.accentColor === (getThemePresetAccent(normalizedPresetId, normalizedTheme) ?? DEFAULT_APPEARANCE_STATE.accentColor)
                    ? 'preset'
                    : 'user'
                : state.accentColor === DEFAULT_APPEARANCE_STATE.accentColor
                    ? 'preset'
                    : 'user';
    const normalizedAccentColor = resolveAccentColor(
        normalizedTheme,
        normalizedPresetId,
        parseStoredAccentColor(state.accentColor),
        normalizedAccentSource,
    );
    const sanitizedCustomTheme = normalizedPresetId
        ? extractThemeOverrides(normalizedTheme, normalizedPresetId, state.customTheme)
        : pruneThemeConfig(state.customTheme);

    return {
        accentColor: normalizedAccentColor,
        accentColorSource: normalizedAccentSource,
        customTheme: sanitizedCustomTheme,
        theme: normalizedTheme,
        themePresetId: normalizedPresetId,
    };
}

export function deserializeAppearanceState(raw: string | null): AppearanceSettingsState {
    if (raw) {
        try {
            const parsed = JSON.parse(raw) as Partial<AppearanceSettingsState>;
            const storedAccentColor = typeof parsed.accentColor === 'string' ? parsed.accentColor : null;
            return normalizeAppearanceState({
                accentColor: parseStoredAccentColor(storedAccentColor),
                accentColorSource: parsed.accentColorSource === 'user'
                    ? 'user'
                    : parsed.accentColorSource === 'preset'
                        ? 'preset'
                        : storedAccentColor ? undefined : 'preset',
                customTheme: pruneThemeConfig(parsed.customTheme),
                theme: parsed.theme === 'light' ? 'light' : 'dark',
                themePresetId: typeof parsed.themePresetId === 'string' ? parsed.themePresetId : null,
            });
        } catch {
            // Fall through to legacy key migration.
        }
    }

    const legacyTheme = parseStoredTheme(localStorage.getItem('settings_theme'));
    const legacyAccentRaw = localStorage.getItem('settings_accentColor');
    const legacyAccentColor = parseStoredAccentColor(legacyAccentRaw);
    const explicitPresetId = parseStoredThemePresetId(localStorage.getItem('settings_themePresetId'));
    const legacyCustomTheme = parseStoredCustomTheme(localStorage.getItem('settings_customTheme'));
    const inferredPresetId = explicitPresetId ?? inferThemePresetId(legacyTheme, legacyCustomTheme)
        ?? (Object.keys(legacyCustomTheme).length === 0 ? 'default' : null);

    return normalizeAppearanceState({
        accentColor: legacyAccentColor,
        accentColorSource: legacyAccentRaw ? undefined : 'preset',
        customTheme: explicitPresetId ? extractThemeOverrides(legacyTheme, explicitPresetId, legacyCustomTheme) : isLegacyPresetConfig(legacyTheme, inferredPresetId, legacyCustomTheme) ? {} : legacyCustomTheme,
        theme: legacyTheme,
        themePresetId: inferredPresetId,
    });
}

export function serializeAppearanceState(state: AppearanceSettingsState) {
    return JSON.stringify(normalizeAppearanceState(state));
}

export function deserializeSavedThemes(raw: string | null): SavedTheme[] {
    if (!raw) return [];
    try {
        const parsed = JSON.parse(raw) as unknown;
        if (!Array.isArray(parsed)) return [];
        return parsed.flatMap((entry): SavedTheme[] => {
            if (!entry || typeof entry !== 'object') return [];
            const candidate = entry as Partial<SavedTheme>;
            if (typeof candidate.id !== 'string' || typeof candidate.name !== 'string' || !candidate.name.trim()) return [];
            return [{ ...normalizeAppearanceState({
                accentColor: candidate.accentColor ?? DEFAULT_APPEARANCE_STATE.accentColor,
                accentColorSource: candidate.accentColorSource,
                customTheme: candidate.customTheme ?? {},
                theme: candidate.theme ?? DEFAULT_APPEARANCE_STATE.theme,
                themePresetId: candidate.themePresetId ?? null,
            }), id: candidate.id, name: candidate.name.trim() }];
        });
    } catch { return []; }
}

