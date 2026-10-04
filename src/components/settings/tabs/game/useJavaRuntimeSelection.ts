import { useCallback, useEffect, useRef, useState } from 'react';
import type { JavaRuntimeInstallationDto } from '@shared/contracts';
import { javaRuntimeIPC } from '../../../../services/ipc/javaRuntimeIPC';
import { translateWithFallback } from './runtimeWarnings';

export function useJavaRuntimeSelection(instanceId: string | null, t: (key: string) => string) {
  const [detectedJavas, setDetectedJavas] = useState<readonly JavaRuntimeInstallationDto[]>([]);
  const [selectedInstallationId, setSelectedInstallationId] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [isSelectingJava, setIsSelectingJava] = useState(false);
  const [scanError, setScanError] = useState('');
  const [selectionError, setSelectionError] = useState('');
  const generation = useRef(0);
  const selecting = useRef(false);

  const loadJava = useCallback(async (id: string | null, request: number) => {
    setIsScanning(true);
    setScanError('');
    setSelectionError('');
    try {
      const result = await javaRuntimeIPC.scan();
      if (request !== generation.current) return;
      const selection = id ? await javaRuntimeIPC.get({ instanceId: id }) : { installationId: null };
      if (request !== generation.current) return;
      setDetectedJavas(result);
      setSelectedInstallationId(result.some((java) => java.id === selection.installationId) ? selection.installationId : null);
    } catch {
      if (request === generation.current) {
        setScanError(translateWithFallback(t, 'settings.java_scan_failed', 'Could not load Java installations. Rescan to try again.'));
      }
    } finally {
      if (request === generation.current) setIsScanning(false);
    }
  }, [t]);

  useEffect(() => {
    setDetectedJavas([]);
    setSelectedInstallationId(null);
    void loadJava(instanceId, ++generation.current);
    return () => { generation.current += 1; };
  }, [instanceId, loadJava]);

  const scanJava = () => {
    if (selecting.current) return;
    void loadJava(instanceId, ++generation.current);
  };

  const handleJavaChange = async (installationId: string) => {
    if (!instanceId || selecting.current || isScanning || scanError) return;
    const request = generation.current;
    selecting.current = true;
    setIsSelectingJava(true);
    setSelectionError('');
    try {
      await javaRuntimeIPC.select({ instanceId, installationId: installationId || null });
      if (request === generation.current) setSelectedInstallationId(installationId || null);
    } catch {
      if (request === generation.current) {
        setSelectionError(translateWithFallback(t, 'settings.java_select_failed', 'Could not confirm the Java selection. Rescan and try again.'));
      }
    } finally {
      selecting.current = false;
      setIsSelectingJava(false);
    }
  };

  return { detectedJavas, selectedInstallationId, isScanning, isSelectingJava, scanError, selectionError, scanJava, handleJavaChange };
}
