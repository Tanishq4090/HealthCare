/**
 * Unified Analytics & Conversion Event Tracking Manager for 99 Care
 * Centralizes dispatching of events to GA4, GTM, Microsoft Clarity, and Meta Pixel.
 */

declare global {
  interface Window {
    dataLayer: any[];
    gtag?: (...args: any[]) => void;
    clarity?: (...args: any[]) => void;
    fbq?: (...args: any[]) => void;
    _fbq?: any;
  }
}

export interface AnalyticsConfig {
  gaMeasurementId?: string;
  gtmId?: string;
  clarityId?: string;
  metaPixelId?: string;
  gscVerificationId?: string;
}

// ── Script Inserters ─────────────────────────────────────────────────────────

export function initAnalytics(config?: AnalyticsConfig) {
  const gaId = config?.gaMeasurementId || import.meta.env.VITE_GA_MEASUREMENT_ID || 'G-NH7YJC31JX';
  const gtmId = config?.gtmId || import.meta.env.VITE_GTM_ID;
  const clarityId = config?.clarityId || import.meta.env.VITE_CLARITY_ID;
  const pixelId = config?.metaPixelId || import.meta.env.VITE_META_PIXEL_ID;
  const gscId = config?.gscVerificationId || import.meta.env.VITE_GSC_VERIFICATION_ID;

  if (typeof window === 'undefined') return;

  // 1. Google Search Console Verification Meta Tag
  if (gscId && !document.querySelector('meta[name="google-site-verification"]')) {
    const meta = document.createElement('meta');
    meta.name = 'google-site-verification';
    meta.content = gscId;
    document.head.appendChild(meta);
  }

  // 2. Google Analytics 4 (GA4)
  if (gaId && !document.getElementById('ga4-script')) {
    window.dataLayer = window.dataLayer || [];
    function gtag(...args: any[]) {
      window.dataLayer.push(args);
    }
    window.gtag = gtag;
    gtag('js', new Date());
    gtag('config', gaId, { send_page_view: false }); // Managed manually on route change

    const script = document.createElement('script');
    script.id = 'ga4-script';
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${gaId}`;
    document.head.appendChild(script);
  }

  // 3. Google Tag Manager (GTM)
  if (gtmId && !document.getElementById('gtm-script')) {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ 'gtm.start': new Date().getTime(), event: 'gtm.js' });

    const script = document.createElement('script');
    script.id = 'gtm-script';
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtm.js?id=${gtmId}`;
    document.head.appendChild(script);
  }

  // 4. Microsoft Clarity
  if (clarityId && !document.getElementById('clarity-script')) {
    (function (c: any, l: any, a: any, r: any, i: any, t?: any, y?: any) {
      c[a] = c[a] || function () { (c[a].q = c[a].q || []).push(arguments) };
      t = l.createElement(r); t.async = 1; t.src = "https://www.clarity.ms/tag/" + i;
      t.id = "clarity-script";
      y = l.getElementsByTagName(r)[0]; y.parentNode.insertBefore(t, y);
    })(window, document, "clarity", "script", clarityId);
  }

  // 5. Meta Pixel (Facebook Pixel)
  if (pixelId && !document.getElementById('meta-pixel-script')) {
    (function (f: any, b: any, e: any, v: any, n?: any, t?: any, s?: any) {
      if (f.fbq) return; n = f.fbq = function () {
        n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
      };
      if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = '2.0';
      n.queue = []; t = b.createElement(e); t.async = !0; t.id = 'meta-pixel-script';
      t.src = v; s = b.getElementsByTagName(e)[0];
      s.parentNode.insertBefore(t, s);
    })(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');

    if (window.fbq) {
      window.fbq('init', pixelId);
      window.fbq('track', 'PageView');
    }
  }
}

// ── Event Trackers ───────────────────────────────────────────────────────────

/**
 * Generic Event Dispatcher to all initialized analytics tools.
 */
export function trackEvent(eventName: string, params: Record<string, any> = {}) {
  if (typeof window === 'undefined') return;

  // Dispatch to GA4
  if (typeof window.gtag === 'function') {
    window.gtag('event', eventName, params);
  }

  // Dispatch to GTM
  if (Array.isArray(window.dataLayer)) {
    window.dataLayer.push({
      event: eventName,
      ...params,
    });
  }

  // Dispatch to Microsoft Clarity
  if (typeof window.clarity === 'function') {
    window.clarity('event', eventName);
  }

  // Dispatch to Meta Pixel
  if (typeof window.fbq === 'function') {
    // Map standard events if applicable
    const standardMetaEvents = ['Lead', 'Contact', 'Schedule', 'SubmitApplication', 'ViewContent'];
    if (standardMetaEvents.includes(eventName)) {
      window.fbq('track', eventName, params);
    } else {
      window.fbq('trackCustom', eventName, params);
    }
  }
}

/**
 * Tracks a SPA route pageview.
 */
export function trackPageView(pagePath: string, pageTitle?: string) {
  trackEvent('page_view', {
    page_path: pagePath,
    page_title: pageTitle || document.title,
  });

  if (typeof window !== 'undefined' && typeof window.fbq === 'function') {
    window.fbq('track', 'PageView');
  }
}

/**
 * Conversion Event: Contact Form Submission
 */
export function trackFormSubmission(formName: string, metadata: Record<string, any> = {}) {
  trackEvent('form_submission', {
    form_name: formName,
    ...metadata,
  });
  
  // Track Meta Pixel Lead standard event
  if (typeof window !== 'undefined' && typeof window.fbq === 'function') {
    window.fbq('track', 'Lead', { content_name: formName, ...metadata });
  }
}

/**
 * Conversion Event: Appointment Booking
 */
export function trackAppointmentBooking(serviceName?: string, metadata: Record<string, any> = {}) {
  trackEvent('appointment_booking', {
    service_name: serviceName || 'General',
    ...metadata,
  });

  if (typeof window !== 'undefined' && typeof window.fbq === 'function') {
    window.fbq('track', 'Schedule', { content_name: serviceName, ...metadata });
  }
}

/**
 * Conversion Event: WhatsApp Click
 */
export function trackWhatsAppClick(source: string) {
  trackEvent('whatsapp_click', {
    click_source: source,
  });

  if (typeof window !== 'undefined' && typeof window.fbq === 'function') {
    window.fbq('track', 'Contact', { channel: 'WhatsApp', source });
  }
}

/**
 * Conversion Event: Phone Call Click
 */
export function trackPhoneCall(source: string) {
  trackEvent('phone_call_click', {
    click_source: source,
  });

  if (typeof window !== 'undefined' && typeof window.fbq === 'function') {
    window.fbq('track', 'Contact', { channel: 'Phone', source });
  }
}
