import { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Bot, User } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { toast } from 'sonner';

interface Message {
  id: string;
  text: string;
  isBot: boolean;
}

export default function Chatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { id: '1', text: 'Hello! I am the HealthFirst AI assistant. To get started, may I have your name?', isBot: true }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  // Lead Capture State
  const [captureStage, setCaptureStage] = useState<'name' | 'phone' | 'otp' | 'inquiry'>('name');
  const [leadData, setLeadData] = useState({ name: '', phone: '' });
  const [generatedOtp, setGeneratedOtp] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const handleSend = async () => {
    if (!inputValue.trim()) return;

    const userMsg: Message = { id: Date.now().toString(), text: inputValue, isBot: false };
    setMessages(prev => [...prev, userMsg]);
    setInputValue('');
    setIsTyping(true);

    try {
      if (captureStage === 'name') {
        setLeadData(prev => ({ ...prev, name: userMsg.text }));
        setTimeout(() => {
          setMessages(prev => [...prev, { id: Date.now().toString(), text: `Nice to meet you, ${userMsg.text}! What's your WhatsApp number so we can securely reach you?`, isBot: true }]);
          setCaptureStage('phone');
          setIsTyping(false);
        }, 1000);
      }
      else if (captureStage === 'phone') {
        const phone = userMsg.text;
        setLeadData(prev => ({ ...prev, phone }));

        const mockOtp = Math.floor(1000 + Math.random() * 9000).toString();
        setGeneratedOtp(mockOtp);

        setTimeout(() => {
          toast.success(`WhatsApp OTP Ready!`, {
            description: `Check your WhatsApp tab to send the verification code ${mockOtp}`,
            duration: 6000,
          });

          window.open(`https://api.whatsapp.com/send?phone=${phone.replace(/\D/g, '')}&text=Your+HealthFirst+verification+code+is:+${mockOtp}`, '_blank');

          setMessages(prev => [...prev, { id: Date.now().toString(), text: `I've opened WhatsApp to send you a 4-digit OTP to your number. Please enter it below to verify.`, isBot: true }]);
          setCaptureStage('otp');
          setIsTyping(false);
        }, 1500);
      }
      else if (captureStage === 'otp') {
        if (userMsg.text.toLowerCase().trim() === 'resend') {
          const mockOtp = Math.floor(1000 + Math.random() * 9000).toString();
          setGeneratedOtp(mockOtp);
          setTimeout(() => {
            toast.success(`New WhatsApp Message Ready!`, {
              description: `Check your WhatsApp tab to send the new verification code ${mockOtp}`,
              duration: 6000,
            });

            window.open(`https://api.whatsapp.com/send?phone=${leadData.phone.replace(/\D/g, '')}&text=Your+new+HealthFirst+verification+code+is:+${mockOtp}`, '_blank');

            setMessages(prev => [...prev, { id: Date.now().toString(), text: `A new 4-digit OTP has been prepared. Please enter it below.`, isBot: true }]);
            setIsTyping(false);
          }, 1000);
          return;
        }

        // Remove all but letters for checks:
        if (userMsg.text.replace(/\D/g, '') === generatedOtp && generatedOtp !== null) {
          // Save Lead to Supabase
          const { error } = await supabase.from('crm_leads').insert([{
            name: leadData.name,
            email: '', // Not collected in this flow
            phone: leadData.phone,
            source: 'Web Chat',
            status: 'Verified',
            pipeline_stage: 'New Lead',
            estimated_value_monthly: Math.floor(Math.random() * (5000 - 1000 + 1) + 1000) // Mock value
          }]);

          if (error) console.error("Error saving lead:", error);

          setTimeout(() => {
            setMessages(prev => [...prev, { id: Date.now().toString(), text: `Thanks! I've verified your WhatsApp and securely saved your details. How can I help you today?`, isBot: true }]);
            setCaptureStage('inquiry');
            setIsTyping(false);
          }, 1000);
        } else {
          setTimeout(() => {
            setMessages(prev => [...prev, { id: Date.now().toString(), text: `That code doesn't match. Please try again, or type 'resend' to get a new one.`, isBot: true }]);
            setIsTyping(false);
          }, 500);
        }
      }
      else {
        // Normal chatbot behavior
        setTimeout(() => {
          let botResponse = "I'm a demo assistant. For real medical advice, please consult one of our expert doctors.";
          const lowerInput = userMsg.text.toLowerCase();

          if (lowerInput.includes('appointment') || lowerInput.includes('book')) {
            botResponse = 'You can book an appointment by clicking the "Book Now" button in the navigation bar or visiting our Appointment section.';
          } else if (lowerInput.includes('hello') || lowerInput.includes('hi')) {
            botResponse = 'Hello again! How can I help you regarding your health or our services?';
          } else if (lowerInput.includes('hour') || lowerInput.includes('time')) {
            botResponse = 'We offer 24/7 Emergency Services. Regular consultation hours vary by doctor. Please check the Doctors section for specifics.';
          } else if (lowerInput.includes('folio') || lowerInput.includes('service') || lowerInput.includes('brochure')) {
            botResponse = 'I can help with that! Our team will email you our latest digital folio shortly.';
          }

          setMessages(prev => [...prev, { id: Date.now().toString(), text: botResponse, isBot: true }]);
          setIsTyping(false);
        }, 1500);
      }
    } catch (err) {
      console.error("Chatbot Error:", err);
      setIsTyping(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSend();
    }
  };

  return (
    <>
      {/* Floating Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`fixed bottom-6 right-6 p-4 rounded-full shadow-lg transition-all z-50 flex items-center justify-center ${isOpen ? 'bg-red-500 hover:bg-red-600 text-white transform scale-90' : 'bg-primary hover:bg-primary/90 text-white hover:scale-110'
          }`}
        aria-label="Toggle Chatbot"
      >
        {isOpen ? <X size={24} /> : <MessageCircle size={24} />}
      </button>

      {/* Chat Window */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 w-[340px] sm:w-96 bg-white rounded-2xl shadow-2xl border border-gray-100 flex flex-col overflow-hidden z-50 animate-in slide-in-from-bottom-5 fade-in duration-300">
          {/* Header */}
          <div className="bg-primary text-primary-foreground p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                <Bot size={24} className="text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-lg leading-tight">HealthFirst AI</h3>
                <p className="text-xs text-blue-100 flex items-center gap-1 mt-0.5">
                  <span className="w-1.5 h-1.5 bg-green-400 rounded-full"></span>
                  Online | Replies instantly
                </p>
              </div>
            </div>
            <button onClick={() => setIsOpen(false)} className="text-blue-100 hover:text-white transition-colors bg-white/10 p-1.5 rounded-full hover:bg-white/20">
              <X size={18} />
            </button>
          </div>

          {/* Messages Area */}
          <div className="flex-1 p-4 overflow-y-auto h-[350px] bg-slate-50 flex flex-col gap-4">
            {messages.map((msg) => (
              <div key={msg.id} className={`flex gap-3 max-w-[85%] ${msg.isBot ? 'self-start' : 'self-end flex-row-reverse'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-auto mb-1 shadow-sm ${msg.isBot ? 'bg-white border border-gray-200 text-primary' : 'bg-primary text-white'}`}>
                  {msg.isBot ? <Bot size={16} /> : <User size={16} />}
                </div>
                <div className={`p-3 text-sm shadow-sm ${msg.isBot ? 'bg-white border border-gray-100 text-gray-700 rounded-2xl rounded-bl-sm' : 'bg-primary text-primary-foreground rounded-2xl rounded-br-sm'}`}>
                  {msg.text}
                </div>
              </div>
            ))}
            {isTyping && (
              <div className="flex gap-3 max-w-[85%] self-start">
                <div className="w-8 h-8 rounded-full bg-white border border-gray-200 text-primary flex items-center justify-center shrink-0 mt-auto mb-1 shadow-sm">
                  <Bot size={16} />
                </div>
                <div className="py-3 px-4 bg-white border border-gray-100 rounded-2xl rounded-bl-sm shadow-sm flex items-center gap-1.5 h-10">
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"></span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-3 bg-white border-t border-gray-100 flex gap-2">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type your message..."
              className="flex-1 bg-slate-50 border border-gray-200 rounded-full px-4 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all text-gray-700"
            />
            <button
              onClick={handleSend}
              disabled={!inputValue.trim() || isTyping}
              className="w-10 h-10 bg-primary hover:bg-primary/90 disabled:bg-slate-200 disabled:text-slate-400 text-primary-foreground rounded-full flex items-center justify-center transition-all shadow-sm"
            >
              <Send size={18} className="translate-x-[1px]" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
