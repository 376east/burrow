import { getThemeModeLabel, getThemePreset, getThemePresetLabel, getThemePresetSummary } from '../../../contexts/settings/theme-presets';
import type { AppearancePresetsProps } from './AppearancePresets';

type Translate = (key: string, params?: Record<string, string | number>) => string;

export function translateWithFallback(
  t: Translate,
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

export function getAppearancePresetLabels({ t, theme, themePresetId, themeRuntimeState }: Pick<AppearancePresetsProps, 't' | 'theme' | 'themePresetId' | 'themeRuntimeState'>) {
  const selectedPreset = getThemePreset(themePresetId);
  const themePresetsLabel = translateWithFallback(t, 'settings.theme_presets', 'Theme Presets');
  const themePresetsDescription = translateWithFallback(
    t,
    'settings.theme_presets_desc',
    'Apply a ready-made shell and surface profile, or import/export your own configuration.',
  );
  const themeDescription = translateWithFallback(
    t,
    'settings.theme_desc',
    'Choose the base shell mood of the launcher, then fine-tune accent and background behavior below.',
  );
  const customThemeExportName = translateWithFallback(
    t,
    'settings.theme_custom_export_name',
    'Custom Theme',
  );
  const selectedPresetLabel = getThemePresetLabel(t, selectedPreset);
  const selectedPresetSummary = getThemePresetSummary(t, selectedPreset, theme);
  const selectedModeLabel = getThemeModeLabel(t, theme);
  const hasCustomizations = themeRuntimeState.hasCustomizations;
  const runtimeModeState = translateWithFallback(
    t,
    themeRuntimeState.matchesPresetDefaultMode
      ? 'settings.theme_mode_default_state'
      : 'settings.theme_mode_variant_state',
    themeRuntimeState.matchesPresetDefaultMode ? 'Preset default' : 'Preset variant',
  );
  const runtimeStateLabel = selectedPreset
    ? translateWithFallback(
      t,
      hasCustomizations
        ? 'settings.theme_runtime_state_customized'
        : 'settings.theme_runtime_state_preset',
      hasCustomizations ? 'Customized preset' : 'Untouched preset',
    )
    : translateWithFallback(t, 'settings.theme_runtime_state_manual', 'Manual appearance');
  const runtimeDescription = selectedPreset
    ? hasCustomizations
      ? translateWithFallback(
        t,
        'settings.theme_runtime_customized_desc',
        '{{preset}} stays active in {{mode}} mode while bounded accent, background, and surface refinements are layered on top.',
        {
          mode: selectedModeLabel,
          preset: selectedPresetLabel ?? selectedPresetSummary ?? customThemeExportName,
        },
      )
      : translateWithFallback(
        t,
        themeRuntimeState.matchesPresetDefaultMode
          ? 'settings.theme_runtime_default_desc'
          : 'settings.theme_runtime_variant_desc',
        themeRuntimeState.matchesPresetDefaultMode
          ? '{{preset}} is active in its default {{mode}} mode. Switch modes to preview the other preset variant without leaving this preset family.'
          : '{{preset}} stays active while you preview its {{mode}} variant instead of the default.',
        {
          mode: selectedModeLabel,
          preset: selectedPresetLabel ?? selectedPresetSummary ?? customThemeExportName,
        },
      )
    : themeDescription;
  const resetPresetLabel = selectedPresetSummary
    ? translateWithFallback(
      t,
      'settings.reset_preset_customizations',
      `Return to ${selectedPresetSummary}`,
      { preset: selectedPresetSummary },
    )
    : translateWithFallback(t, 'settings.reset_custom_theme', 'Reset Custom Theme');
  const resetPresetDescription = selectedPresetSummary
    ? translateWithFallback(
      t,
      'settings.reset_preset_customizations_desc',
      `Remove refinements and return to the untouched ${selectedPresetSummary} runtime contract.`,
      { preset: selectedPresetSummary },
    )
    : '';
  const resetPresetA11yLabel = themePresetId
    ? resetPresetLabel
    : translateWithFallback(t, 'settings.reset_to_preset', 'Reset to Preset');
  const appearanceHeading = selectedPresetSummary
    || translateWithFallback(t, 'settings.theme_runtime_state_manual', 'Manual appearance');
  const appearanceStateChips = selectedPreset
    ? [runtimeModeState, runtimeStateLabel]
    : [selectedModeLabel];
  const appearanceStatusText = selectedPreset
    ? appearanceStateChips.join(' · ')
    : runtimeDescription;

  return { selectedPreset, themePresetsLabel, themePresetsDescription, customThemeExportName, selectedPresetSummary, hasCustomizations, resetPresetDescription, resetPresetA11yLabel, resetPresetLabel, appearanceHeading, appearanceStateChips, appearanceStatusText };
}
