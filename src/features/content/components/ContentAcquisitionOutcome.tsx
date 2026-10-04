import type { ContentAcquisitionController, ContentAcquisitionItem, ContentAcquisitionSelection } from '../contentAcquisitionTypes';
import type { ContentAcquisitionLabels, ContentAcquisitionSurfaceTestIds } from './ContentAcquisitionSurface';
import { Button } from '../../../components/ui/Button';

export function ContentAcquisitionOutcome<Item extends ContentAcquisitionItem, Selection extends ContentAcquisitionSelection>({ state, labels, testIds, isMutating }: { state: ContentAcquisitionController<Item, Selection>; labels: ContentAcquisitionLabels; testIds?: ContentAcquisitionSurfaceTestIds; isMutating: boolean }) {
  const outcomeTone = state.outcome?.isPresentationSuccess
    ? 'success'
    : state.outcome?.didCommit || state.outcome?.issues.every(({ code }) => code === 'duplicate')
      ? 'warning'
      : 'error';

  return (<>
        {state.outcome ? (
          <section
            role="status"
            aria-label={state.outcome.isPresentationSuccess ? (labels.success ?? labels.install) : labels.partial}
            aria-live="polite"
            data-testid={testIds?.outcome}
            data-tone={outcomeTone}
            data-acquisition-committed={String(state.outcome.didCommit)}
            data-presentation-success={String(state.outcome.isPresentationSuccess)}
            className={outcomeTone === 'success'
              ? 'rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-4'
              : outcomeTone === 'warning'
                ? 'rounded-2xl border border-amber-500/25 bg-amber-500/10 p-4'
                : 'rounded-2xl border border-red-500/25 bg-red-500/10 p-4'}
          >
            <p className="text-sm font-medium text-foreground">
              {state.outcome.isPresentationSuccess ? (labels.success ?? labels.install) : labels.partial}
            </p>
            {state.outcome.issues.length > 0 ? (
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-secondary">
                {state.outcome.issues.map((issue) => {
                  const detail = issue.message ?? labels.issueMessages?.[issue.code];
                  return (
                    <li key={`${issue.selectionId}:${issue.code}`}>
                      {issue.label}{detail ? `: ${detail}` : ''}
                    </li>
                  );
                })}
              </ul>
            ) : null}
            {state.outcome.retainedSelectionIds.length > 0 ? (
              <Button disabled={isMutating} className="mt-3" variant="secondary" size="sm" onClick={() => { void state.retryFailed(); }}>
                {labels.retry}
              </Button>
            ) : null}
          </section>
        ) : null}
  </>);
}
