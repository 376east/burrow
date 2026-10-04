import { ContentAcquisitionOutcome } from './ContentAcquisitionOutcome';
import type { ReactNode } from 'react';
import type {
  AcquisitionIssue,
  ContentAcquisitionController,
  ContentAcquisitionItem,
  ContentAcquisitionSelection,
} from '../contentAcquisitionTypes';
import { Button } from '../../../components/ui/Button';
import { DegradedStateView } from '../../../components/layout/DegradedStateView';
import { toDisplayErrorMessage } from '../../../utils/displayError';

export type ContentAcquisitionLabels = {
  search: string;
  loading: string;
  empty: string;
  emptyDescription?: string;
  error: string;
  errorDescription?: string;
  retry: string;
  loadMore: string;
  install: string;
  installing: string;
  localImport: string;
  selected: string;
  partial: string;
  success?: string;
  searchPlaceholder?: string;
  issueMessages?: Partial<Record<AcquisitionIssue['code'], string>>;
};

export type ContentAcquisitionSurfaceTestIds = {
  resultsViewport?: string;
  results?: string;
  actions?: string;
  outcome?: string;
  localImport?: string;
};

export function ContentAcquisitionSurface<
  Item extends ContentAcquisitionItem,
  Selection extends ContentAcquisitionSelection,
>({
  state,
  labels,
  controls,
  secondaryAction,
  renderItem,
  testIds,
  className = 'space-y-4',
  resultsClassName = '',
  actionsClassName = '',
}: {
  state: ContentAcquisitionController<Item, Selection>;
  labels: ContentAcquisitionLabels;
  controls?: ReactNode;
  secondaryAction?: ReactNode;
  renderItem?: (item: Item, selection: Selection | undefined) => ReactNode;
  testIds?: ContentAcquisitionSurfaceTestIds;
  className?: string;
  resultsClassName?: string;
  actionsClassName?: string;
}) {
  const selectedCount = state.selections.size;
  const isMutating = state.isInstalling || state.isImportingLocal;
  const isInitialLoading = state.searchStatus === 'loading' && state.items.length === 0;
  const showEmpty = state.searchStatus === 'ready' && state.items.length === 0;

  return (
    <section
      className={className}
      aria-busy={state.searchStatus === 'loading' || isMutating || undefined}
      data-secondary-content-workspace="shared"
    >
      <label className="block space-y-1.5">
        <span className="control-label">{labels.search}</span>
        <input
          type="search"
          disabled={isMutating}
          value={state.query}
          onChange={(event) => state.setQuery(event.target.value)}
          aria-label={labels.search}
          placeholder={labels.searchPlaceholder}
          className="control-frame min-h-11 w-full px-4 py-2.5 text-sm"
        />
      </label>

      {controls ? <fieldset disabled={isMutating} className="min-w-0">{controls}</fieldset> : null}

      <div className={resultsClassName} data-testid={testIds?.resultsViewport}>
        {isInitialLoading ? (
          <div role="status" aria-live="polite" className="surface-muted p-4 text-sm text-secondary">
            {labels.loading}
          </div>
        ) : null}

        {state.searchStatus === 'error' ? (
          <DegradedStateView
            variant="error"
            layout="inline"
            title={labels.error}
            description={toDisplayErrorMessage(state.error, labels.errorDescription ?? labels.error)}
            footer={<Button variant="secondary" onClick={() => { void state.retrySearch(); }}>{labels.retry}</Button>}
          />
        ) : null}

        {showEmpty ? (
          <DegradedStateView
            variant={state.query.trim() ? 'zero-results' : 'empty'}
            layout="inline"
            title={labels.empty}
            description={labels.emptyDescription}
          />
        ) : null}

        {state.items.length > 0 ? (
          <ul role="list" className="grid grid-cols-1 gap-3 md:grid-cols-2" data-testid={testIds?.results}>
            {state.items.map((item) => {
              const checked = state.checkedIds.has(item.id);
              const resolving = state.resolvingIds.has(item.id);
              return (
                <li key={item.id} className="surface-soft min-w-0 p-4">
                  <label className="flex cursor-pointer items-start gap-3">
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={isMutating || resolving}
                      onChange={(event) => { void state.toggle(item, event.target.checked); }}
                      aria-label={`${item.label}${checked ? `, ${labels.selected}` : ''}`}
                      className="mt-1 h-4 w-4"
                    />
                    {renderItem ? renderItem(item, state.selections.get(item.id)) : (
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-foreground">{item.label}</span>
                        {item.description ? <span className="mt-1 block text-sm text-secondary">{item.description}</span> : null}
                      </span>
                    )}
                  </label>
                </li>
              );
            })}
          </ul>
        ) : null}

        {state.nextPage !== null ? (
          <Button
            variant="secondary"
            onClick={() => { void state.loadNextPage(); }}
            isLoading={state.searchStatus === 'loading-more'}
          >
            {labels.loadMore}
          </Button>
        ) : null}
      </div>

      <div className={actionsClassName || 'space-y-3'} data-testid={testIds?.actions}>
        <ContentAcquisitionOutcome state={state} labels={labels} testIds={testIds} isMutating={isMutating} />
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        {secondaryAction}
        {state.canImportLocal ? (
          <Button
            variant="secondary"
            onClick={() => { void state.importLocal(); }}
            isLoading={state.isImportingLocal}
            disabled={isMutating}
            data-testid={testIds?.localImport}
          >
            {labels.localImport}
          </Button>
        ) : null}
        <Button
          onClick={() => { void state.installSelected(); }}
          disabled={isMutating || selectedCount === 0 || state.resolvingIds.size > 0}
          isLoading={state.isInstalling}
        >
          {state.isInstalling ? labels.installing : labels.install}
        </Button>
        </div>
      </div>
    </section>
  );
}
