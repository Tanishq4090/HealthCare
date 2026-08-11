import { useEffect } from 'react';

interface SEOMetaProps {
  title: string;
  description: string;
  canonical?: string;
  ogImage?: string;
  ogType?: 'website' | 'article';
  jsonLd?: Record<string, any>;
}

/**
 * Enterprise SEO & Metadata component.
 * Dynamically manages document head title, meta tags, OpenGraph, Twitter cards, canonical link, and JSON-LD structured data.
 */
export function SEOMeta({
  title,
  description,
  canonical = 'https://99care.org',
  ogImage = 'https://99care.org/99care-logo.svg',
  ogType = 'website',
  jsonLd
}: SEOMetaProps) {
  useEffect(() => {
    // Title
    document.title = title;

    // Helper function to set or create meta element
    const setMeta = (selector: string, attrName: string, attrVal: string, content: string) => {
      let el = document.querySelector<HTMLMetaElement>(selector);
      if (!el) {
        el = document.createElement('meta');
        el.setAttribute(attrName, attrVal);
        document.head.appendChild(el);
      }
      el.content = content;
    };

    // Standard Meta Tags
    setMeta('meta[name="description"]', 'name', 'description', description);
    setMeta('meta[name="robots"]', 'name', 'robots', 'index, follow');

    // OpenGraph Meta Tags
    setMeta('meta[property="og:title"]', 'property', 'og:title', title);
    setMeta('meta[property="og:description"]', 'property', 'og:description', description);
    setMeta('meta[property="og:type"]', 'property', 'og:type', ogType);
    setMeta('meta[property="og:url"]', 'property', 'og:url', canonical);
    setMeta('meta[property="og:image"]', 'property', 'og:image', ogImage);

    // Twitter Card Meta Tags
    setMeta('meta[name="twitter:card"]', 'name', 'twitter:card', 'summary_large_image');
    setMeta('meta[name="twitter:title"]', 'name', 'twitter:title', title);
    setMeta('meta[name="twitter:description"]', 'name', 'twitter:description', description);
    setMeta('meta[name="twitter:image"]', 'name', 'twitter:image', ogImage);

    // Canonical link
    let link = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!link) {
      link = document.createElement('link');
      link.rel = 'canonical';
      document.head.appendChild(link);
    }
    link.href = canonical;

    // JSON-LD Structured Data
    let script: HTMLScriptElement | null = null;
    if (jsonLd) {
      script = document.createElement('script');
      script.type = 'application/ld+json';
      script.id = 'page-json-ld';
      script.text = JSON.stringify(jsonLd);
      document.head.appendChild(script);
    }

    // Cleanup on page unmount
    return () => {
      document.title = '99 Care — Home Healthcare Services in Surat';
      if (script && document.head.contains(script)) {
        document.head.removeChild(script);
      }
    };
  }, [title, description, canonical, ogImage, ogType, jsonLd]);

  return null;
}
