import { ArrowLeft } from 'lucide-react';
import { Breadcrumbs } from '../../ui/Breadcrumbs';
import { Button } from '../../ui/Button';

interface ModpackDetailsRouteHeaderProps {
  modpackName: string;
  modpacksLabel: string;
  backLabel: string;
  onBack: () => void;
}

export function ModpackDetailsRouteHeader({
  modpackName,
  modpacksLabel,
  backLabel,
  onBack,
}: ModpackDetailsRouteHeaderProps) {
  return <div className="modpack-details-route-header border-b border-border/70 bg-card/78 px-4 py-3 backdrop-blur-md sm:px-7 lg:px-10" data-testid="modpack-details-route-top">
    <div className="mx-auto flex w-full max-w-[67rem] flex-wrap items-center justify-between gap-3">
      <Breadcrumbs items={[{ label: modpacksLabel, onClick: onBack }, { label: modpackName, active: true }]} />
      <Button variant="secondary" size="sm" onClick={onBack} className="flex items-center gap-2">
        <ArrowLeft aria-hidden="true" className="h-4 w-4" />
        {backLabel}
      </Button>
    </div>
  </div>;
}
