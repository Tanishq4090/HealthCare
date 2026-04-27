import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Send, MessageCircle, Phone, ExternalLink, Globe, ArrowRight } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Message {
  id: number;
  from: 'bot' | 'user';
  text: string;
  time: string;
}

const PHONE_NUMBER = '917971542924';
const WHATSAPP_URL = `https://api.whatsapp.com/send/?phone=${PHONE_NUMBER}&text=Hi%2C%20I%20need%20help%20with%20a%20healthcare%20service&type=phone_number&app_absent=0`;

function getTime(): string {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function WhatsAppWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [view, setView] = useState<'menu' | 'nameForm' | 'chat'>('menu');
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [userName, setUserName] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [hasUnread, setHasUnread] = useState(true);
  
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  
  // Use a stable session ID per page load
  const [sessionId] = useState(() => Math.random().toString(36).substring(2, 15));
  const [isFirstMessage, setIsFirstMessage] = useState(true);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping, view]);

  // Focus input when views change
  useEffect(() => {
    if (isOpen) {
      setHasUnread(false);
      if (view === 'nameForm') setTimeout(() => nameRef.current?.focus(), 300);
      if (view === 'chat') setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isOpen, view]);

  const handleNameSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!userName.trim()) return;
    
    setMessages([
      {
        id: Date.now(),
        from: 'bot',
        text: `Hi ${userName.trim()}! 👋 I'm the 99 Care assistant. How can I help you today?`,
        time: getTime(),
      }
    ]);
    setView('chat');
  };

  const sendMessage = async () => {
    const text = input.trim();
    if (!text) return;

    const userMsg: Message = { id: Date.now(), from: 'user', text, time: getTime() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          name: userName,
          sessionId,
          isFirstMessage
        }),
      });

      if (!response.ok) throw new Error('Network response was not ok');
      const data = await response.json();
      
      const reply: Message = {
        id: Date.now() + 1,
        from: 'bot',
        text: data.reply || "I'm sorry, I couldn't understand that.",
        time: getTime(),
      };
      setMessages(prev => [...prev, reply]);
      if (isFirstMessage) setIsFirstMessage(false);

    } catch (error) {
      console.error("Chat error:", error);
      setMessages(prev => [...prev, {
        id: Date.now() + 1,
        from: 'bot',
        text: "I'm having trouble connecting right now. Please try 'Continue on WhatsApp' below.",
        time: getTime(),
      }]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const resetChat = () => {
    setView('menu');
    setMessages([]);
    setUserName('');
    setIsFirstMessage(true);
  };

  return (
    <div className="relative flex flex-col items-end">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.85, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.85, y: 20 }}
            transition={{ type: 'spring', stiffness: 320, damping: 26 }}
            className="mb-4 w-[320px] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl overflow-hidden border border-gray-100 dark:border-slate-800 z-50 flex flex-col"
            style={{ maxHeight: '480px' }}
          >
            {/* ── Header ── */}
            <div className="bg-[#075E54] px-4 py-3 flex items-center justify-between text-white shrink-0">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                    <MessageCircle className="w-6 h-6 fill-white text-[#075E54]" />
                  </div>
                  <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-400 rounded-full border-2 border-[#075E54]" />
                </div>
                <div>
                  <h4 className="font-bold text-sm leading-tight">99 Care</h4>
                  <p className="text-[10px] text-green-100">Typically replies within minutes</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {view !== 'menu' && (
                  <button onClick={resetChat} className="p-1.5 hover:bg-white/10 rounded-full transition-colors text-xs font-semibold">
                    Back
                  </button>
                )}
                <button onClick={() => setIsOpen(false)} className="p-1.5 hover:bg-white/10 rounded-full transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* ── Menu View ── */}
            {view === 'menu' && (
              <div className="flex-1 p-6 bg-slate-50 flex flex-col justify-center gap-4">
                <div className="text-center mb-2">
                  <h3 className="font-bold text-slate-800 mb-1">Hi there! 👋</h3>
                  <p className="text-sm text-slate-500">How would you like to reach us today?</p>
                </div>
                
                <a 
                  href={WHATSAPP_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 w-full p-4 bg-white border border-[#25D366]/30 hover:border-[#25D366] rounded-xl shadow-sm transition-all group"
                >
                  <div className="w-10 h-10 bg-[#25D366]/10 rounded-full flex items-center justify-center group-hover:bg-[#25D366]/20 transition-colors">
                    <MessageCircle className="w-5 h-5 text-[#25D366]" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-bold text-slate-800 text-sm">Chat on WhatsApp</h4>
                    <p className="text-xs text-slate-500">Open WhatsApp app</p>
                  </div>
                  <ExternalLink className="w-4 h-4 text-slate-400" />
                </a>

                <button 
                  onClick={() => setView('nameForm')}
                  className="flex items-center gap-3 w-full p-4 bg-white border border-brand-teal/30 hover:border-brand-teal rounded-xl shadow-sm transition-all group text-left"
                >
                  <div className="w-10 h-10 bg-brand-teal/10 rounded-full flex items-center justify-center group-hover:bg-brand-teal/20 transition-colors">
                    <Globe className="w-5 h-5 text-brand-teal" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-bold text-slate-800 text-sm">Chat on Website</h4>
                    <p className="text-xs text-slate-500">Stay on this page</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-400" />
                </button>
              </div>
            )}

            {/* ── Name Form View ── */}
            {view === 'nameForm' && (
              <div className="flex-1 p-6 bg-slate-50 flex flex-col justify-center">
                <form onSubmit={handleNameSubmit} className="space-y-4">
                  <div className="text-center mb-6">
                    <h3 className="font-bold text-slate-800 mb-1">Let's get started!</h3>
                    <p className="text-sm text-slate-500">What should we call you?</p>
                  </div>
                  <input
                    ref={nameRef}
                    type="text"
                    required
                    value={userName}
                    onChange={e => setUserName(e.target.value)}
                    placeholder="Your Name"
                    className="w-full text-sm bg-white border border-slate-200 rounded-xl px-4 py-3 outline-none focus:border-brand-teal focus:ring-1 focus:ring-brand-teal/30 transition-all placeholder:text-slate-400"
                  />
                  <button 
                    type="submit"
                    disabled={!userName.trim()}
                    className="w-full py-3 bg-brand-teal text-white rounded-xl font-bold shadow-md hover:bg-teal-600 transition-colors disabled:opacity-50"
                  >
                    Start Chat
                  </button>
                </form>
              </div>
            )}

            {/* ── Chat View ── */}
            {view === 'chat' && (
              <>
                <div
                  className="flex-1 overflow-y-auto p-3 space-y-2"
                  style={{
                    backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23d4d4d4' fill-opacity='0.18'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")",
                    backgroundColor: '#ECE5DD',
                    minHeight: '240px',
                  }}
                >
                  {messages.map(msg => (
                    <div
                      key={msg.id}
                      className={`flex ${msg.from === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[82%] px-3 py-2 rounded-2xl shadow-sm text-sm leading-relaxed relative ${
                          msg.from === 'user'
                            ? 'bg-[#DCF8C6] text-slate-800 rounded-tr-sm'
                            : 'bg-white text-slate-800 rounded-tl-sm'
                        }`}
                      >
                        <p className="whitespace-pre-wrap">{msg.text}</p>
                        <span className="block text-[10px] text-slate-400 text-right mt-0.5 -mb-0.5">
                          {msg.time}
                          {msg.from === 'user' && (
                            <span className="ml-1 text-[#53BDEB]">✓✓</span>
                          )}
                        </span>
                      </div>
                    </div>
                  ))}

                  {isTyping && (
                    <div className="flex justify-start">
                      <div className="bg-white px-4 py-3 rounded-2xl rounded-tl-sm shadow-sm flex items-center gap-1">
                        {[0, 0.2, 0.4].map((delay, i) => (
                          <motion.div
                            key={i}
                            className="w-2 h-2 bg-slate-400 rounded-full"
                            animate={{ y: [0, -4, 0] }}
                            transition={{ duration: 0.6, repeat: Infinity, delay }}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                  <div ref={bottomRef} />
                </div>

                <a
                  href={WHATSAPP_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 py-2 bg-[#f0fdf4] hover:bg-[#dcfce7] border-t border-b border-green-100 text-[11px] font-semibold text-[#128C7E] transition-colors"
                >
                  <ExternalLink className="w-3 h-3" />
                  Continue on WhatsApp
                </a>

                <div className="px-3 py-2.5 bg-white dark:bg-slate-900 shrink-0 flex items-center gap-2">
                  <input
                    ref={inputRef}
                    type="text"
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Type a message…"
                    className="flex-1 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full px-4 py-2 outline-none focus:border-[#25D366] focus:ring-1 focus:ring-[#25D366]/30 transition-all placeholder:text-slate-400"
                    maxLength={300}
                  />
                  <button
                    onClick={sendMessage}
                    disabled={!input.trim()}
                    className="w-9 h-9 rounded-full bg-[#25D366] disabled:opacity-40 flex items-center justify-center text-white shadow hover:bg-[#1ebe5d] active:scale-95 transition-all"
                  >
                    <Send className="w-4 h-4 ml-0.5" />
                  </button>
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── FAB Button ── */}
      <motion.button
        onClick={() => setIsOpen(prev => !prev)}
        className="relative flex items-center justify-center w-14 h-14 bg-[#25D366] rounded-full shadow-lg z-50"
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        transition={{ type: 'spring', stiffness: 400, damping: 15 }}
        aria-label="Open chat"
      >
        {!isOpen && (
          <motion.div
            animate={{ scale: [1, 1.65], opacity: [0.4, 0] }}
            transition={{ duration: 1.5, repeat: Infinity, repeatDelay: 1.5 }}
            className="absolute inset-0 rounded-full bg-[#25D366]"
          />
        )}
        {!isOpen && hasUnread && (
          <motion.div
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full border-2 border-white flex items-center justify-center text-[10px] text-white font-bold z-20 shadow-md"
          >
            1
          </motion.div>
        )}
        <svg viewBox="0 0 24 24" fill="white" className="w-7 h-7 relative z-10">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
          <path d="M12 0C5.373 0 0 5.373 0 12c0 2.124.558 4.118 1.533 5.846L.057 23.882l6.198-1.625A11.933 11.933 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.894a9.886 9.886 0 01-5.031-1.378l-.361-.214-3.741.981 1-3.641-.235-.374A9.861 9.861 0 012.106 12C2.106 6.58 6.58 2.106 12 2.106S21.894 6.58 21.894 12 17.42 21.894 12 21.894z" />
        </svg>
      </motion.button>
    </div>
  );
}
