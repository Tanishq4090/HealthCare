import { useState } from 'react';
import { useScrollReveal } from '@/hooks/useScrollReveal';
import { supabase } from '@/lib/supabase';
import {
  MapPin,
  Phone,
  Mail,
  Clock,
  Send,
  Facebook,
  Twitter,
  Instagram,
  Linkedin
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { OtpModal } from '@/components/ui/otp-modal';

const Contact = () => {
  const { ref: sectionRef, isVisible } = useScrollReveal<HTMLElement>({ threshold: 0.1 });
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    subject: '',
    message: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!formData.phone || formData.phone.length < 5) {
      setErrorMessage('Please enter a valid WhatsApp number.');
      return;
    }

    setShowOtpModal(true);
  };

  const submitToDatabase = async () => {
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const { error } = await supabase
        .from('contact_messages')
        .insert([
          {
            name: formData.name,
            email: formData.email,
            subject: formData.subject,
            message: formData.message,
          }
        ]);

      if (error) throw error;

      // Derive value logically by scanning for keywords in inquiry
      const getEstimatedValue = (subj: string, msg: string) => {
        const text = (subj + ' ' + msg).toLowerCase();
        if (text.includes('surgery') || text.includes('operation')) return 15000;
        if (text.includes('emergency') || text.includes('urgent')) return 5000;
        if (text.includes('checkup') || text.includes('test') || text.includes('scan')) return 3000;
        if (text.includes('consult') || text.includes('visit')) return 2000;
        return 1500; // Baseline for general inquiry
      };

      // Also generate a CRM Lead for this user since they are verified
      const { error: leadError } = await supabase
        .from('crm_leads')
        .insert([
          {
            name: formData.name,
            email: formData.email,
            phone: formData.phone,
            source: 'Contact Form',
            status: 'Verified',
            pipeline_stage: 'New Lead',
            estimated_value_monthly: getEstimatedValue(formData.subject, formData.message)
          }
        ]);

      if (leadError) console.error("Error creating accompanying lead:", leadError);

      setIsSubmitted(true);
      setFormData({ name: '', email: '', phone: '', subject: '', message: '' });

      // Reset success message after 5 seconds
      setTimeout(() => setIsSubmitted(false), 5000);
    } catch (error: any) {
      console.error('Error sending message:', error);
      setErrorMessage(error.message || 'Failed to send message. Please try again later.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const contactInfo = [
    {
      icon: MapPin,
      title: 'Visit Us',
      details: ['123 Healthcare Avenue', 'Medical District, NY 10001'],
      color: 'from-rose-500 to-rose-600',
    },
    {
      icon: Phone,
      title: 'Call Us',
      details: ['+1 (555) 123-4567', '+1 (555) 987-6543'],
      color: 'from-blue-500 to-blue-600',
    },
    {
      icon: Mail,
      title: 'Email Us',
      details: ['info@healthfirst.com', 'support@healthfirst.com'],
      color: 'from-emerald-500 to-emerald-600',
    },
    {
      icon: Clock,
      title: 'Working Hours',
      details: ['Mon - Fri: 8AM - 8PM', 'Sat - Sun: 9AM - 5PM'],
      color: 'from-amber-500 to-amber-600',
    },
  ];

  const socialLinks = [
    { icon: Facebook, href: '#', label: 'Facebook' },
    { icon: Twitter, href: '#', label: 'Twitter' },
    { icon: Instagram, href: '#', label: 'Instagram' },
    { icon: Linkedin, href: '#', label: 'LinkedIn' },
  ];

  return (
    <section
      id="contact"
      ref={sectionRef}
      className="relative py-24 lg:py-32 bg-[#f8fafc] overflow-hidden"
    >
      {/* Background Decorations */}
      <div className="absolute inset-0">
        <div className="absolute top-20 left-10 w-72 h-72 bg-[#285fe2]/5 rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-[#03cd69]/5 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className={`text-center mb-16 transition-all duration-1000 ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
          <span className="inline-block px-4 py-2 bg-[#285fe2]/10 text-[#285fe2] text-sm font-semibold rounded-full mb-4">
            Contact Us
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-[#002a5c] font-['Plus_Jakarta_Sans'] mb-4">
            Get In <span className="text-[#285fe2]">Touch</span>
          </h2>
          <p className="text-lg text-[#002a5c]/70 max-w-2xl mx-auto">
            Have questions or need assistance? We're here to help.
            Reach out to us through any of the channels below.
          </p>
        </div>

        {/* Contact Info Cards */}
        <div className={`grid sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-16 transition-all duration-1000 delay-200 ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
          {contactInfo.map((info, index) => (
            <div
              key={index}
              className="glass-card rounded-2xl p-6 text-center card-lift group cursor-pointer"
            >
              <div className={`w-14 h-14 mx-auto rounded-xl bg-gradient-to-br ${info.color} flex items-center justify-center mb-4 shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                <info.icon className="w-7 h-7 text-white" />
              </div>
              <h3 className="text-lg font-bold text-[#002a5c] mb-2">{info.title}</h3>
              {info.details.map((detail, dIndex) => (
                <p key={dIndex} className="text-sm text-[#002a5c]/70">
                  {detail}
                </p>
              ))}
            </div>
          ))}
        </div>

        <div className={`grid lg:grid-cols-2 gap-12 transition-all duration-1000 delay-300 ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
          {/* Contact Form */}
          <div className="glass-card rounded-3xl p-8 shadow-xl">
            <h3 className="text-2xl font-bold text-[#002a5c] mb-6">
              Send Us a Message
            </h3>

            {isSubmitted ? (
              <div className="bg-[#03cd69]/10 rounded-xl p-8 text-center">
                <div className="w-16 h-16 mx-auto bg-[#03cd69] rounded-full flex items-center justify-center mb-4">
                  <Send className="w-8 h-8 text-white" />
                </div>
                <h4 className="text-xl font-bold text-[#002a5c] mb-2">
                  Message Sent!
                </h4>
                <p className="text-[#002a5c]/70">
                  Thank you for reaching out. We'll get back to you soon.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name" className="text-[#002a5c]">
                      Your Name
                    </Label>
                    <Input
                      id="name"
                      placeholder="John Doe"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="form-input-glow border-[#285fe2]/20 focus:border-[#285fe2]"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-[#002a5c]">
                      Email Address
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="john@example.com"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="form-input-glow border-[#285fe2]/20 focus:border-[#285fe2]"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone" className="text-[#002a5c]">
                      WhatsApp Number <span className="text-red-500">*</span>
                    </Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#285fe2]/50" />
                      <Input
                        id="phone"
                        type="tel"
                        placeholder="+1 (555) 000-0000"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        className="form-input-glow pl-10 border-[#285fe2]/20 focus:border-[#285fe2]"
                        required
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="subject" className="text-[#002a5c]">
                    Subject
                  </Label>
                  <Input
                    id="subject"
                    placeholder="How can we help?"
                    value={formData.subject}
                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                    className="form-input-glow border-[#285fe2]/20 focus:border-[#285fe2]"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="message" className="text-[#002a5c]">
                    Message
                  </Label>
                  <Textarea
                    id="message"
                    placeholder="Tell us more about your inquiry..."
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    className="form-input-glow min-h-[150px] border-[#285fe2]/20 focus:border-[#285fe2]"
                    required
                  />
                </div>

                {/* Error Message */}
                {errorMessage && (
                  <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm border border-red-100">
                    {errorMessage}
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-6 text-lg font-semibold rounded-xl bg-gradient-to-r from-[#285fe2] to-[#1e4fc2] hover:shadow-lg hover:shadow-[#285fe2]/30 hover:scale-[1.02] transition-all duration-300 cursor-pointer"
                >
                  {isSubmitting ? (
                    <span className="flex items-center gap-2">
                      <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Sending...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <Send className="w-5 h-5" />
                      Send Message
                    </span>
                  )}
                </Button>
              </form>
            )}
          </div>

          <OtpModal
            isOpen={showOtpModal}
            onClose={() => setShowOtpModal(false)}
            phoneNumber={formData.phone}
            onVerified={submitToDatabase}
          />

          {/* Map & Social */}
          <div className="space-y-8">
            {/* Map Placeholder */}
            <div className="glass-card rounded-3xl p-2 shadow-xl overflow-hidden">
              <div className="relative h-[300px] rounded-2xl overflow-hidden bg-gradient-to-br from-[#285fe2]/10 to-[#03cd69]/10 flex items-center justify-center">
                <div className="text-center">
                  <MapPin className="w-16 h-16 text-[#285fe2] mx-auto mb-4" />
                  <p className="text-lg font-semibold text-[#002a5c]">HealthFirst Medical Center</p>
                  <p className="text-sm text-[#002a5c]/60">123 Healthcare Avenue, NY 10001</p>
                </div>

                {/* Decorative Map Grid */}
                <div
                  className="absolute inset-0 opacity-10"
                  style={{
                    backgroundImage: `
                      linear-gradient(#285fe2 1px, transparent 1px),
                      linear-gradient(90deg, #285fe2 1px, transparent 1px)
                    `,
                    backgroundSize: '40px 40px'
                  }}
                />

                {/* Location Pin Animation */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-full">
                  <div className="relative">
                    <div className="w-4 h-4 bg-[#285fe2] rounded-full animate-ping absolute" />
                    <div className="w-4 h-4 bg-[#285fe2] rounded-full relative" />
                  </div>
                </div>
              </div>
            </div>

            {/* Social Links */}
            <div className="glass-card rounded-3xl p-8 shadow-xl">
              <h3 className="text-xl font-bold text-[#002a5c] mb-4">
                Follow Us
              </h3>
              <p className="text-[#002a5c]/70 mb-6">
                Stay connected with us on social media for health tips, news, and updates.
              </p>
              <div className="flex gap-4">
                {socialLinks.map((social, index) => (
                  <a
                    key={index}
                    href={social.href}
                    aria-label={social.label}
                    className="w-12 h-12 rounded-xl bg-[#285fe2]/10 flex items-center justify-center text-[#285fe2] hover:bg-[#285fe2] hover:text-white transition-all duration-300 hover:scale-110 cursor-pointer"
                  >
                    <social.icon className="w-5 h-5" />
                  </a>
                ))}
              </div>
            </div>

            {/* Emergency Contact */}
            <div className="glass-card rounded-3xl p-8 shadow-xl bg-gradient-to-br from-[#285fe2] to-[#1e4fc2]">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-xl bg-white/20 flex items-center justify-center">
                  <Phone className="w-7 h-7 text-white" />
                </div>
                <div>
                  <p className="text-white/80 text-sm">24/7 Emergency Hotline</p>
                  <p className="text-white text-2xl font-bold">+1 (555) 911-0000</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Contact;
