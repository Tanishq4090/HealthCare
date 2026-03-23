export type AppMode = 'public' | 'os';

export function getAppMode(): AppMode {
  // 1. Try environment variable first
  const raw = (import.meta as any)?.env?.VITE_APP_MODE as string | undefined;
  if (raw === 'os') return 'os';
  if (raw === 'public') return 'public';

  // 2. Fallback: infer from current URL port (Best for local dev isolation)
  if (typeof window !== 'undefined') {
    const port = window.location.port;
    if (port === '5173') return 'os';
    if (port === '5174') return 'public';

    // 3. Hostname-based (For production subdomains)
    const host = window.location.hostname.toLowerCase();
    if (host.startsWith('os.')) return 'os';
  }

  return 'public';
}

export const APP_MODE: AppMode = getAppMode();

