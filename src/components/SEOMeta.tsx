import { useEffect } from 'react';

interface SEOMetaProps {
  title: string;
  description: string;
  canonical?: string;
}

/**
 * Lightweight per-page SEO component.
 * Updates document.title and meta description without needing react-helmet.
 */
export function SEOMeta({ title, description, canonical }: SEOMetaProps) {
  useEffect(() => {
    // Title
    document.title = title;

    // Meta description
    let metaDesc = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (!metaDesc) {
      metaDesc = document.createElement('meta');
      metaDesc.name = 'description';
      document.head.appendChild(metaDesc);
    }
    metaDesc.content = description;

    // OG Title
    let ogTitle = document.querySelector<HTMLMetaElement>('meta[property="og:title"]');
    if (ogTitle) ogTitle.content = title;

    // OG Description
    let ogDesc = document.querySelector<HTMLMetaElement>('meta[property="og:description"]');
    if (ogDesc) ogDesc.content = description;

    // Canonical link
    if (canonical) {
      let link = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
      if (!link) {
        link = document.createElement('link');
        link.rel = 'canonical';
        document.head.appendChild(link);
      }
      link.href = canonical;
    }

    // Cleanup: restore defaults on unmount
    return () => {
      document.title = '99 Care — Home Healthcare Services in Surat';
    };
  }, [title, description, canonical]);

  return null;
}
