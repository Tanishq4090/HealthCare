export interface DeviceInfo {
    deviceType: 'Desktop' | 'Mobile' | 'Tablet';
    os: string;
    browser: string;
    screen: string;
    ip?: string;
    userAgent: string;
}

let cachedIp: string | null = null;
let ipFetchPromise: Promise<string> | null = null;

/**
 * Asynchronously resolves the client's public IP address with caching and timeout.
 */
export async function getClientIp(): Promise<string> {
    if (cachedIp) return cachedIp;

    if (!ipFetchPromise) {
        ipFetchPromise = (async () => {
            // Check session storage first
            try {
                const storedIp = sessionStorage.getItem('99care_client_ip');
                if (storedIp) {
                    cachedIp = storedIp;
                    return storedIp;
                }
            } catch {
                // Ignore storage issues in private modes
            }

            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 2000);
                const res = await fetch('https://api.ipify.org?format=json', {
                    signal: controller.signal,
                });
                clearTimeout(timeoutId);

                if (res.ok) {
                    const data = await res.json();
                    if (data?.ip) {
                        cachedIp = data.ip;
                        try {
                            sessionStorage.setItem('99care_client_ip', data.ip);
                        } catch {}
                        return data.ip;
                    }
                }
            } catch {
                // Graceful fallback if offline or blocked
            }

            return 'Local / Unknown';
        })();
    }

    return ipFetchPromise;
}

/**
 * Returns detailed hardware and browser profile for audit logging.
 */
export function getDeviceInfo(): DeviceInfo {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') {
        return {
            deviceType: 'Desktop',
            os: 'Unknown',
            browser: 'Server/Node',
            screen: 'N/A',
            userAgent: 'Server-side',
        };
    }

    const ua = navigator.userAgent;

    // 1. Device Type Detection
    let deviceType: 'Desktop' | 'Mobile' | 'Tablet' = 'Desktop';
    const isTablet = /(ipad|tablet|(android(?!.*mobile))|(windows(?!.*phone)(.*touch))|kindle|playbook|silk)/i.test(ua);
    const isMobile = /(iphone|ipod|((?:android)?.*mobile)|blackberry|bb10|windows phone|iemobile|opera mini)/i.test(ua);

    if (isTablet) {
        deviceType = 'Tablet';
    } else if (isMobile) {
        deviceType = 'Mobile';
    }

    // 2. OS Detection
    let os = 'Unknown OS';
    if (/Windows NT 10.0/i.test(ua)) os = 'Windows 10/11';
    else if (/Windows NT 6.3/i.test(ua)) os = 'Windows 8.1';
    else if (/Windows NT 6.1/i.test(ua)) os = 'Windows 7';
    else if (/iPhone/i.test(ua)) os = 'iOS (iPhone)';
    else if (/iPad/i.test(ua)) os = 'iOS (iPad)';
    else if (/Macintosh|Mac OS X/i.test(ua)) os = 'macOS';
    else if (/Android/i.test(ua)) os = 'Android';
    else if (/Linux/i.test(ua)) os = 'Linux';
    else if (/CrOS/i.test(ua)) os = 'ChromeOS';

    // 3. Browser Detection
    let browser = 'Unknown Browser';
    const matchEdge = ua.match(/Edg(?:e|A|iOS)?\/([0-9.]+)/);
    const matchChrome = ua.match(/(?:Chrome|CriOS)\/([0-9.]+)/);
    const matchFirefox = ua.match(/(?:Firefox|FxiOS)\/([0-9.]+)/);
    const matchSafari = ua.match(/Version\/([0-9.]+)(?:.*Safari)/);
    const matchOpera = ua.match(/(?:OPR|Opera)\/([0-9.]+)/);

    if (matchEdge) {
        browser = `Edge ${matchEdge[1].split('.')[0]}`;
    } else if (matchOpera) {
        browser = `Opera ${matchOpera[1].split('.')[0]}`;
    } else if (matchChrome) {
        browser = `Chrome ${matchChrome[1].split('.')[0]}`;
    } else if (matchSafari) {
        browser = `Safari ${matchSafari[1].split('.')[0]}`;
    } else if (matchFirefox) {
        browser = `Firefox ${matchFirefox[1].split('.')[0]}`;
    }

    // 4. Screen Resolution
    const screen = typeof window.screen !== 'undefined'
        ? `${window.screen.width}x${window.screen.height}`
        : 'Unknown';

    return {
        deviceType,
        os,
        browser,
        screen,
        ip: cachedIp || undefined,
        userAgent: ua,
    };
}
