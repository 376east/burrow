import type { CustomThemeConfig } from './types';

export function normalizeThemeConfig(config: CustomThemeConfig, options?: { includeBrand?: boolean }): string {
    const colors = config.colors
        ? Object.fromEntries(
            Object.entries(config.colors)
                .filter(([, value]) => Boolean(value))
                .sort(([left], [right]) => left.localeCompare(right))
        )
        : undefined;

    const background = config.background
        ? Object.fromEntries(
            Object.entries(config.background)
                .filter(([, value]) => value !== undefined)
                .sort(([left], [right]) => left.localeCompare(right))
        )
        : undefined;

    const brand = options?.includeBrand === false || !config.brand
        ? undefined
        : config.brand
        ? Object.fromEntries(
            Object.entries(config.brand)
                .filter(([, value]) => Boolean(value))
                .sort(([left], [right]) => left.localeCompare(right))
        )
        : undefined;

    return JSON.stringify({
        ...(colors ? { colors } : {}),
        ...(background ? { background } : {}),
        ...(brand ? { brand } : {}),
    });
}

