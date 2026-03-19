import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { toast } from 'sonner';
import { Phone, Mail, MapPin, MessageCircle, Loader2, Calendar as CalendarIcon } from 'lucide-react';
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
import { services } from '@/data/services';
import { supabase } from '@/lib/supabase';

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
      
      const { error } = await supabase
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

      if (error) throw error;

      // Fire WhatsApp confirmation (non-blocking — don't fail booking if this fails)
      const backendOrigin = import.meta.env.VITE_BACKEND_ORIGIN as string | undefined;
      const bookingConfirmUrl = backendOrigin
        ? `${backendOrigin}/api/whatsapp/send-booking-confirmation`
        : `/api/whatsapp/send-booking-confirmation`;

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
      }).catch(() => { /* silently ignore if backend is down */ });

      // Navigate to confirmation page with booking details
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
      <div className="w-full bg-brand-gray dark:bg-slate-950 min-h-screen pb-32">
        {/* SECTION 1 — HERO Minimal */}
        <section className="pt-32 pb-12 px-6 bg-white dark:bg-slate-950 border-b border-gray-100 dark:border-slate-800 text-center">
          <div className="max-w-3xl mx-auto">
            <AnimateOnScroll variants={{ hidden: { opacity: 0 }, visible: { opacity: 1, transition: { duration: 0.5 } } }}>
              <span className="text-brand-blue text-xs font-bold uppercase tracking-[0.2em] mb-4 block">Book Your Appointment</span>
            </AnimateOnScroll>
            <AnimateOnScroll variants={fadeUp} delay={0.1}>
              <h1 className="text-4xl md:text-5xl font-extrabold text-gray-900 dark:text-white mb-6 tracking-tight">
                Schedule Care at Your Home
              </h1>
            </AnimateOnScroll>
            <AnimateOnScroll variants={fadeUp} delay={0.2}>
              <p className="text-lg text-gray-500 dark:text-gray-400 font-light">
                Fill in the details below and our team will confirm within 2 hours.
              </p>
            </AnimateOnScroll>
          </div>
        </section>

      {/* SECTION 2 — FORM & SIDEBAR */}
      <section className="pt-16 px-6">
        <div className="container mx-auto max-w-7xl">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-start">
            
            {/* LEFT COLUMN: The Form (8 cols) */}
            <AnimateOnScroll variants={slideLeft} className="lg:col-span-8 bg-white dark:bg-slate-900 p-8 md:p-12 rounded-[2rem] border border-gray-200 dark:border-slate-800 shadow-sm transition-shadow duration-300 hover:shadow-md">
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                  
                  {/* Name & Phone */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <FormField
                      control={form.control}
                      name="fullName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-gray-900 dark:text-white font-semibold">Full Name <span className="text-red-500">*</span></FormLabel>
                          <FormControl>
                            <Input placeholder="Enter your name" className="h-12 bg-gray-50 dark:bg-slate-800 border-gray-200 dark:border-slate-700 text-gray-900 dark:text-white focus-visible:ring-brand-blue" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-gray-900 dark:text-white font-semibold">Phone Number <span className="text-red-500">*</span></FormLabel>
                          <FormControl>
                            <Input placeholder="Enter your phone number" className="h-12 bg-gray-50 dark:bg-slate-800 border-gray-200 dark:border-slate-700 text-gray-900 dark:text-white focus-visible:ring-brand-blue" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Email & Service */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-gray-900 dark:text-white font-semibold">Email Address <span className="text-gray-400 font-normal">(Optional)</span></FormLabel>
                          <FormControl>
                            <Input type="email" placeholder="yourname@example.com" className="h-12 bg-gray-50 dark:bg-slate-800 border-gray-200 dark:border-slate-700 text-gray-900 dark:text-white focus-visible:ring-brand-blue" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="serviceId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-gray-900 dark:text-white font-semibold">Service Required <span className="text-red-500">*</span></FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger className="h-12 bg-gray-50 dark:bg-slate-800 border-gray-200 dark:border-slate-700 text-gray-900 dark:text-white focus:ring-brand-blue">
                                <SelectValue placeholder="Select a service" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent className="bg-white dark:bg-slate-900 border-gray-100 dark:border-slate-800">
                              {services.map((item) => (
                                <SelectItem key={item.slug} value={item.slug} className="text-gray-700 dark:text-gray-300 focus:bg-gray-50 dark:focus:bg-slate-800">{item.title}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Date & Time Slot (Calendar Scheduler) */}
                  <div className="mt-4">
                    <FormLabel className="text-gray-900 dark:text-white font-semibold mb-3 block">Preferred Date & Time <span className="text-red-500">*</span></FormLabel>
                    <Dialog open={isSchedulerOpen} onOpenChange={setIsSchedulerOpen}>
                      <DialogTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          className={cn(
                            "w-full h-14 pl-4 pr-5 text-left font-normal bg-gray-50 dark:bg-slate-800 border-gray-200 dark:border-slate-700 hover:bg-gray-100 dark:hover:bg-slate-800 flex items-center justify-between rounded-xl transition-all shadow-sm",
                            (!form.watch("date") || !form.watch("timeSlot")) ? "text-muted-foreground" : "text-gray-900 dark:text-white border-brand-blue/30"
                          )}
                        >
                          <div className="flex items-center gap-3">
                            <div className="bg-brand-blue/10 dark:bg-brand-blue/20 p-2 rounded-lg">
                              <CalendarIcon className="h-5 w-5 text-brand-blue" />
                            </div>
                            <span className="text-base font-medium">
                              {form.watch("date") && form.watch("timeSlot") ? (
                                `${format(form.watch("date"), "PPP")} at ${form.watch("timeSlot")}`
                              ) : (
                                "Select a Date and Time"
                              )}
                            </span>
                          </div>
                          <div className="text-xs font-semibold uppercase tracking-wider text-brand-blue bg-brand-blue/10 px-3 py-1.5 rounded-full">
                            {form.watch("date") && form.watch("timeSlot") ? "Change" : "Pick"}
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
                      <FormItem>
                        <FormLabel className="text-gray-900 dark:text-white font-semibold">Your Location in Surat <span className="text-red-500">*</span></FormLabel>
                        <FormControl>
                          <Input placeholder="E.g., Pal, Adajan, Vesu..." className="h-12 bg-gray-50 dark:bg-slate-800 border-gray-200 dark:border-slate-700 text-gray-900 dark:text-white focus-visible:ring-brand-blue" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-gray-900 dark:text-white font-semibold">Additional Notes <span className="text-gray-400 font-normal">(Optional)</span></FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Any specific requests, medical conditions, or instructions..." 
                            className="resize-none min-h-[120px] bg-gray-50 dark:bg-slate-800 border-gray-200 dark:border-slate-700 text-gray-900 dark:text-white focus-visible:ring-brand-blue" 
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Submit CTA */}
                  <div className="pt-6">
                    <GradientButton 
                      type="submit" 
                      disabled={isLoading}
                      className="w-full h-14 rounded-full font-bold text-lg disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                          Confirming...
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
              <div className="sticky top-32">
                <div className="bg-white dark:bg-slate-900 p-8 rounded-[2rem] border border-gray-200 dark:border-slate-800 shadow-sm transition-shadow duration-300 hover:shadow-md">
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-8">Need Help?</h3>
                  
                  <div className="space-y-6">
                    <a href="tel:+919016116564" className="flex items-center gap-4 group">
                      <div className="w-12 h-12 rounded-full bg-brand-blue-light flex items-center justify-center text-brand-blue group-hover:bg-brand-blue group-hover:text-white transition-colors">
                        <Phone className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-gray-900 dark:text-white">Call Us</div>
                        <div className="text-gray-500 font-medium">+91 9016 116 564</div>
                      </div>
                    </a>

                    <a href="mailto:99careforyou@gmail.com" className="flex items-center gap-4 group">
                      <div className="w-12 h-12 rounded-full bg-brand-blue-light flex items-center justify-center text-brand-blue group-hover:bg-brand-blue group-hover:text-white transition-colors">
                        <Mail className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-gray-900 dark:text-white">Email Us</div>
                        <div className="text-gray-500 font-medium">99careforyou@gmail.com</div>
                      </div>
                    </a>
                    
                    <GradientButton asChild variant="success" className="w-full mt-4 h-14 shadow-md hover:shadow-lg transition-all flex justify-center items-center gap-2">
                      <a href="https://wa.me/919016116564" target="_blank" rel="noopener noreferrer">
                         <MessageCircle className="w-5 h-5 fill-white" /> WhatsApp Us
                      </a>
                    </GradientButton>
                  </div>

                  <div className="h-px w-full bg-gray-100 dark:bg-slate-800 my-8"></div>
                  
                    <div className="space-y-6">
                      <div>
                        <h4 className="font-semibold text-gray-900 dark:text-white mb-1">Business Hours</h4>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Monday &ndash; Sunday: 24&times;7 Services</p>
                      </div>

                      <div className="flex items-start gap-4">
                        <div className="mt-1 flex-shrink-0 text-brand-teal">
                          <MapPin className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="font-semibold text-gray-900 dark:text-white mb-1">Head Office</h4>
                          <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
                            104, Fortune Mall, Nr. Galaxy Circle, Pal gam<br/>
                            Adajan, Surat, Gujarat &ndash; 395009
                          </p>
                        </div>
                      </div>
                    </div>

                </div>
              </div>
            </AnimateOnScroll>

          </div>
        </div>
      </section>

       {/* SECTION 3 — FAQ */}
       <section className="pt-16 pb-24 px-6 bg-white dark:bg-slate-900">
         <div className="container mx-auto max-w-3xl">
           <AnimateOnScroll variants={fadeUp}>
             <div className="text-center mb-10">
               <span className="text-brand-blue text-xs font-bold uppercase tracking-[0.2em] mb-3 block">Common Questions</span>
               <h2 className="text-2xl md:text-3xl font-extrabold text-gray-900 dark:text-white">Frequently Asked Questions</h2>
             </div>
           </AnimateOnScroll>
           <AnimateOnScroll variants={fadeUp} delay={0.1}>
             <Accordion type="single" collapsible className="space-y-3">
               {[
                 { q: "Will I get the same nurse or caretaker each time?", a: "We always try to assign the same verified caretaker to ensure continuity of care. If unavoidable, we inform you in advance and ensure the replacement is fully briefed." },
                 { q: "What areas in Surat do you cover?", a: "We cover all major areas including Pal, Adajan, Vesu, Althan, Udhna, Katargam, Varachha, City Centre, Piplod, and surrounding localities." },
                 { q: "How soon can a caretaker arrive after booking?", a: "For same-day bookings we typically arrange a caretaker within 2–4 hours. Scheduled bookings are confirmed the evening before with a confirmation call." },
                 { q: "What qualifications do your nursing staff have?", a: "All nurses are GNM or ANM certified with minimum 2 years of clinical experience. Caretakers are background-verified and complete our in-house training program." },
                 { q: "Can I cancel or reschedule my appointment?", a: "Yes — call us at +91 9016 116 564 at least 4 hours before. WhatsApp us anytime for quick changes." },
                 { q: "Is there a minimum booking duration?", a: "Our standard minimum is 4 hours. We also offer 12-hour and 24-hour packages for extended or live-in care." },
               ].map((faq, i) => (
                 <AccordionItem key={i} value={`faq-${i}`} className="border border-gray-100 dark:border-slate-800 rounded-xl overflow-hidden bg-gray-50/50 dark:bg-slate-800/30 px-2">
                   <AccordionTrigger className="py-4 px-3 text-left font-semibold text-gray-800 dark:text-white text-sm hover:no-underline hover:text-brand-blue data-[state=open]:text-brand-blue transition-colors">
                     {faq.q}
                   </AccordionTrigger>
                   <AccordionContent className="px-3 pb-4 text-gray-500 dark:text-gray-400 text-sm leading-relaxed">
                     {faq.a}
                   </AccordionContent>
                 </AccordionItem>
               ))}
             </Accordion>
           </AnimateOnScroll>
         </div>
       </section>
    </div>
    </PageTransition>
  );
}
