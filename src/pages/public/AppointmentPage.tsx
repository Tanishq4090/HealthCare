import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { toast } from 'sonner';
import { Phone, Mail, MapPin, MessageCircle, Loader2, Calendar as CalendarIcon, Sparkles, Clock, ShieldCheck } from 'lucide-react';
import { format } from 'date-fns';
import { PageTransition } from '@/components/PageTransition';
import { AnimateOnScroll } from '@/components/AnimateOnScroll';
import { slideLeft, slideRight, fadeUp } from '@/lib/animations';
import { GradientButton } from '@/components/ui/gradient-button';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { CalendarScheduler } from '@/components/ui/calendar-scheduler';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import { SEOMeta } from '@/components/SEOMeta';
import { cn } from '@/lib/utils';
import { APPOINTMENT_SERVICES } from '@/data/services';
import { supabase } from '@/lib/supabase';
import { trackAppointmentBooking } from '@/utils/analytics';

const formSchema = z.object({
  fullName: z.string().min(2, "Name must be at least 2 characters long"),
  phone: z.string().regex(/^\+?[0-9\s-]{10,14}$/, "Please enter a valid phone number"),
  email: z.string().email("Please enter a valid email").optional().or(z.literal('')),
  serviceId: z.string().min(1, "Please select a service"),
  date: z.date({ message: "Please select a preferred date" }),
  timeSlot: z.string().min(1, "Please select a preferred time"),
  location: z.string().min(5, "Please provide a more specific location in Surat"),
  notes: z.string().max(500).optional(),
});

type FormValues = z.infer<typeof formSchema>;

import { BrandEmblem } from '@/components/ui/BrandEmblem';

export default function AppointmentPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [isSchedulerOpen, setIsSchedulerOpen] = useState(false);
  const navigate = useNavigate();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      fullName: '',
      phone: '',
      email: '',
      serviceId: '',
      location: '',
      notes: '',
    },
  });

  async function onSubmit(data: FormValues) {
    try {
      setIsLoading(true);
      
      // 1. Primary persistence: Save to Supabase appointments table (triggers CRM sync)
      const { error: dbError } = await supabase
        .from('appointments')
        .insert([{
          full_name: data.fullName,
          phone: data.phone,
          email: data.email || null,
          service: data.serviceId,
          preferred_date: format(data.date, 'yyyy-MM-dd'),
          preferred_time: data.timeSlot,
          location: data.location,
          notes: data.notes || null,
          status: 'pending'
        }]);

      if (dbError) {
        throw new Error(dbError.message || 'Failed to save appointment in database');
      }

      // 2. Secondary dispatches: Email Lead Notification & WhatsApp Confirmation (non-blocking)
      const backendOrigin = import.meta.env.VITE_BACKEND_ORIGIN as string | undefined;
      const bookingConfirmUrl = backendOrigin
        ? `${backendOrigin}/api/whatsapp/send-booking-confirmation`
        : `/api/whatsapp/send-booking-confirmation`;

      try {
        await Promise.allSettled([
          fetch("https://formsubmit.co/ajax/99careforyou@gmail.com", {
            method: "POST",
            headers: { 
              "Content-Type": "application/json",
              "Accept": "application/json"
            },
            body: JSON.stringify({
              _subject: `99 Care NEW APPOINTMENT BOOKING: ${data.fullName}`,
              "Patient Name": data.fullName,
              "Phone Number": data.phone,
              "Email": data.email || "N/A",
              "Service Requested": data.serviceId,
              "Preferred Date": format(data.date, 'EEEE, MMMM d, yyyy'),
              "Preferred Time": data.timeSlot,
              "Location in Surat": data.location,
              "Notes / Special Requirements": data.notes || "None",
              "Submitted At": new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }),
              "_captcha": "false"
            })
          }),
          fetch(bookingConfirmUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              phone: data.phone,
              name: data.fullName,
              service: data.serviceId,
              date: format(data.date, 'EEEE, MMMM d yyyy'),
              time: data.timeSlot,
              location: data.location,
            }),
          })
        ]);
      } catch (notifyErr) {
        console.warn('Secondary notification dispatch warning:', notifyErr);
      }

      trackAppointmentBooking(data.serviceId, {
        name: data.fullName,
        phone: data.phone,
        location: data.location,
        timeSlot: data.timeSlot,
      });

      navigate('/appointment/confirmed', {
        state: { booking: data },
        replace: true,
      });
    } catch (error) {
      console.error('Appointment submission error:', error);
      toast.error("Something went wrong. Please try again or call us directly.", {
        description: "If the issue persists, please contact +91 9016 116 564.",
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <PageTransition>
      <SEOMeta
        title="Book Home Healthcare Appointment | 99 Care Surat"
        description="Book a professional nurse, caretaker or home healthcare service in Surat. Fill in your details and our team will confirm within 2 hours. Available 24/7."
        canonical="https://99care.org/appointment"
      />
      <div className="w-full bg-slate-50/60 dark:bg-slate-950 min-h-screen pb-32">
        {/* SECTION 1 — HERO HEADER */}
        <section className="relative pt-32 pb-20 px-6 text-center bg-gradient-to-b from-blue-50/60 via-white to-slate-50/60 dark:from-slate-900 dark:via-slate-950 dark:to-slate-950 border-b border-gray-200/60 dark:border-slate-800 overflow-hidden">
          <div className="absolute top-10 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-brand-blue/5 blur-[120px] rounded-full pointer-events-none"></div>

          <div className="max-w-4xl mx-auto relative z-10">
            <AnimateOnScroll variants={{ hidden: { opacity: 0, y: -10 }, visible: { opacity: 1, y: 0, transition: { duration: 0.4 } } }}>
              <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-brand-blue/10 text-brand-blue dark:text-teal-400 text-xs font-bold uppercase tracking-wider mb-4">
                <BrandEmblem className="w-4 h-4" /> Instant Booking Confirmation
              </span>
            </AnimateOnScroll>
            <AnimateOnScroll variants={fadeUp} delay={0.1}>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-gray-900 dark:text-white mb-6 tracking-tight leading-tight">
                Schedule Care at Your Home
              </h1>
            </AnimateOnScroll>
            <AnimateOnScroll variants={fadeUp} delay={0.2}>
              <p className="text-lg sm:text-xl text-gray-600 dark:text-gray-300 font-light max-w-2xl mx-auto leading-relaxed">
                Fill in the details below and our healthcare team in Surat will confirm your booking within 2 hours.
              </p>
            </AnimateOnScroll>
          </div>
        </section>

        {/* SECTION 2 — FORM & SIDEBAR */}
        <section className="pt-16 px-6">
          <div className="container mx-auto max-w-7xl">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-start">
              
              {/* LEFT COLUMN: The Form (8 cols) */}
              <AnimateOnScroll variants={slideLeft} className="lg:col-span-8 bg-white dark:bg-slate-900 p-8 sm:p-12 rounded-3xl border border-gray-200/80 dark:border-slate-800 shadow-sm transition-all duration-300 hover:shadow-md">
                <div className="mb-8 pb-4 border-b border-gray-100 dark:border-slate-800">
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">Patient Details & Preferences</h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Please provide accurate information for quick dispatch of medical staff.</p>
                </div>

                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                    
                    {/* Name & Phone */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <FormField
                        control={form.control}
                        name="fullName"
                        render={({ field }) => (
                          <FormItem className="space-y-2">
                            <FormLabel className="text-sm font-semibold text-gray-900 dark:text-white ml-1">Full Name <span className="text-red-500">*</span></FormLabel>
                            <FormControl>
                              <Input placeholder="Enter patient name" className="h-13 bg-slate-50/80 dark:bg-slate-800/80 border-gray-200/80 dark:border-slate-700 text-gray-900 dark:text-white focus-visible:ring-brand-blue rounded-2xl" {...field} />
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
                            <FormLabel className="text-sm font-semibold text-gray-900 dark:text-white ml-1">Phone Number <span className="text-red-500">*</span></FormLabel>
                            <FormControl>
                              <Input placeholder="+91 90000 00000" className="h-13 bg-slate-50/80 dark:bg-slate-800/80 border-gray-200/80 dark:border-slate-700 text-gray-900 dark:text-white focus-visible:ring-brand-blue rounded-2xl" {...field} />
                            </FormControl>
                            <FormMessage className="ml-1" />
                          </FormItem>
                        )}
                      />
                    </div>

                    {/* Email & Service */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <FormField
                        control={form.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem className="space-y-2">
                            <FormLabel className="text-sm font-semibold text-gray-900 dark:text-white ml-1">Email Address <span className="text-gray-400 font-normal">(Optional)</span></FormLabel>
                            <FormControl>
                              <Input type="email" placeholder="yourname@example.com" className="h-13 bg-slate-50/80 dark:bg-slate-800/80 border-gray-200/80 dark:border-slate-700 text-gray-900 dark:text-white focus-visible:ring-brand-blue rounded-2xl" {...field} />
                            </FormControl>
                            <FormMessage className="ml-1" />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="serviceId"
                        render={({ field }) => (
                          <FormItem className="space-y-2">
                            <FormLabel className="text-sm font-semibold text-gray-900 dark:text-white ml-1">Service Required <span className="text-red-500">*</span></FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger className="h-13 bg-slate-50/80 dark:bg-slate-800/80 border-gray-200/80 dark:border-slate-700 text-gray-900 dark:text-white focus:ring-brand-blue rounded-2xl">
                                  <SelectValue placeholder="Select a service" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent className="bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-800 rounded-2xl shadow-xl">
                                {APPOINTMENT_SERVICES.map((item) => (
                                  <SelectItem key={item.slug + item.title} value={item.slug} className="text-gray-700 dark:text-gray-300 focus:bg-slate-50 dark:focus:bg-slate-800 rounded-xl my-1">{item.title}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage className="ml-1" />
                          </FormItem>
                        )}
                      />
                    </div>

                    {/* Date & Time Slot (Calendar Scheduler) */}
                    <div className="space-y-2">
                      <FormLabel className="text-sm font-semibold text-gray-900 dark:text-white ml-1 block">Preferred Date & Time <span className="text-red-500">*</span></FormLabel>
                      <Dialog open={isSchedulerOpen} onOpenChange={setIsSchedulerOpen}>
                        <DialogTrigger asChild>
                          <Button
                            type="button"
                            variant="outline"
                            className={cn(
                              "w-full h-14 px-3 sm:px-4 text-left font-normal bg-slate-50/80 dark:bg-slate-800/80 border-gray-200/80 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-between rounded-2xl transition-all shadow-sm gap-2",
                              (!form.watch("date") || !form.watch("timeSlot")) ? "text-muted-foreground" : "text-gray-900 dark:text-white border-brand-blue/40"
                            )}
                          >
                            <div className="flex items-center gap-2.5 overflow-hidden min-w-0">
                              <div className="bg-brand-blue/10 dark:bg-brand-blue/20 p-2 rounded-xl shrink-0">
                                <CalendarIcon className="h-4.5 w-4.5 text-brand-blue" />
                              </div>
                              <span className="text-xs sm:text-base font-medium truncate">
                                {form.watch("date") && form.watch("timeSlot") ? (
                                  `${format(form.watch("date"), "PPP")} at ${form.watch("timeSlot")}`
                                ) : (
                                  "Select Date & Time"
                                )}
                              </span>
                            </div>
                            <div className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-brand-blue bg-brand-blue/10 px-2.5 sm:px-3.5 py-1.5 rounded-full shrink-0">
                              {form.watch("date") && form.watch("timeSlot") ? "Change" : "Pick Slot"}
                            </div>
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="p-0 border-none bg-transparent shadow-none w-fit max-w-[95vw]">
                          <CalendarScheduler
                            defaultDate={form.watch("date")}
                            defaultTime={form.watch("timeSlot") === 'morning' || form.watch("timeSlot") === 'afternoon' || form.watch("timeSlot") === 'evening' ? undefined : form.watch("timeSlot")}
                            onConfirm={({ date, time }) => {
                              if (date) form.setValue('date', date);
                              if (time) form.setValue('timeSlot', time);
                              setIsSchedulerOpen(false);
                              form.trigger(['date', 'timeSlot']);
                            }}
                          />
                        </DialogContent>
                      </Dialog>
                      {(form.formState.errors.date || form.formState.errors.timeSlot) && (
                        <p className="text-sm font-medium text-red-500 mt-2 ml-1">
                          {form.formState.errors.date?.message || form.formState.errors.timeSlot?.message}
                        </p>
                      )}
                    </div>

                    {/* Location & Notes */}
                    <FormField
                      control={form.control}
                      name="location"
                      render={({ field }) => (
                        <FormItem className="space-y-2">
                          <FormLabel className="text-sm font-semibold text-gray-900 dark:text-white ml-1">Your Location in Surat <span className="text-red-500">*</span></FormLabel>
                          <FormControl>
                            <Input placeholder="E.g., Pal, Adajan, Vesu, City Light..." className="h-13 bg-slate-50/80 dark:bg-slate-800/80 border-gray-200/80 dark:border-slate-700 text-gray-900 dark:text-white focus-visible:ring-brand-blue rounded-2xl" {...field} />
                          </FormControl>
                          <FormMessage className="ml-1" />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="notes"
                      render={({ field }) => (
                        <FormItem className="space-y-2">
                          <FormLabel className="text-sm font-semibold text-gray-900 dark:text-white ml-1">Additional Notes <span className="text-gray-400 font-normal">(Optional)</span></FormLabel>
                          <FormControl>
                            <Textarea 
                              placeholder="Any specific requests, medical conditions, or care instructions..." 
                              className="resize-none min-h-[130px] bg-slate-50/80 dark:bg-slate-800/80 border-gray-200/80 dark:border-slate-700 text-gray-900 dark:text-white focus-visible:ring-brand-blue rounded-2xl p-4" 
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage className="ml-1" />
                        </FormItem>
                      )}
                    />

                    {/* Submit CTA */}
                    <div className="pt-4">
                      <GradientButton 
                        type="submit" 
                        disabled={isLoading}
                        className="w-full h-14 rounded-2xl font-bold text-base transition-all disabled:opacity-70 disabled:cursor-not-allowed"
                      >
                        {isLoading ? (
                          <>
                            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                            Confirming Appointment...
                          </>
                        ) : (
                          'Confirm Appointment'
                        )}
                      </GradientButton>
                    </div>
                  </form>
                </Form>
              </AnimateOnScroll>

              {/* RIGHT COLUMN: Sticky Info Sidebar (4 cols) */}
              <AnimateOnScroll variants={slideRight} delay={0.2} className="lg:col-span-4">
                <div className="sticky top-32 space-y-6">
                  <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl border border-gray-200/80 dark:border-slate-800 shadow-sm transition-all duration-300 hover:shadow-md">
                    <span className="text-brand-blue text-xs font-bold uppercase tracking-[0.2em] mb-2 block">Direct Support</span>
                    <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Need Assistance?</h3>
                    
                    <div className="space-y-4">
                      <a href="tel:+919016116564" className="flex items-center gap-4 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-gray-100 dark:border-slate-800 group hover:border-brand-blue/30 transition-colors">
                        <div className="w-10 h-10 rounded-xl bg-brand-blue/10 flex items-center justify-center text-brand-blue flex-shrink-0">
                          <Phone className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="text-xs font-bold text-gray-400 uppercase tracking-wider">Call Directly</div>
                          <div className="text-sm font-bold text-gray-900 dark:text-white group-hover:text-brand-blue transition-colors">+91 9016 116 564</div>
                        </div>
                      </a>

                      <a href="mailto:99careforyou@gmail.com" className="flex items-center gap-4 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-gray-100 dark:border-slate-800 group hover:border-brand-blue/30 transition-colors">
                        <div className="w-10 h-10 rounded-xl bg-brand-blue/10 flex items-center justify-center text-brand-blue flex-shrink-0">
                          <Mail className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="text-xs font-bold text-gray-400 uppercase tracking-wider">Email Us</div>
                          <div className="text-sm font-bold text-gray-900 dark:text-white group-hover:text-brand-blue transition-colors">99careforyou@gmail.com</div>
                        </div>
                      </a>
                      
                      <GradientButton asChild variant="success" className="w-full mt-2 h-13 rounded-2xl shadow-md flex justify-center items-center gap-2">
                        <a href="https://api.whatsapp.com/send/?phone=919016116564&text&type=phone_number&app_absent=0" target="_blank" rel="noopener noreferrer">
                          <MessageCircle className="w-5 h-5 fill-white" /> Chat on WhatsApp
                        </a>
                      </GradientButton>
                    </div>

                    <div className="h-px w-full bg-gray-100 dark:bg-slate-800 my-6"></div>
                    
                    <div className="space-y-4 text-xs text-gray-600 dark:text-gray-300">
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                        <span><strong>24/7 Availability:</strong> Services operational 365 days a year.</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-brand-blue flex-shrink-0" />
                        <span><strong>Verified Caregivers:</strong> Background & medical checks complete.</span>
                      </div>
                    </div>

                  </div>
                </div>
              </AnimateOnScroll>

            </div>
          </div>
        </section>

        {/* SECTION 3 — FAQ */}
        <section className="pt-20 pb-12 px-6">
          <div className="container mx-auto max-w-4xl">
            <div className="bg-white dark:bg-slate-900 p-8 sm:p-12 rounded-3xl border border-gray-200/80 dark:border-slate-800 shadow-sm">
              <AnimateOnScroll variants={fadeUp}>
                <div className="text-center mb-10">
                  <span className="text-brand-blue text-xs font-bold uppercase tracking-[0.2em] mb-2 block">Clear Answers</span>
                  <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">Frequently Asked Questions</h2>
                </div>
              </AnimateOnScroll>
              <AnimateOnScroll variants={fadeUp} delay={0.1}>
                <Accordion type="single" collapsible className="space-y-4">
                  {[
                    { q: "Will I get the same nurse or caretaker each time?", a: "We always try to assign the same verified caretaker to ensure continuity of care. If unavoidable, we inform you in advance and ensure the replacement is fully briefed." },
                    { q: "What areas in Surat do you cover?", a: "We cover all major areas including Pal, Adajan, Vesu, Althan, Udhna, Katargam, Varachha, City Centre, Piplod, and surrounding localities." },
                    { q: "How soon can a caretaker arrive after booking?", a: "For same-day bookings we typically arrange a caretaker within 2–4 hours. Scheduled bookings are confirmed the evening before with a confirmation call." },
                    { q: "What qualifications do your nursing staff have?", a: "All nurses are GNM or ANM certified with minimum 2 years of clinical experience. Caretakers are background-verified and complete our in-house training program." },
                    { q: "Can I cancel or reschedule my appointment?", a: "Yes — call us at +91 9016 116 564 at least 4 hours before. WhatsApp us anytime for quick changes." },
                    { q: "Is there a minimum booking duration?", a: "Our standard minimum is 4 hours. We also offer 12-hour and 24-hour packages for extended or live-in care." },
                  ].map((faq, i) => (
                    <AccordionItem key={i} value={`faq-${i}`} className="border border-gray-200/80 dark:border-slate-800 rounded-2xl overflow-hidden bg-slate-50/60 dark:bg-slate-800/40 px-4">
                      <AccordionTrigger className="py-4 text-left font-semibold text-gray-900 dark:text-white text-base hover:no-underline hover:text-brand-blue data-[state=open]:text-brand-blue transition-colors">
                        {faq.q}
                      </AccordionTrigger>
                      <AccordionContent className="pb-4 text-gray-600 dark:text-gray-300 text-sm leading-relaxed font-light">
                        {faq.a}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </AnimateOnScroll>
            </div>
          </div>
        </section>
      </div>
    </PageTransition>
  );
}
