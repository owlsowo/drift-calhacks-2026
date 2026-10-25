// Only explicitly configured hostnames may receive an identity-bound shore pass.
// A comma-separated list keeps the original URL usable alongside an owned domain.
export function matchesShoreHostname(configured: string | undefined, actual: unknown): boolean {
  if (!configured || typeof actual !== 'string') return false;
  const hosts = configured.split(',').map((host) => host.trim());
  const validHostname = (host: string) =>
    host.length > 0 &&
    host.length <= 253 &&
    host.split('.').every((label) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label));
  return hosts.every(validHostname) && hosts.includes(actual);
}
