export type AppMode = 'public' | 'os';

export function getAppMode(): AppMode {
  const raw = (import.meta as any)?.env?.VITE_APP_MODE as string | undefined;
  if (raw === 'os') return 'os';
  if (raw === 'public') return 'public';

  // Fallback: infer from current URL (useful on localhost)
  if (typeof window !== 'undefined') {
    const host = window.location.hostname.toLowerCase();
    const port = window.location.port;
    if (host.startsWith('os.') || port === '5174') return 'os';
  }

  return 'public';
}

export const APP_MODE: AppMode = getAppMode();

