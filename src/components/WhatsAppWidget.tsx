import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Send, MessageCircle } from 'lucide-react';

export function WhatsAppWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState('');

  useEffect(() => {
    const now = new Date();
    setCurrentTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
  }, []);

  const whatsappUrl = "https://api.whatsapp.com/send/?phone=919016116564&text&type=phone_number&app_absent=0";

  return (
    <div className="relative flex flex-col items-end">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 20, originX: 1, originY: 1 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 20 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className="mb-4 w-[300px] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl overflow-hidden border border-gray-100 dark:border-slate-800 z-50"
          >
            {/* Header */}
            <div className="bg-[#075E54] p-4 flex items-center justify-between text-white">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                    <MessageCircle className="w-6 h-6 fill-white text-[#075E54]" />
                  </div>
                  <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-[#075E54]"></div>
                </div>
                <div>
                  <h4 className="font-bold leading-tight">99 Care</h4>
                  <p className="text-[10px] text-green-100">Typically replies within minutes</p>
                </div>
              </div>
              <button 
                onClick={() => setIsOpen(false)}
                className="p-1 hover:bg-white/10 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="bg-[#ECE5DD] p-4 min-h-[120px] relative">
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2, duration: 0.3 }}
                className="bg-white dark:bg-slate-800 p-3 rounded-2xl rounded-tl-none shadow-sm max-w-[85%] relative"
              >
                <p className="text-sm text-gray-800 dark:text-gray-200 leading-relaxed">
                  👋 Hi there! How can we help you today? Book an appointment, ask about our services, or simply say hello!
                </p>
                <span className="block text-[10px] text-gray-400 dark:text-gray-500 text-right mt-1">
                  {currentTime}
                </span>
                {/* Bubble Tail */}
                <div className="absolute top-0 -left-2 w-2 h-2 bg-white dark:bg-slate-800 clip-path-polygon-[100%_0,0_0,100%_100%]"></div>
              </motion.div>
            </div>

            {/* Footer */}
            <a 
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block p-4 bg-white dark:bg-slate-900 hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors group"
            >
              <div className="flex items-center gap-2 bg-gray-50 dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-full px-4 py-2 text-gray-400 dark:text-gray-500 text-sm italic group-hover:border-green-200 dark:group-hover:border-green-900">
                <span>Hi, I'd like to book a service...</span>
                <div className="ml-auto w-8 h-8 rounded-full bg-[#25D366] flex items-center justify-center text-white shadow-sm group-hover:scale-110 transition-transform">
                  <Send className="w-4 h-4 ml-0.5" />
                </div>
              </div>
            </a>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Button (Closed State) */}
      <motion.button
        onClick={() => setIsOpen(!isOpen)}
        className="relative flex items-center justify-center w-14 h-14 bg-[#25D366] rounded-full shadow-lg z-50"
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        transition={{ type: 'spring', stiffness: 400, damping: 15 }}
      >
        {/* Pulse ring (only when closed) */}
        {!isOpen && (
          <motion.div
            animate={{ scale: [1, 1.6], opacity: [0.4, 0] }}
            transition={{ duration: 1.5, repeat: Infinity, repeatDelay: 1.5 }}
            className="absolute inset-0 rounded-full bg-[#25D366]"
          />
        )}

        {/* Notification Badge */}
        {!isOpen && (
          <motion.div
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full border-2 border-white flex items-center justify-center text-[10px] text-white font-bold z-20 shadow-md"
          >
            1
          </motion.div>
        )}

        {/* WhatsApp Icon */}
        <svg viewBox="0 0 24 24" fill="white" className="w-7 h-7 relative z-10">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
          <path d="M12 0C5.373 0 0 5.373 0 12c0 2.124.558 4.118 1.533 5.846L.057 23.882l6.198-1.625A11.933 11.933 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.894a9.886 9.886 0 01-5.031-1.378l-.361-.214-3.741.981 1-3.641-.235-.374A9.861 9.861 0 012.106 12C2.106 6.58 6.58 2.106 12 2.106S21.894 6.58 21.894 12 17.42 21.894 12 21.894z"/>
        </svg>
      </motion.button>
    </div>
  );
}
