import { cn } from '../../../utils/cn';
import type { ModpackRuntimeSummary } from '../../../features/modpacks/hooks/useModpackRuntimeSummary';
import {
    getModpackShaderCapabilityDescription,
    getModpackShaderCapabilityLabel,
    getModpackShaderCapabilityTone,
} from '../../../features/modpacks/hooks/useModpackRuntimeSummary';

export function ShaderCapabilitySummary({ runtimeSummary, t }: { runtimeSummary?: ModpackRuntimeSummary | null; t: (key: string) => string }) {
    const shaderCapabilityStatus = runtimeSummary?.shaderCapability.status ?? 'unverified';
    const shaderCapabilityTone = getModpackShaderCapabilityTone(shaderCapabilityStatus);
    const shaderCapabilityLabel = getModpackShaderCapabilityLabel(shaderCapabilityStatus, t);
    const shaderCapabilityDescription = runtimeSummary
        ? getModpackShaderCapabilityDescription(runtimeSummary, t)
        : (
            t('modpacks.shader_capability_missing_runtime_desc')
            || 'Burrow could not verify this modpack runtime yet, so shader compatibility is still unverified.'
        );
    const shaderCapabilityHint =
        t('modpacks.shader_capability_active_hint')
        || 'An active shader file only means Burrow stored the selection. It is not proof that the pack will render correctly.';

  return (
                <div
                    className={cn(
                        'space-y-2 border-l-2 pl-4',
                        shaderCapabilityTone === 'positive' && 'border-emerald-500/60',
                        shaderCapabilityTone === 'warning' && 'border-amber-600/70',
                        shaderCapabilityTone === 'error' && 'border-red-500/70',
                        shaderCapabilityTone === 'neutral' && 'border-border/70',
                    )}
                    data-testid="shader-capability-summary"
                    data-status={shaderCapabilityStatus}
                >
                    <div className="flex flex-wrap items-center gap-2">
                        <div className="kicker-label">
                            {t('modpacks.shader_capability_heading') || 'Shader runtime'}
                        </div>
                        <span
                            className={cn(
                                'rounded-full border px-2 py-0.5 text-xs font-medium',
                                shaderCapabilityTone === 'positive' && 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
                                shaderCapabilityTone === 'warning' && 'border-amber-500/35 bg-background text-amber-800 dark:text-amber-200',
                                shaderCapabilityTone === 'error' && 'border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-200',
                                shaderCapabilityTone === 'neutral' && 'border-border/70 bg-background/70 text-secondary',
                            )}
                        >
                            {shaderCapabilityLabel}
                        </span>
                    </div>
                    <p className="text-sm text-foreground">{shaderCapabilityDescription}</p>
                    <p className="text-xs text-secondary">{shaderCapabilityHint}</p>
                </div>
  );
}
