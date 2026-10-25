import { Component, Suspense, lazy, useEffect, useId, useState } from 'react';
import type { ReactNode } from 'react';
import { Button } from '../components/ui/Button';

const WorldIllustration = lazy(() => import('./PlayWorldIllustration'));
const artwork = new URL('../../public/burrow-campfire.webp', import.meta.url).href;

class IllustrationBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

export function PlayArtwork({ disableAnimations, t }: { disableAnimations: boolean; t: (key: string) => string }) {
  const [open, setOpen] = useState(false);
  const [reduced, setReduced] = useState(() => window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? true);
  const regionId = useId();
  useEffect(() => {
    const preference = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(preference?.matches ?? true);
    preference?.addEventListener('change', update);
    return () => preference?.removeEventListener('change', update);
  }, []);
  const suppressed = reduced || disableAnimations;
  const expanded = open && !suppressed;
  const picture = <div className="next-play-picture"><img src={artwork} alt="" className="next-play-landscape" fetchPriority="high" /></div>;
  const unavailable = <>{picture}<p className="helper-text" role="status">{t('play_workspace.world_unavailable')}</p></>;
  return <section className="next-play-artwork" data-expanded={expanded} aria-label={t('play_workspace.world_title')}>
    <div id={regionId} className="next-world-region">
      {expanded ? <IllustrationBoundary fallback={unavailable}><Suspense fallback={<>{picture}<p role="status" className="helper-text">{t('play_workspace.world_loading')}</p></>}><WorldIllustration fallback={unavailable} t={t} /></Suspense></IllustrationBoundary> : picture}
    </div>
    <div className="next-world-artwork-footer">
      <Button variant="ghost" size="sm" disabled={suppressed} aria-expanded={expanded} aria-controls={regionId} onClick={() => setOpen(!expanded)}>{t(expanded ? 'play_workspace.world_close' : 'play_workspace.world_open')}</Button>
      <p className="helper-text">{t(suppressed ? 'play_workspace.world_static' : 'play_workspace.world_disclaimer')}</p>
    </div>
  </section>;
}
