import { Globe2, Settings2 } from 'lucide-react';
import { Button } from '../ui/Button';
import { Tooltip } from '../ui/Tooltip';
import { SIDEBAR_COMPACT_CONTROL_CLASSNAME } from './controlGeometry';

export function CollapsedSidebarActions({ actions, isLaunching, t }: { actions: { onShowMultiplayer: () => void; onShowSettings: () => void }; isLaunching: boolean; t: (key: string) => string }) {
  return (
                <div className="flex-1 flex flex-col items-center gap-2 opacity-100 pointer-events-auto">
                    <Button
                        variant="ghost"
                        size="sm"
                        geometry="compact-control"
                        onClick={actions.onShowMultiplayer}
                        disabled={isLaunching}
                        aria-label={t('multiplayer.title') || 'Multiplayer'}
                        className={SIDEBAR_COMPACT_CONTROL_CLASSNAME}
                        style={{
                            transitionDelay: '100ms',
                        }}
                        title={t('multiplayer.title') || 'Multiplayer'}
                    >
                        <Globe2 className="h-5 w-5" />
                    </Button>
                    <Tooltip content={<span>{t('general.settings')} <span className="text-zinc-400 text-xs ml-1">Ctrl+,</span></span>} position="right">
                        <Button
                            variant="ghost"
                            size="sm"
                            geometry="compact-control"
                            onClick={actions.onShowSettings}
                            disabled={isLaunching}
                            aria-label={t('general.settings') || 'Settings'}
                            className={SIDEBAR_COMPACT_CONTROL_CLASSNAME}
                            style={{
                                transitionDelay: '200ms',
                            }}
                        >
                            <Settings2 className="h-5 w-5" />
                        </Button>
                    </Tooltip>
                </div>
  );
}
