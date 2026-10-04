/** The number input and transport must interpret the same complete value. */
export function getHostPortError(value: string): 'validation.port_required' | 'validation.port_invalid' | 'validation.port_range' | null {
  if (!value.trim()) return 'validation.port_required';
  const port = Number(value);
  if (!Number.isInteger(port)) return 'validation.port_invalid';
  return port < 1 || port > 65_535 ? 'validation.port_range' : null;
}
