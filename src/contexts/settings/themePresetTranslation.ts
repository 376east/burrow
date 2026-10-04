export type ThemeTranslator = (key: string, params?: Record<string, string | number>) => string;

export function translateWithFallback(
    t: ThemeTranslator,
    key: string,
    fallback: string,
    params?: Record<string, string | number>,
): string {
    const translated = t(key, params);
    if (translated !== key) {
        return translated;
    }

    if (!params) {
        return fallback;
    }

    return Object.entries(params).reduce(
        (text, [paramKey, value]) => text.replace(new RegExp(`{{${paramKey}}}`, 'g'), String(value)),
        fallback,
    );
}

