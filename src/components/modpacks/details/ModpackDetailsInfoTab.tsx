import React from 'react';
import { Button } from '../../ui/Button';
import type { ModpackMetadata } from '@shared/types/modpack';
import { ModpackDependencySummary } from '../../sidebar/ModpackDependencySummary';
import {
  getModpackRuntimeSourceDescription,
  type ModpackRuntimeSummary,
} from '../../../features/modpacks/hooks/useModpackRuntimeSummary';

export interface ModpackDetailsInfoTabProps {
  descriptionDraft: string;
  onDescriptionChange: (value: string) => void;
  onSaveDescription: () => void;
  metadata: ModpackMetadata | null;
  runtimeSummary: ModpackRuntimeSummary;
  t: (key: string) => string;
}

export const ModpackDetailsInfoTab: React.FC<ModpackDetailsInfoTabProps> = ({
  descriptionDraft,
  onDescriptionChange,
  onSaveDescription,
  metadata,
  runtimeSummary,
  t,
}) => {
  const descriptionId = React.useId();

  return (
  <div className="modpack-details-info space-y-5">
    <section className="modpack-details-runtime-section surface-card space-y-4 p-4 sm:p-5" data-testid="modpack-details-runtime-panel">
      <div className="space-y-2">
        <div>
          <h3 className="text-lg font-semibold text-foreground">
            {t('modpacks.runtime_summary_title') === 'modpacks.runtime_summary_title'
              ? 'What you need to play'
              : t('modpacks.runtime_summary_title')}
          </h3>
          <p className="text-sm leading-6 text-secondary">
            {getModpackRuntimeSourceDescription(runtimeSummary.source, t)}
          </p>
        </div>
      </div>

      <ModpackDependencySummary
        runtime={runtimeSummary.runtime}
        status={runtimeSummary.status}
        t={t}
        className="modpack-details-runtime-summary rounded-none border-0 bg-transparent p-0 shadow-none"
      />
    </section>

    <section className="modpack-details-description-section surface-card space-y-4 p-4 sm:p-5">
      <div>
        <label htmlFor={descriptionId} className="mb-2 block text-sm font-semibold text-foreground">
          {t('modpacks.description')}
        </label>
        <textarea
          id={descriptionId}
          className="w-full min-h-[80px] resize-y rounded-lg border border-border bg-background/70 px-3 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-[rgb(var(--accent-main))]"
          value={descriptionDraft}
          onChange={(e) => onDescriptionChange(e.target.value)}
          placeholder={
            (() => {
              const raw = t('modpacks.description_placeholder');
              return raw === 'modpacks.description_placeholder' ? 'Кратко опишите модпак' : raw;
            })()
          }
        />
        <div className="mt-2 flex justify-end">
          <Button variant="secondary" size="sm" onClick={onSaveDescription}>
            {(() => {
              const raw = t('general.save');
              return raw === 'general.save' ? 'Сохранить' : raw;
            })()}
          </Button>
        </div>
      </div>
      {metadata?.source && (
        <div>
          <h4 className="mb-2 text-sm font-semibold text-foreground">
            {t('modpacks.source') || 'Источник'}
          </h4>
          <p className="text-sm text-secondary capitalize">
            {metadata.source === 'curseforge'
              ? t('modpacks.platform_curseforge')
              : metadata.source === 'modrinth'
                ? t('modpacks.platform_modrinth')
                : t('modpacks.platform_local')}
          </p>
        </div>
      )}
    </section>
  </div>
  );
};
