import { useMemo } from 'react';
import type { ProviderCatalogContentEntry } from '@shared/contracts';

export function RemoteModpackContents({ contents, contentsLoading, contentsError, contentsTruncated, t }: { contents: readonly ProviderCatalogContentEntry[]; contentsLoading: boolean; contentsError: boolean; contentsTruncated: boolean; t: (key: string) => string }) {
  const contentGroups = useMemo(() => ({
    mod: contents.filter((entry) => entry.kind === 'mod'),
    resourcepack: contents.filter((entry) => entry.kind === 'resourcepack'),
    shader: contents.filter((entry) => entry.kind === 'shader'),
    other: contents.filter((entry) => entry.kind === 'other'),
  }), [contents]);

  return (
          <section className="surface-card space-y-3 p-4" aria-live="polite" data-testid="remote-modpack-contents">
            <div>
              <h3 className="text-base font-semibold text-foreground">{t('modpacks.included_contents') === 'modpacks.included_contents' ? 'Included contents' : t('modpacks.included_contents')}</h3>
              <p className="mt-1 text-sm text-secondary">
                {t('modpacks.contents_manifest_hint') === 'modpacks.contents_manifest_hint' ? 'Read from this version’s archive manifest; no modpack is installed.' : t('modpacks.contents_manifest_hint')}
              </p>
            </div>
            {contentsLoading ? <p className="text-sm text-secondary">{t('modpacks.loading')}</p> : contentsError ? (
              <p className="text-sm text-secondary">{t('modpacks.contents_unavailable') === 'modpacks.contents_unavailable' ? 'The provider did not make this version’s manifest available.' : t('modpacks.contents_unavailable')}</p>
            ) : (
              <div className="space-y-3">
                {([['mod', 'Mods'], ['resourcepack', 'Resource packs'], ['shader', 'Shaders'], ['other', 'Other included files']] as const).map(([kind, fallback]) => contentGroups[kind].length > 0 && (
                  <div key={kind}>
                    <p className="helper-text mb-1">{t(`modpacks.contents_${kind}`) === `modpacks.contents_${kind}` ? fallback : t(`modpacks.contents_${kind}`)} ({contentGroups[kind].length})</p>
                    <ul className="max-h-40 space-y-1 overflow-y-auto text-sm text-foreground" aria-label={t(`modpacks.contents_${kind}`) === `modpacks.contents_${kind}` ? fallback : t(`modpacks.contents_${kind}`)}>
                      {contentGroups[kind].map((entry, index) => <li key={`${entry.label}-${index}`} className="truncate" title={entry.label}>{entry.label}</li>)}
                    </ul>
                  </div>
                ))}
                {contents.length === 0 && <p className="text-sm text-secondary">{t('modpacks.contents_empty') === 'modpacks.contents_empty' ? 'This version’s manifest does not list included files.' : t('modpacks.contents_empty')}</p>}
                {contentsTruncated && <p className="text-sm text-secondary">{t('modpacks.contents_truncated') === 'modpacks.contents_truncated' ? 'Only the first 500 included files are shown.' : t('modpacks.contents_truncated')}</p>}
              </div>
            )}
          </section>

  );
}
