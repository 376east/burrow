import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ExternalLink, PackagePlus, RefreshCw, Trash2 } from 'lucide-react';
import type { ModEntry as SharedModEntry } from '@shared/types/mods';
import { useConfirm } from '../../../contexts/ConfirmContext';
import { useSettings } from '../../../contexts/SettingsContext';
import { useToast } from '../../../contexts/ToastContext';
import { externalLinksIPC } from '../../../services/ipc/externalLinksIPC';
import { instanceModsIPC } from '../../../services/ipc/instanceModsIPC';
import { cn } from '../../../utils/cn';
import { modNameToSlug } from '../../../utils/modSlug';
import { AddModModal } from '../AddModModal';
import { Button } from '../../ui/Button';
import { Input } from '../../ui/Input';
import { LoadingSpinner } from '../../ui/LoadingSpinner';
import { DegradedStateView } from '../../layout/DegradedStateView';
import { toDisplayErrorMessage } from '../../../utils/displayError';

export interface ModsTabProps {
    compact?: boolean;
    instanceId: string;
    showAddButton?: boolean;
    addDisabled?: boolean;
    isReadOnly?: boolean;
    defaultMCVersion?: string;
    defaultLoader?: string;
    onUpdate?: () => void;
    className?: string;
}

type ModEntry = SharedModEntry & { enabled: boolean };

function normalizeMods(list: SharedModEntry[]): ModEntry[] {
    return list.map((entry) => ({
        ...entry,
        enabled: !entry.file.name.endsWith('.disabled'),
    }));
}

export function ModsTab({
    compact = false,
    instanceId,
    showAddButton = false,
    addDisabled = false,
    isReadOnly = false,
    defaultMCVersion,
    defaultLoader,
    onUpdate,
    className,
}: ModsTabProps) {
    const { t } = useSettings();
    const [mods, setMods] = useState<ModEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [hasLoaded, setHasLoaded] = useState(false);
    const [loadError, setLoadError] = useState<unknown | null>(null);
    const [showAddModModal, setShowAddModModal] = useState(false);
    const [query, setQuery] = useState('');
    const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
    const pending = useRef(new Set<string>());
    const liveContext = useRef({ instanceId, isReadOnly });
    liveContext.current = { instanceId, isReadOnly };
    const confirm = useConfirm();
    const toast = useToast();
    const onUpdateRef = useRef(onUpdate);
    onUpdateRef.current = onUpdate;

    const loadMods = useCallback(async () => {
        setLoading(true);
        setLoadError(null);
        try {
            const list = await instanceModsIPC.list(instanceId);
            setMods(normalizeMods(list ?? []));
            onUpdateRef.current?.();
        } catch (err) {
            console.error('Failed to load mods:', err);
            setLoadError(err);
        } finally {
            setHasLoaded(true);
            setLoading(false);
        }
    }, [instanceId]);

    useEffect(() => {
        void loadMods();
    }, [loadMods]);

    const handleRemoveMod = useCallback(
        async (mod: ModEntry) => {
            if (isReadOnly || pending.current.has(mod.id)) return;
            const confirmed = await confirm.confirm({
                title: t('modpacks.remove_mod_title'),
                message: t('modpacks.remove_mod_confirm', { name: mod.name }),
                variant: 'danger',
                confirmText: t('modpacks.remove'),
                cancelText: t('general.cancel'),
            });

            if (!confirmed || liveContext.current.instanceId !== instanceId || liveContext.current.isReadOnly) {
                return;
            }

            try {
                await instanceModsIPC.remove(instanceId, mod.file.name);
                await loadMods();
            } catch (error) {
                console.error('Error removing mod:', error);
                toast.error(t('modpacks.remove_mod_error'));
            }
        },
        [confirm, instanceId, isReadOnly, loadMods, t, toast]
    );

    const handleModToggle = useCallback(
        async (mod: ModEntry) => {
            if (isReadOnly || pending.current.has(mod.id)) return;
            pending.current.add(mod.id);
            setPendingIds(new Set(pending.current));
            const enabled = !mod.enabled;

            setMods((prev) => prev.map((entry) => (entry.id === mod.id ? { ...entry, enabled } : entry)));

            try {
                await instanceModsIPC.setEnabled(instanceId, mod.file.name, enabled);
            } catch (error) {
                console.error('Error toggling mod:', error);
                setMods((prev) => prev.map((entry) => (entry.id === mod.id ? { ...entry, enabled: !enabled } : entry)));
                toast.error(t('modpacks.mod_toggle_error'));
            } finally {
                pending.current.delete(mod.id);
                setPendingIds(new Set(pending.current));
            }
        },
        [instanceId, isReadOnly, t, toast]
    );

    const handleOpenExternalLink = useCallback((url: string, context: string) => {
        void externalLinksIPC.open({ url, context }).catch((error) => {
            console.error('Failed to open external link:', error);
        });
    }, []);

    const enabledCount = useMemo(() => mods.filter((mod) => mod.enabled).length, [mods]);
    const visibleMods = useMemo(() => {
        const needle = query.trim().toLocaleLowerCase();
        return mods.filter(mod => `${mod.name} ${mod.file.name}`.toLocaleLowerCase().includes(needle));
    }, [mods, query]);

    return (
        <div className={cn('space-y-5', className)}>
            <div className="space-y-4 border-b border-border/65 pb-4">
                <div className="flex flex-col gap-3 min-[900px]:flex-row min-[900px]:items-start min-[900px]:justify-between">
                    <div className="min-w-0 flex-1 space-y-2">
                        <div className="kicker-label">{t('modpacks.tab_mods')}</div>
                        <div>
                            <h3 className={cn('font-semibold text-foreground', compact ? 'text-base' : 'text-lg')}>
                                {t('modpacks.installed_mods')} {!loading && <span className="text-secondary">({mods.length})</span>}
                            </h3>
                            {!compact && <p className="text-sm text-secondary">{t('modpacks.mods_description')}</p>}
                            {compact && !loading && mods.length > 0 && <p className="text-xs text-secondary">{enabledCount} {t('modpacks.enabled').toLowerCase()} / {mods.length}</p>}
                        </div>
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center gap-2 self-start" data-testid="mods-toolbar">
                        {showAddButton && (
                            <Button variant="primary" size="sm" geometry="catalog-primary" className="whitespace-nowrap" onClick={() => setShowAddModModal(true)} disabled={loading || addDisabled || isReadOnly}>
                                <PackagePlus className="h-4 w-4" />
                                {t('modpacks.add_mod_btn')}
                            </Button>
                        )}
                        <Button onClick={() => void loadMods()} variant="secondary" size="sm" geometry="catalog-primary" className="whitespace-nowrap" disabled={loading} isLoading={loading}>
                            <RefreshCw className="h-4 w-4" />
                            {t('modpacks.update')}
                        </Button>
                    </div>
                </div>

                {!compact && !loading && mods.length > 0 && (
                    <div className="flex flex-wrap items-center gap-3 border-t border-border/70 pt-4 text-sm text-secondary">
                        <span>{t('modpacks.mods_manage_hint')}</span>
                        <span className="text-foreground">
                            {enabledCount} {t('modpacks.enabled').toLowerCase()} / {mods.length}
                        </span>
                    </div>
                )}
            </div>

            {mods.length > 0 && <Input label={t('modpacks.search_installed')} value={query} onChange={event => setQuery(event.target.value)} type="search" />}
            {loading && !hasLoaded ? (
                <div className="surface-card flex min-h-40 items-center justify-center gap-3 rounded-xl p-5 text-sm text-secondary" role="status">
                    <LoadingSpinner size="sm" variant="accent" />
                    {t('modpacks.loading')}
                </div>
            ) : loadError && mods.length === 0 ? (
                <DegradedStateView
                    variant="unavailable"
                    layout="inline"
                    className="[&>div]:rounded-xl"
                    label={t('degraded.unavailable_label')}
                    title={t('error.inline_fallback')}
                    description={toDisplayErrorMessage(loadError, t('error.inline_fallback'))}
                    footer={<Button variant="secondary" size="sm" geometry="catalog-primary" onClick={() => void loadMods()}>{t('modpacks.update')}</Button>}
                />
            ) : mods.length === 0 ? (
                <DegradedStateView
                    variant="empty"
                    layout="inline"
                    className="[&>div]:rounded-xl"
                    label={t('degraded.empty_label')}
                    title={t('modpacks.no_mods_installed')}
                    description={t('modpacks.mods_empty_hint')}
                    footer={showAddButton ? (
                        <Button variant="primary" size="sm" disabled={addDisabled || isReadOnly} onClick={() => setShowAddModModal(true)}>
                            <PackagePlus className="h-4 w-4" />
                            {t('modpacks.add_mod_btn')}
                        </Button>
                    ) : undefined}
                />
            ) : visibleMods.length === 0 ? (
                <p className="helper-text py-4" role="status">{t('modpacks.search_installed_empty')}</p>
            ) : (
                <div className="space-y-3" role="list" aria-label={t('modpacks.installed_mods')}>
                    {visibleMods.map((mod) => (
                        <div
                            key={mod.id}
                            role="listitem"
                        className={cn(
                                'surface-card flex flex-col gap-4 rounded-xl p-4 lg:flex-row lg:items-start lg:justify-between',
                                !mod.enabled && 'opacity-75'
                            )}
                        >
                            <div className="min-w-0 flex-1 space-y-3">
                                <div className="flex flex-wrap items-center gap-2">
                                    <h4 className="truncate text-base font-semibold text-foreground">{mod.name}</h4>
                                    <span className="rounded-full border border-border/70 bg-background/70 px-2 py-0.5 text-xs font-medium text-secondary">
                                        {mod.version}
                                    </span>
                                    {mod.loaders.length > 0 && (
                                        <span className="rounded-full border border-border/70 bg-background/70 px-2 py-0.5 text-xs font-medium text-secondary">
                                            {mod.loaders.join(', ')}
                                        </span>
                                    )}
                                </div>

                                <p className="truncate text-sm text-secondary">{mod.file.name}</p>

                                <div className="flex flex-wrap gap-2">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="justify-start"
                                        onClick={() =>
                                            handleOpenExternalLink(
                                                `https://modrinth.com/mod/${modNameToSlug(mod.name)}`,
                                                `${mod.name} on Modrinth`,
                                            )
                                        }
                                    >
                                        <ExternalLink className="h-4 w-4" />
                                        {t('modpacks.open_modrinth')}
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="justify-start"
                                        onClick={() =>
                                            handleOpenExternalLink(
                                                `https://www.curseforge.com/minecraft/mc-mods/${modNameToSlug(mod.name)}`,
                                                `${mod.name} on CurseForge`,
                                            )
                                        }
                                    >
                                        <ExternalLink className="h-4 w-4" />
                                        {t('modpacks.open_curseforge')}
                                    </Button>
                                </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                                <Button
                                    variant={mod.enabled ? 'primary' : 'secondary'}
                                    size="sm"
                                    disabled={isReadOnly || pendingIds.has(mod.id)}
                                    isLoading={pendingIds.has(mod.id)}
                                    onClick={() => void handleModToggle(mod)}
                                >
                                    {mod.enabled ? t('general.disable') : t('general.enable')}
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    disabled={isReadOnly || pendingIds.has(mod.id)}
                                    className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                                    onClick={() => void handleRemoveMod(mod)}
                                    aria-label={t('modpacks.remove_mod_confirm', { name: mod.name })}
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {showAddButton && (
                <AddModModal
                    modpackId={instanceId}
                    isOpen={showAddModModal && !isReadOnly && !addDisabled}
                    onClose={() => setShowAddModModal(false)}
                    onAdded={loadMods}
                    defaultMCVersion={defaultMCVersion}
                    defaultLoader={defaultLoader}
                />
            )}
        </div>
    );
}
