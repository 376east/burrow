import { CLOSEOUT_VIEWS, CORE_VIEWS, GENERAL_VIEWS, LEGACY_VIEWS, type ManualVerificationView, type ManualVerificationViewMeta } from './views';

export function ManualVerificationNavigation(props: { activeView: ManualVerificationView }) {
  // This header belongs to the verification fixture, not the product shell.
  // Keep the product proof visible while retaining every closeout route and the hub.
  const isCloseout = CLOSEOUT_VIEWS.some((view) => view.id === props.activeView);
  const sections: Array<{ title: string; views: ManualVerificationViewMeta[] }> = [
    { title: 'Closeout', views: CLOSEOUT_VIEWS },
    ...(!isCloseout ? [
      { title: 'Shared', views: GENERAL_VIEWS },
      { title: 'Legacy', views: LEGACY_VIEWS },
    ] : []),
  ];

  return (
    <nav className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {CORE_VIEWS.filter((view) => view.group === 'hub').map((view) => {
          const isActive = props.activeView === view.id;
          return (
            <a
              key={view.id}
              href={`?view=${view.id}`}
              className={[
                'rounded-full border px-3 py-1.5 text-sm transition-colors',
                isActive
                  ? 'border-border-active bg-card text-foreground'
                  : 'border-border/70 text-secondary hover:border-border-active hover:text-foreground',
              ].join(' ')}
            >
              {view.label}
            </a>
          );
        })}
      </div>

      {sections.map((section) => (
        <div key={section.title} className="space-y-2">
          <div className="kicker-label">{section.title}</div>
          <div className="flex flex-wrap gap-2">
            {section.views.map((view) => {
              const isActive = props.activeView === view.id;
              return (
                <a
                  key={view.id}
                  href={`?view=${view.id}`}
                  className={[
                    'rounded-full border px-3 py-1.5 text-sm transition-colors',
                    isActive
                      ? 'border-border-active bg-card text-foreground'
                      : 'border-border/70 text-secondary hover:border-border-active hover:text-foreground',
                  ].join(' ')}
                >
                  {view.label}
                </a>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}
