import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';
import Footer from './Footer';
import { WhatsAppWidget } from '@/components/WhatsAppWidget';
import { ScrollToTopButton } from '@/components/ScrollToTopButton';
import { PWAInstallBanner } from '@/components/PWAInstallBanner';
import { useScroll, useMotionValueEvent, AnimatePresence } from 'framer-motion';

export default function Layout() {
  const { scrollY } = useScroll();
  const [visible, setVisible] = useState(false);

  useMotionValueEvent(scrollY, 'change', (latest) => {
    setVisible(latest > 400);
  });

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
      
      <PWAInstallBanner />
      
      <div className="fixed bottom-5 right-5 md:bottom-6 md:right-6 z-50 flex flex-col items-center gap-3">
        <AnimatePresence>
          {visible && <ScrollToTopButton />}
        </AnimatePresence>
        <WhatsAppWidget />
      </div>
    </div>
  );
}
