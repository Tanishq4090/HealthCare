import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { toast } from 'sonner';
import { Phone, Mail, MapPin, MessageCircle, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { Calendar as CalendarIcon } from 'lucide-react';
import { PageTransition } from '@/components/PageTransition';
import { AnimateOnScroll } from '@/components/AnimateOnScroll';
import { slideLeft, slideRight, fadeUp } from '@/lib/animations';

import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { cn } from '@/lib/utils';
import { services } from '@/data/services';
import { supabase } from '@/lib/supabase';

const formSchema = z.object({
  fullName: z.string().min(2, "Name must be at least 2 characters long"),
  phone: z.string().regex(/^\+?[0-9\s-]{10,14}$/, "Please enter a valid phone number"),
  email: z.string().email("Please enter a valid email").optional().or(z.literal('')),
  serviceId: z.string().min(1, "Please select a service"),
  date: z.date({ message: "Please select a preferred date" }),
  timeSlot: z.enum(['morning', 'afternoon', 'evening']),
  location: z.string().min(5, "Please provide a more specific location in Surat"),
  notes: z.string().max(500).optional(),
});

type FormValues = z.infer<typeof formSchema>;

export default function AppointmentPage() {
  const [isLoading, setIsLoading] = useState(false);
  
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
          preferred_time: data.timeSlot.charAt(0).toUpperCase() + data.timeSlot.slice(1),
          location: data.location,
          notes: data.notes || null,
          status: 'pending'
        }]);

      if (error) throw error;

      toast.success("Appointment confirmed! We'll call you shortly. 📞", {
        description: "Our team has received your request and will be in touch within 2 hours.",
      });
      form.reset();
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
                            <Input placeholder="John Doe" className="h-12 bg-gray-50 dark:bg-slate-800 border-gray-200 dark:border-slate-700 text-gray-900 dark:text-white focus-visible:ring-brand-blue" {...field} />
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
                            <Input placeholder="+91 9016 116 564" className="h-12 bg-gray-50 dark:bg-slate-800 border-gray-200 dark:border-slate-700 text-gray-900 dark:text-white focus-visible:ring-brand-blue" {...field} />
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
                            <Input type="email" placeholder="john@example.com" className="h-12 bg-gray-50 dark:bg-slate-800 border-gray-200 dark:border-slate-700 text-gray-900 dark:text-white focus-visible:ring-brand-blue" {...field} />
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

                  {/* Date & Time Slot */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <FormField
                      control={form.control}
                      name="date"
                      render={({ field }) => (
                        <FormItem className="flex flex-col">
                          <FormLabel className="text-gray-900 dark:text-white font-semibold mb-2">Preferred Date <span className="text-red-500">*</span></FormLabel>
                          <Popover>
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button
                                  variant={"outline"}
                                  className={cn(
                                    "w-full h-12 pl-3 text-left font-normal bg-gray-50 dark:bg-slate-800 border-gray-200 dark:border-slate-700 text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-slate-800",
                                    !field.value && "text-muted-foreground"
                                  )}
                                >
                                  {field.value ? (
                                    format(field.value, "PPP")
                                  ) : (
                                    <span>Pick a date</span>
                                  )}
                                  <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                </Button>
                              </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <Calendar
                                mode="single"
                                selected={field.value}
                                onSelect={field.onChange}
                                disabled={(date) =>
                                  date < new Date(new Date().setHours(0, 0, 0, 0))
                                }
                                initialFocus
                              />
                            </PopoverContent>
                          </Popover>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="timeSlot"
                      render={({ field }) => (
                        <FormItem className="flex flex-col">
                          <FormLabel className="text-gray-900 dark:text-white font-semibold mb-2">Preferred Time <span className="text-red-500">*</span></FormLabel>
                          <FormControl>
                            <ToggleGroup 
                              type="single" 
                              onValueChange={field.onChange} 
                              defaultValue={field.value}
                              className="justify-start gap-2"
                            >
                              <ToggleGroupItem value="morning" aria-label="Toggle Morning" className="flex-1 h-12 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-gray-300 data-[state=on]:bg-brand-blue data-[state=on]:text-white data-[state=on]:border-brand-blue">
                                Morning
                              </ToggleGroupItem>
                              <ToggleGroupItem value="afternoon" aria-label="Toggle Afternoon" className="flex-1 h-12 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-gray-300 data-[state=on]:bg-brand-blue data-[state=on]:text-white data-[state=on]:border-brand-blue">
                                Afternoon
                              </ToggleGroupItem>
                              <ToggleGroupItem value="evening" aria-label="Toggle Evening" className="flex-1 h-12 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-gray-300 data-[state=on]:bg-brand-blue data-[state=on]:text-white data-[state=on]:border-brand-blue">
                                Evening
                              </ToggleGroupItem>
                            </ToggleGroup>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
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
                    <Button 
                      type="submit" 
                      disabled={isLoading}
                      className="w-full h-14 rounded-full bg-brand-blue hover:bg-brand-blue/90 text-white font-bold text-lg shadow-md hover:shadow-xl transition-all disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                          Confirming...
                        </>
                      ) : (
                        'Confirm Appointment'
                      )}
                    </Button>
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
                    
                    <a href="https://wa.me/919016116564" target="_blank" rel="noopener noreferrer" className="w-full mt-4 bg-[#25D366] text-white py-3.5 rounded-full text-base font-semibold shadow-md hover:shadow-lg hover:scale-[1.02] transition-all flex justify-center items-center gap-2">
                       <MessageCircle className="w-5 h-5 fill-white" /> WhatsApp Us
                    </a>
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
    </div>
    </PageTransition>
  );
}
