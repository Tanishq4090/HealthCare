import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronUp } from 'lucide-react';
import { LiquidButton } from '@/components/ui/liquid-glass-button';

export function ScrollToTopButton() {
  const [isHovered, setIsHovered] = useState(false);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 16 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className="relative flex items-center justify-end w-full"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <AnimatePresence>
        {isHovered && (
          <motion.div
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            transition={{ duration: 0.2 }}
            className="absolute right-[calc(100%+16px)] whitespace-nowrap bg-white dark:bg-slate-900 text-gray-800 dark:text-gray-200 px-3 py-1.5 rounded-lg text-sm font-medium shadow-md border border-gray-100 dark:border-slate-800"
          >
            Back to top
          </motion.div>
        )}
      </AnimatePresence>

      <LiquidButton
        onClick={scrollToTop}
        className="flex items-center justify-center w-12 h-12 rounded-full !p-0"
        variant="default"
        size="icon"
      >
        <motion.div
          whileHover={{ y: -2 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronUp className="w-6 h-6 text-brand-blue" />
        </motion.div>
      </LiquidButton>
    </motion.div>
  );
}
