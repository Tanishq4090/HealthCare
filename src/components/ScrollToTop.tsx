import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

export default function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    // Standard scroll reset for smooth page transitions
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}
