import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronUp } from 'lucide-react';

export function ScrollToTopButton() {
  const [isHovered, setIsHovered] = useState(false);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 16, scale: 0.9 }}
      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
      className="relative flex items-center justify-end"
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
            className="absolute right-[calc(100%+12px)] whitespace-nowrap bg-slate-900 text-white px-3 py-1.5 rounded-lg text-xs font-semibold shadow-lg border border-slate-700 pointer-events-none"
          >
            Back to top
          </motion.div>
        )}
      </AnimatePresence>

      <button
        onClick={scrollToTop}
        aria-label="Scroll to top"
        className="flex items-center justify-center w-12 h-12 rounded-full bg-white dark:bg-slate-900 text-slate-800 dark:text-white shadow-xl border border-slate-200/80 dark:border-slate-700/80 hover:bg-slate-50 dark:hover:bg-slate-800 hover:scale-110 active:scale-95 transition-all duration-200 group cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand-blue/50"
      >
        <ChevronUp className="w-6 h-6 stroke-[2.5] text-slate-800 dark:text-white group-hover:-translate-y-0.5 transition-transform duration-200" />
      </button>
    </motion.div>
  );
}
