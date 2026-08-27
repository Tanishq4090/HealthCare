export type AppMode = 'public' | 'os';

export function getAppMode(): AppMode {
  // 1. Runtime Hostname & Port detection (Supports multi-domain Vercel deployment)
  if (typeof window !== 'undefined') {
    const host = window.location.hostname.toLowerCase();
    const port = window.location.port;

    // Main website domains -> ALWAYS public website
    if (host === 'www.99care.org' || host === '99care.org') {
      return 'public';
    }

    // Subdomains for CRM / Admin OS
    if (
      host.startsWith('admin.') ||
      host.startsWith('crm.') ||
      host.startsWith('os.') ||
      host.includes('admin') ||
      host.includes('-os')
    ) {
      return 'os';
    }

    // Localhost port routing
    if (port === '5173') return 'os';
    if (port === '5174') return 'public';
  }

  // 2. Explicit environment variable fallback
  const raw = (import.meta.env.VITE_APP_MODE || '').toLowerCase();
  if (raw === 'os') return 'os';
  if (raw === 'public') return 'public';

  return 'public';
}

export const APP_MODE: AppMode = getAppMode();
