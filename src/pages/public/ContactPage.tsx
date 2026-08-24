import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Phone, Mail, MapPin, Loader2, CheckCircle2, AlertCircle, Sparkles, Clock, ShieldCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
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
import { trackFormSubmission } from '@/utils/analytics';

const contactSchema = z.object({
  fullName: z.string().min(2, "Name must be at least 2 characters long"),
  email: z.string().email("Please enter a valid email"),
  phone: z.string().min(10, "Please enter a valid phone number"),
  message: z.string().min(10, "Message must be at least 10 characters long").max(1000),
});

type ContactFormValues = z.infer<typeof contactSchema>;

import { BrandEmblem } from '@/components/ui/BrandEmblem';

export default function ContactPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

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
      setSubmitStatus('idle');

      let savedToDb = false;

      // 1. Attempt Save to Supabase Table (CRM)
      try {
        const { error: dbError } = await supabase
          .from('contact_submissions')
          .insert([{
            name: data.fullName,
            email: data.email,
            phone: data.phone,
            message: data.message
          }]);

        if (!dbError) {
          savedToDb = true;
        } else {
          console.warn('Supabase DB notice:', dbError);
        }
      } catch (dbErr) {
        console.warn('Supabase DB connection note:', dbErr);
      }

      // 2. Direct Email Notification to 99careforyou@gmail.com via FormSubmit AJAX
      try {
        await fetch("https://formsubmit.co/ajax/99careforyou@gmail.com", {
          method: "POST",
          headers: { 
            "Content-Type": "application/json",
            "Accept": "application/json"
          },
          body: JSON.stringify({
            _subject: `99 Care Website Lead: ${data.fullName}`,
            "Patient Name": data.fullName,
            "Email": data.email,
            "Phone": data.phone,
            "Message / Inquiry": data.message,
            "Submitted At": new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }),
            "_captcha": "false"
          })
        });
      } catch (emailErr) {
        console.warn('Direct Email dispatch note:', emailErr);
      }

      // 3. Trigger Supabase Edge Function if available
      try {
        await supabase.functions.invoke('send-contact-email', {
          body: {
            name: data.fullName,
            email: data.email,
            phone: data.phone,
            message: data.message,
            to: '99careforyou@gmail.com'
          },
        });
      } catch (fnErr) {
        console.warn('Edge function note:', fnErr);
      }

      trackFormSubmission('contact_form', {
        name: data.fullName,
        email: data.email,
        phone: data.phone,
      });

      setSubmitStatus('success');
      form.reset();
    } catch (error) {
      console.error('Contact submission error:', error);
      setErrorMsg("Something went wrong. Please call us directly at +91 9016 116 564.");
      setSubmitStatus('error');
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
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "ContactPage",
          "name": "Contact 99 Care",
          "description": "Contact 99 Care Surat for home nursing, caretaker, and healthcare services. Call +91 9016 116 564.",
          "mainEntity": {
            "@type": ["LocalBusiness", "MedicalBusiness"],
            "name": "99 Care — Home Healthcare Services",
            "telephone": "+919016116564",
            "email": "99careforyou@gmail.com",
            "address": {
              "@type": "PostalAddress",
              "streetAddress": "104, Fortune Mall, Nr. Galaxy Circle, Pal gam",
              "addressLocality": "Adajan, Surat",
              "addressRegion": "Gujarat",
              "postalCode": "395009",
              "addressCountry": "IN"
            }
          }
        }}
      />
      <div className="w-full bg-slate-50/60 dark:bg-slate-950 min-h-screen pb-32">
        {/* SECTION 1 — HERO HEADER */}
        <section className="relative pt-32 pb-20 px-6 text-center bg-gradient-to-b from-blue-50/60 via-white to-slate-50/60 dark:from-slate-900 dark:via-slate-950 dark:to-slate-950 border-b border-gray-200/60 dark:border-slate-800 overflow-hidden">
          <div className="absolute top-10 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-brand-blue/5 blur-[120px] rounded-full pointer-events-none"></div>

          <div className="max-w-4xl mx-auto relative z-10">
            <AnimateOnScroll variants={{ hidden: { opacity: 0, y: -10 }, visible: { opacity: 1, y: 0, transition: { duration: 0.4 } } }}>
              <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-brand-blue/10 text-brand-blue dark:text-teal-400 text-xs font-bold uppercase tracking-wider mb-4">
                <BrandEmblem className="w-4 h-4" /> 24/7 Patient Assistance
              </span>
            </AnimateOnScroll>
            <AnimateOnScroll variants={fadeUp} delay={0.1}>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-gray-900 dark:text-white mb-6 tracking-tight leading-tight">
                Get in Touch with 99 Care
              </h1>
            </AnimateOnScroll>
            <AnimateOnScroll variants={fadeUp} delay={0.2}>
              <p className="text-lg sm:text-xl text-gray-600 dark:text-gray-300 font-light max-w-2xl mx-auto leading-relaxed">
                Have questions about our home nursing or caretaker services in Surat? We're available around the clock to support you.
              </p>
            </AnimateOnScroll>
          </div>
        </section>

        {/* SECTION 2 — 2-COLUMN LAYOUT */}
        <section className="pt-16 px-6">
          <div className="container mx-auto max-w-7xl">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-start">

              {/* LEFT COLUMN: Contact Form (7 cols) */}
              <AnimateOnScroll variants={slideLeft} className="lg:col-span-7 bg-white dark:bg-slate-900 p-8 sm:p-12 rounded-3xl border border-gray-200/80 dark:border-slate-800 shadow-sm transition-all duration-300 hover:shadow-md">

                <AnimatePresence mode="wait">
                  {submitStatus === 'success' ? (
                    <motion.div
                      key="success"
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.4 }}
                      className="flex flex-col items-center justify-center text-center py-16 gap-6"
                    >
                      <div className="w-20 h-20 rounded-full bg-emerald-50 dark:bg-emerald-950/30 border-2 border-emerald-200 dark:border-emerald-800 flex items-center justify-center">
                        <CheckCircle2 className="w-10 h-10 text-emerald-500" />
                      </div>
                      <div>
                        <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Message Received!</h3>
                        <p className="text-gray-600 dark:text-gray-400 max-w-sm mx-auto">
                          Thank you for contacting 99 Care. Our medical care team will get back to you within 2 hours.
                        </p>
                      </div>
                      <button
                        onClick={() => setSubmitStatus('idle')}
                        className="text-sm font-semibold text-brand-blue hover:underline mt-2"
                      >
                        Send another message
                      </button>
                    </motion.div>
                  ) : (
                    <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                      <AnimatePresence>
                        {submitStatus === 'error' && (
                          <motion.div
                            key="error-banner"
                            initial={{ opacity: 0, y: -8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                            className="mb-6 flex items-start gap-3 bg-red-50 border border-red-100 rounded-2xl px-4 py-3"
                          >
                            <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                            <p className="text-sm text-red-700 font-medium">{errorMsg}</p>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      <div className="mb-8 pb-4 border-b border-gray-100 dark:border-slate-800">
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">Send Us a Message</h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Fill out the form below and we'll reply promptly.</p>
                      </div>

                      <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">

                          <FormField
                            control={form.control}
                            name="fullName"
                            render={({ field }) => (
                              <FormItem className="space-y-2">
                                <FormLabel className="text-sm font-semibold text-gray-900 dark:text-white ml-1">Full Name</FormLabel>
                                <FormControl>
                                  <Input placeholder="Enter your full name" className="h-13 bg-slate-50/80 dark:bg-slate-800/80 border-gray-200/80 dark:border-slate-700 text-gray-900 dark:text-white focus-visible:ring-brand-blue rounded-2xl" {...field} />
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
                                <FormItem className="space-y-2">
                                  <FormLabel className="text-sm font-semibold text-gray-900 dark:text-white ml-1">Email Address</FormLabel>
                                  <FormControl>
                                    <Input type="email" placeholder="yourname@example.com" className="h-13 bg-slate-50/80 dark:bg-slate-800/80 border-gray-200/80 dark:border-slate-700 text-gray-900 dark:text-white focus-visible:ring-brand-blue rounded-2xl" {...field} />
                                  </FormControl>
                                  <FormMessage className="ml-1" />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name="phone"
                              render={({ field }) => (
                                <FormItem className="space-y-2">
                                  <FormLabel className="text-sm font-semibold text-gray-900 dark:text-white ml-1">Phone Number</FormLabel>
                                  <FormControl>
                                    <Input placeholder="+91 90000 00000" className="h-13 bg-slate-50/80 dark:bg-slate-800/80 border-gray-200/80 dark:border-slate-700 text-gray-900 dark:text-white focus-visible:ring-brand-blue rounded-2xl" {...field} />
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
                              <FormItem className="space-y-2">
                                <FormLabel className="text-sm font-semibold text-gray-900 dark:text-white ml-1">Your Inquiry / Message</FormLabel>
                                <FormControl>
                                  <Textarea
                                    placeholder="Tell us about your healthcare requirements..."
                                    className="resize-none min-h-[160px] bg-slate-50/80 dark:bg-slate-800/80 border-gray-200/80 dark:border-slate-700 text-gray-900 dark:text-white focus-visible:ring-brand-blue rounded-2xl p-4"
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
                              className="w-full sm:w-auto px-10 h-14 rounded-2xl font-bold text-base transition-all disabled:opacity-70 disabled:cursor-not-allowed"
                            >
                              {isLoading ? (
                                <>
                                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                  Sending Message...
                                </>
                              ) : (
                                'Submit Message'
                              )}
                            </GradientButton>
                          </div>

                        </form>
                      </Form>
                    </motion.div>
                  )}
                </AnimatePresence>

              </AnimateOnScroll>

              {/* RIGHT COLUMN: Contact Info Card (5 cols) */}
              <AnimateOnScroll variants={slideRight} delay={0.2} className="lg:col-span-5">
                <div className="bg-white dark:bg-slate-900 p-8 sm:p-10 rounded-3xl border border-gray-200/80 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow duration-300 sticky top-32 space-y-8">
                  <div>
                    <span className="text-brand-blue text-xs font-bold uppercase tracking-[0.2em] mb-2 block">Direct Contact</span>
                    <h2 className="text-2xl font-extrabold text-gray-900 dark:text-white mb-6 tracking-tight">99 Care Healthcare</h2>

                    <div className="flex flex-col gap-5 text-gray-600 dark:text-gray-300">
                      <div className="flex items-start gap-4 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-gray-100 dark:border-slate-800">
                        <MapPin className="w-5 h-5 text-brand-blue mt-0.5 flex-shrink-0" />
                        <p className="text-sm leading-relaxed">
                          <strong className="text-gray-900 dark:text-white block mb-0.5">Surat Office Address:</strong>
                          104, Fortune Mall, Nr. Galaxy Circle, Pal Gam,<br/>
                          Adajan, Surat, Gujarat – 395009
                        </p>
                      </div>

                      <a href="tel:+919016116564" className="flex items-center gap-4 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-gray-100 dark:border-slate-800 hover:border-brand-blue/30 transition-colors group">
                        <Phone className="w-5 h-5 text-brand-blue flex-shrink-0" />
                        <div>
                          <span className="text-xs font-bold text-gray-400 block uppercase tracking-wider">Helpline & Booking</span>
                          <span className="font-bold text-gray-900 dark:text-white group-hover:text-brand-blue transition-colors">+91 9016 116 564</span>
                        </div>
                      </a>

                      <a href="mailto:99careforyou@gmail.com" className="flex items-center gap-4 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-gray-100 dark:border-slate-800 hover:border-brand-blue/30 transition-colors group">
                        <Mail className="w-5 h-5 text-brand-blue flex-shrink-0" />
                        <div>
                          <span className="text-xs font-bold text-gray-400 block uppercase tracking-wider">Email Inquiry</span>
                          <span className="font-bold text-gray-900 dark:text-white group-hover:text-brand-blue transition-colors">99careforyou@gmail.com</span>
                        </div>
                      </a>
                    </div>

                    <div className="h-px w-full bg-gray-100 dark:bg-slate-800 my-6"></div>

                    {/* Social Links Row */}
                    <div className="flex gap-4 mb-6">
                      <motion.a
                        whileHover={{ y: -3, scale: 1.1 }}
                        transition={{ duration: 0.2 }}
                        href="https://www.facebook.com/people/99-Care/61572902891369/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-11 h-11 rounded-2xl border border-gray-200/80 dark:border-slate-800 flex items-center justify-center transition-all hover:border-[#1877F2]/30 hover:bg-[#1877F2]/5"
                      >
                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="#1877F2">
                          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                        </svg>
                      </motion.a>

                      <motion.a
                        whileHover={{ y: -3, scale: 1.1 }}
                        transition={{ duration: 0.2 }}
                        href="https://www.instagram.com/99careservy/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-11 h-11 rounded-2xl border border-gray-200/80 dark:border-slate-800 flex items-center justify-center transition-all hover:border-[#E4405F]/30 hover:bg-[#E4405F]/5"
                      >
                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="url(#ig-grad-contact)">
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

                      <motion.a
                        whileHover={{ y: -3, scale: 1.1 }}
                        transition={{ duration: 0.2 }}
                        href="https://api.whatsapp.com/send/?phone=919016116564&text&type=phone_number&app_absent=0"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-11 h-11 rounded-2xl border border-gray-200/80 dark:border-slate-800 flex items-center justify-center transition-all hover:border-[#25D366]/30 hover:bg-[#25D366]/5"
                      >
                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="#25D366">
                          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                        </svg>
                      </motion.a>
                    </div>

                    {/* Open Hours Badge */}
                    <div className="w-full text-center bg-emerald-50 dark:bg-emerald-950/40 px-4 py-2.5 rounded-2xl border border-emerald-200/60 dark:border-emerald-800/60">
                      <span className="text-emerald-700 dark:text-emerald-400 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2">
                        <Clock className="w-4 h-4" /> Open 24 Hours, 7 Days a Week
                      </span>
                    </div>
                  </div>

                  {/* Map Section */}
                  <div className="pt-2">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-8 h-8 rounded-xl bg-brand-blue/10 flex items-center justify-center text-brand-blue">
                        <MapPin className="w-4 h-4" />
                      </div>
                      <h3 className="text-base font-bold text-gray-900 dark:text-white">Location Map</h3>
                    </div>

                    <GoogleMap />

                    <GradientButton asChild className="mt-4 w-full flex items-center justify-center gap-2 rounded-2xl py-3.5">
                      <a
                        href="https://maps.google.com/?q=104+Fortune+Mall+Adajan+Surat+Gujarat"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Get Directions on Google Maps
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
