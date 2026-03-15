import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { toast } from 'sonner';
import { Phone, Mail, MapPin, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { PageTransition } from '@/components/PageTransition';
import { AnimateOnScroll } from '@/components/AnimateOnScroll';
import { slideLeft, slideRight, fadeUp } from '@/lib/animations';

import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/lib/supabase';
import { SEOMeta } from '@/components/SEOMeta';
import { GoogleMap } from '@/components/GoogleMap';
import { GradientButton } from '@/components/ui/gradient-button';

const contactSchema = z.object({
  fullName: z.string().min(2, "Name must be at least 2 characters long"),
  email: z.string().email("Please enter a valid email"),
  phone: z.string().min(10, "Please enter a valid phone number"),
  message: z.string().min(10, "Message must be at least 10 characters long").max(1000),
});

type ContactFormValues = z.infer<typeof contactSchema>;

export default function ContactPage() {
  const [isLoading, setIsLoading] = useState(false);
  
  const form = useForm<ContactFormValues>({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      fullName: '',
      email: '',
      phone: '',
      message: '',
    },
  });

  async function onSubmit(data: ContactFormValues) {
    try {
      setIsLoading(true);

      // 1. Save to Supabase Table
      const { error: dbError } = await supabase
        .from('contact_submissions')
        .insert([{
          name: data.fullName,
          email: data.email,
          phone: data.phone,
          message: data.message
        }]);

      if (dbError) throw dbError;

      // 2. Trigger Edge Function (Email via Resend)
      const { error: fnError } = await supabase.functions.invoke('send-contact-email', {
        body: {
          name: data.fullName,
          email: data.email,
          phone: data.phone,
          message: data.message,
        },
      });

      // Note: We might want to allow DB success even if Email fails, 
      // but here we throw if the user wants strict assurance.
      if (fnError) {
        console.warn('Edge function error:', fnError);
        // We still consider it a success if it's saved to DB
      }

      toast.success("Message sent! We'll get back to you soon.", {
        description: "Our team will contact you shortly.",
      });
      form.reset();
    } catch (error) {
      console.error('Contact submission error:', error);
      toast.error("Failed to send message. Please call us directly.", {
        description: "If the issue persists, please contact +91 9016 116 564.",
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <PageTransition>
      <SEOMeta
        title="Contact 99 Care | Home Healthcare in Surat — +91 9016 116 564"
        description="Contact 99 Care Surat for home nursing, caretaker, and healthcare services. Call, WhatsApp, or fill out the form. We respond within 2 hours."
        canonical="https://99care.org/contact"
      />
      <div className="w-full bg-brand-gray dark:bg-slate-950 min-h-screen pb-32">
        {/* SECTION 1 — HERO Minimal */}
        <section className="pt-32 pb-16 px-6 bg-white dark:bg-slate-950 border-b border-gray-100 dark:border-slate-800 text-center">
          <div className="max-w-3xl mx-auto">
            <AnimateOnScroll variants={fadeUp}>
              <h1 className="text-4xl md:text-5xl font-extrabold text-gray-900 dark:text-white mb-6 tracking-tight">
                Get in Touch
              </h1>
            </AnimateOnScroll>
            <AnimateOnScroll variants={fadeUp} delay={0.1}>
              <p className="text-lg text-gray-500 dark:text-gray-400 font-light mx-auto max-w-xl">
                We're always here to help.
              </p>
            </AnimateOnScroll>
          </div>
        </section>

      {/* SECTION 2 — 2-COLUMN LAYOUT */}
      <section className="pt-16 px-6">
        <div className="container mx-auto max-w-6xl">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-start">
            
            {/* LEFT COLUMN: Contact Form (7 cols) */}
            <AnimateOnScroll variants={slideLeft} className="lg:col-span-7 bg-white dark:bg-slate-900 p-8 md:p-12 rounded-[2rem] border border-gray-200 dark:border-slate-800 shadow-sm transition-shadow duration-300 hover:shadow-md">
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  
                  <FormField
                    control={form.control}
                    name="fullName"
                    render={({ field }) => (
                      <FormItem className="space-y-1.5">
                        <FormLabel className="text-sm font-semibold text-gray-900 dark:text-white ml-1">Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter your name" className="h-12 bg-gray-50 dark:bg-slate-800 border-gray-200 dark:border-slate-700 text-gray-900 dark:text-white focus-visible:ring-brand-blue rounded-xl" {...field} />
                        </FormControl>
                        <FormMessage className="ml-1" />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem className="space-y-1.5">
                          <FormLabel className="text-sm font-semibold text-gray-900 dark:text-white ml-1">Email</FormLabel>
                          <FormControl>
                            <Input type="email" placeholder="yourname@example.com" className="h-12 bg-gray-50 dark:bg-slate-800 border-gray-200 dark:border-slate-700 text-gray-900 dark:text-white focus-visible:ring-brand-blue rounded-xl" {...field} />
                          </FormControl>
                          <FormMessage className="ml-1" />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="phone"
                      render={({ field }) => (
                        <FormItem className="space-y-1.5">
                          <FormLabel className="text-sm font-semibold text-gray-900 dark:text-white ml-1">Phone</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter your phone number" className="h-12 bg-gray-50 dark:bg-slate-800 border-gray-200 dark:border-slate-700 text-gray-900 dark:text-white focus-visible:ring-brand-blue rounded-xl" {...field} />
                          </FormControl>
                          <FormMessage className="ml-1" />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="message"
                    render={({ field }) => (
                      <FormItem className="space-y-1.5">
                        <FormLabel className="text-sm font-semibold text-gray-900 dark:text-white ml-1">Message</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="How can we help you?" 
                            className="resize-none min-h-[150px] bg-gray-50 dark:bg-slate-800 border-gray-200 dark:border-slate-700 text-gray-900 dark:text-white focus-visible:ring-brand-blue rounded-2xl" 
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage className="ml-1" />
                      </FormItem>
                    )}
                  />

                  <div className="pt-4">
                    <GradientButton 
                      type="submit" 
                      disabled={isLoading}
                      className="w-full sm:w-auto px-10 h-14 rounded-full font-bold text-base transition-all disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                          Sending...
                        </>
                      ) : (
                        'Send Message'
                      )}
                    </GradientButton>
                  </div>
                </form>
              </Form>
            </AnimateOnScroll>

            {/* RIGHT COLUMN: Contact Info Card (5 cols) */}
            <AnimateOnScroll variants={slideRight} delay={0.2} className="lg:col-span-5">
              <div className="bg-white dark:bg-slate-900 p-8 md:p-10 rounded-[2rem] border border-gray-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow duration-300 sticky top-32 space-y-8">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-8 tracking-tight">99 Care</h2>
                  
                  <div className="flex flex-col gap-6 text-gray-600 dark:text-gray-400">
                    <div className="flex items-start gap-4">
                      <MapPin className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
                      <p className="leading-relaxed">
                        104, Fortune Mall, Nr. Galaxy Circle, Pal gam<br/>
                        Adajan, Surat, Gujarat – 395009
                      </p>
                    </div>

                    <a href="tel:+919016116564" className="flex items-center gap-4 hover:text-brand-blue transition-colors group">
                      <Phone className="w-5 h-5 text-gray-400 group-hover:text-brand-blue transition-colors flex-shrink-0" />
                      <span className="font-medium">+91 9016 116 564</span>
                    </a>

                    <a href="mailto:99careforyou@gmail.com" className="flex items-center gap-4 hover:text-brand-blue transition-colors group">
                      <Mail className="w-5 h-5 text-gray-400 group-hover:text-brand-blue transition-colors flex-shrink-0" />
                      <span className="font-medium">99careforyou@gmail.com</span>
                    </a>
                  </div>

                  <div className="h-px w-full bg-gray-100 dark:bg-slate-800 my-8"></div>
                  
                  {/* Social Links Row */}
                  <div className="flex gap-4 mb-8">
                    {/* Facebook */}
                    <motion.a 
                      whileHover={{ y: -3, scale: 1.1 }} 
                      transition={{ duration: 0.2 }} 
                      href="https://www.facebook.com/people/99-Care/61572902891369/" 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="w-10 h-10 rounded-full border border-gray-200 dark:border-slate-800 flex items-center justify-center transition-all hover:border-[#1877F2]/30 hover:bg-[#1877F2]/5"
                    >
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="#1877F2">
                        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                      </svg>
                    </motion.a>

                    {/* Instagram */}
                    <motion.a 
                      whileHover={{ y: -3, scale: 1.1 }} 
                      transition={{ duration: 0.2 }} 
                      href="https://www.instagram.com/99careservy/" 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="w-10 h-10 rounded-full border border-gray-200 dark:border-slate-800 flex items-center justify-center transition-all hover:border-[#E4405F]/30 hover:bg-[#E4405F]/5"
                    >
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="url(#ig-grad-contact)">
                        <defs>
                          <linearGradient id="ig-grad-contact" x1="0%" y1="100%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor="#FFDC80"/>
                            <stop offset="25%" stopColor="#FCAF45"/>
                            <stop offset="50%" stopColor="#F77737"/>
                            <stop offset="75%" stopColor="#F56040"/>
                            <stop offset="90%" stopColor="#C13584"/>
                            <stop offset="100%" stopColor="#833AB4"/>
                          </linearGradient>
                        </defs>
                        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>
                      </svg>
                    </motion.a>

                    {/* WhatsApp */}
                    <motion.a 
                      whileHover={{ y: -3, scale: 1.1 }} 
                      transition={{ duration: 0.2 }} 
                      href="https://api.whatsapp.com/send/?phone=919016116564&text&type=phone_number&app_absent=0" 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="w-10 h-10 rounded-full border border-gray-200 dark:border-slate-800 flex items-center justify-center transition-all hover:border-[#25D366]/30 hover:bg-[#25D366]/5"
                    >
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="#25D366">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                      </svg>
                    </motion.a>

                    {/* X / Twitter */}
                    <motion.a 
                      whileHover={{ y: -3, scale: 1.1 }} 
                      transition={{ duration: 0.2 }} 
                      href="https://x.com/99CARESERVY" 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="w-10 h-10 rounded-full border border-gray-200 dark:border-slate-800 flex items-center justify-center transition-all hover:border-gray-900/30 hover:bg-gray-900/5 dark:hover:bg-white/5"
                    >
                      <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-gray-800 dark:text-gray-200">
                        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                      </svg>
                    </motion.a>
                  </div>

                  {/* Badge */}
                  <div className="inline-flex items-center justify-center bg-brand-green-light px-4 py-2 rounded-full border border-brand-green/20">
                    <span className="text-brand-green text-xs font-bold uppercase tracking-widest">
                      Open 24 Hours, 7 Days a Week
                    </span>
                  </div>
                </div>

                {/* Map Section */}
                <div className="pt-4">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-8 h-8 rounded-lg bg-brand-blue-light dark:bg-slate-800 flex items-center justify-center text-brand-blue">
                      <MapPin className="w-4 h-4" />
                    </div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">Find Us</h3>
                  </div>
                  
                  <GoogleMap />
                  
                  <GradientButton asChild className="mt-4 w-full flex items-center justify-center gap-2">
                    <a 
                      href="https://maps.google.com/?q=104+Fortune+Mall+Adajan+Surat+Gujarat"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Get Directions
                    </a>
                  </GradientButton>
                </div>

              </div>
            </AnimateOnScroll>

          </div>
        </div>
      </section>
    </div>
    </PageTransition>
  );
}
