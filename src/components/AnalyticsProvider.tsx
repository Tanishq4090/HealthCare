import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { initAnalytics, trackPageView } from '../utils/analytics';

export function AnalyticsProvider({ children }: { children: React.ReactNode }) {
  const location = useLocation();

  // Initialize tracking scripts once on mount
  useEffect(() => {
    initAnalytics();
  }, []);

  // Track page views on route changes
  useEffect(() => {
    trackPageView(location.pathname + location.search);
  }, [location]);

  return <>{children}</>;
}
