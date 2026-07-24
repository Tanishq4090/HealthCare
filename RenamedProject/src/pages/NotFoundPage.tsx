import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Home } from 'lucide-react';
import { PageTransition } from '@/components/PageTransition';

export default function NotFoundPage() {
  return (
    <PageTransition>
      <div className="min-h-[80vh] flex flex-col items-center justify-center px-6 text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="max-w-md"
        >
          <div className="w-24 h-24 bg-brand-blue-light rounded-full flex items-center justify-center mx-auto mb-8 text-brand-blue">
            <span className="text-4xl font-bold">404</span>
          </div>
          <h1 className="text-4xl font-extrabold text-gray-900 mb-4 tracking-tight">
            Page Not Found
          </h1>
          <p className="text-lg text-gray-500 font-light mb-10 leading-relaxed">
            The page you're looking for doesn't exist or has been moved to another location.
          </p>
          <Button asChild className="rounded-full px-8 h-12 bg-brand-blue hover:bg-brand-blue/90 font-bold transition-all shadow-md">
            <Link to="/" className="flex items-center gap-2">
              <Home className="w-4 h-4" />
              Back to Home
            </Link>
          </Button>
        </motion.div>
      </div>
    </PageTransition>
  );
}
