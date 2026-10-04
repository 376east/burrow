import { useCallback, useRef, useState } from 'react';
import type { ContentAcquisitionSelection } from '../contentAcquisitionTypes';

export function useAcquisitionSelectionStore<Selection extends ContentAcquisitionSelection>() {
  const [checkedIds, setCheckedIds] = useState<ReadonlySet<string>>(new Set());
  const [selections, setSelections] = useState<ReadonlyMap<string, Selection>>(new Map());
  const checkedRef = useRef<ReadonlySet<string>>(new Set());
  const selectionsRef = useRef<ReadonlyMap<string, Selection>>(new Map());
  const publishChecked = useCallback((next: ReadonlySet<string>) => {
    checkedRef.current = next;
    setCheckedIds(next);
  }, []);

  const publishSelections = useCallback((next: ReadonlyMap<string, Selection>) => {
    selectionsRef.current = next;
    setSelections(next);
  }, []);

  return { checkedIds, selections, checkedRef, selectionsRef, publishChecked, publishSelections };
}
