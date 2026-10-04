import type { JavaRuntimeInstallationDto } from '@shared/contracts';

export function translateWithFallback(
  t: (key: string, params?: Record<string, string | number>) => string,
  key: string,
  fallback: string,
  params?: Record<string, string | number>,
) {
  const translated = t(key, params);
  return translated === key ? fallback : translated;
}

export function getRuntimeWarnings(selectedJava: JavaRuntimeInstallationDto | undefined, currentRam: number, requiredJavaVer: number, minecraftVersion: string, t: (key: string, params?: Record<string, string | number>) => string) {
  const warnings: string[] = [];

  // 32-bit check
  if (selectedJava?.arch === 'x86' && currentRam > 1.5) {
    warnings.push(
      translateWithFallback(
        t,
        'settings.warning_32bit_java',
        'You are using 32-bit Java with more than 1.5 GB of RAM. This may cause crashes.',
      ),
    );
  }

  // Java version mismatch
  if (selectedJava && selectedJava.majorVersion !== requiredJavaVer) {
    warnings.push(
      translateWithFallback(
        t,
        'settings.warning_java_version',
        'Minecraft {{version}} requires exactly Java {{required}}. Selected: Java {{selected}}.',
        {
          version: minecraftVersion,
          required: requiredJavaVer,
          selected: selectedJava.majorVersion,
        },
      ),
    );
  }

  // Low RAM
  if (currentRam < 1.0) {
    warnings.push(
      translateWithFallback(t, 'settings.warning_low_ram', 'Less than 1 GB of RAM is allocated. This may cause lag.'),
    );
  }

  return warnings;
}
