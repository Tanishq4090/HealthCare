import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function PWAInstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      // Stash the event so it can be triggered later.
      setDeferredPrompt(e);
      
      // Check if user has already dismissed the banner
      const dismissed = localStorage.getItem('pwa-dismissed');
      if (!dismissed) {
        setShowBanner(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    // Show the install prompt
    deferredPrompt.prompt();
    
    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      setShowBanner(false);
      setDeferredPrompt(null);
    }
  };

  const handleDismiss = () => {
    setShowBanner(false);
    localStorage.setItem('pwa-dismissed', 'true');
  };

  return (
    <AnimatePresence>
      {showBanner && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="fixed bottom-20 left-4 right-4 md:hidden z-[60]"
        >
          <div className="bg-white dark:bg-slate-900 shadow-2xl rounded-2xl border border-gray-100 dark:border-slate-800 p-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-brand-blue/10 rounded-xl flex items-center justify-center flex-shrink-0">
                <img 
                  src="https://99care.org/wp-content/uploads/2024/01/99care-logo.svg" 
                  alt="99 Care" 
                  className="w-8 h-8"
                />
              </div>
              <div className="text-left">
                <h4 className="text-sm font-bold text-gray-900 dark:text-white">Add 99 Care to home screen</h4>
                <p className="text-xs text-gray-500 dark:text-gray-400">Quick access to book appointments anytime</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Button 
                onClick={handleInstall}
                size="sm"
                className="bg-brand-blue hover:bg-brand-blue/90 text-white rounded-full text-xs px-4 h-8"
              >
                Install
              </Button>
              <button 
                onClick={handleDismiss}
                className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-400 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
