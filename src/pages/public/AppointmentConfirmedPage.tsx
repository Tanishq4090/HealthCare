import { useLocation, Link, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { CheckCircle, Calendar, Clock, HeartPulse, MapPin, Phone, ArrowRight, Home } from 'lucide-react';
import { PageTransition } from '@/components/PageTransition';
import { GradientButton } from '@/components/ui/gradient-button';

interface BookingState {
  fullName: string;
  phone: string;
  serviceId: string;
  date: Date;
  timeSlot: string;
  location: string;
  notes?: string;
}

export default function AppointmentConfirmedPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const booking = location.state?.booking as BookingState | undefined;

  // Redirect if someone lands here directly without booking state
  useEffect(() => {
    if (!booking) {
      navigate('/appointment', { replace: true });
    }
  }, [booking, navigate]);

  if (!booking) return null;

  const steps = [
    { title: 'Booking Received', desc: 'Your request is in our system.', done: true },
    { title: 'Team Review', desc: 'We verify your details & service match.', done: false },
    { title: 'Confirmation Call', desc: 'Our team calls you within 2 hours.', done: false },
    { title: 'Care at Home', desc: 'Your caretaker arrives as scheduled.', done: false },
  ];

  return (
    <PageTransition>
      <div className="min-h-screen bg-brand-gray dark:bg-slate-950 pt-24 pb-32 px-6">
        <div className="container mx-auto max-w-3xl">

          {/* ── Hero: Big Checkmark ── */}
          <div className="text-center mb-14">
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 260, damping: 20, delay: 0.1 }}
              className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-green-50 dark:bg-green-900/30 border-4 border-green-100 dark:border-green-800 mb-6 shadow-lg"
            >
              <CheckCircle className="w-12 h-12 text-green-500" strokeWidth={2} />
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
              className="text-3xl md:text-4xl font-extrabold text-gray-900 dark:text-white mb-3"
            >
              Appointment Booked! 🎉
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 }}
              className="text-gray-500 dark:text-gray-400 text-lg"
            >
              Hi <span className="font-semibold text-gray-800 dark:text-white">{booking.fullName}</span>, your booking is confirmed. We'll call you within 2 hours.
            </motion.p>
          </div>

          {/* ── Booking Summary Card ── */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm overflow-hidden mb-8"
          >
            <div className="bg-brand-blue px-6 py-4 flex items-center gap-3">
              <HeartPulse className="w-5 h-5 text-white/80" />
              <h2 className="text-white font-semibold text-base">Booking Summary</h2>
            </div>
            <div className="p-6 space-y-4">
              <DetailRow icon={<Calendar className="w-4 h-4 text-brand-blue" />} label="Date" value={format(new Date(booking.date), 'EEEE, MMMM d, yyyy')} />
              <DetailRow icon={<Clock className="w-4 h-4 text-brand-blue" />} label="Time" value={booking.timeSlot} />
              <DetailRow icon={<HeartPulse className="w-4 h-4 text-brand-blue" />} label="Service" value={booking.serviceId.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())} />
              <DetailRow icon={<MapPin className="w-4 h-4 text-brand-blue" />} label="Location" value={booking.location} />
              <DetailRow icon={<Phone className="w-4 h-4 text-brand-blue" />} label="Contact" value={booking.phone} />
            </div>
          </motion.div>

          {/* ── What Happens Next ── */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm overflow-hidden mb-10"
          >
            <div className="px-6 py-4 border-b border-gray-100 dark:border-slate-800">
              <h2 className="text-gray-900 dark:text-white font-semibold text-base">What happens next?</h2>
            </div>
            <div className="p-6">
              <div className="space-y-0">
                {steps.map((step, i) => (
                  <div key={i} className="flex gap-4">
                    {/* Step indicator */}
                    <div className="flex flex-col items-center">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold border-2 transition-colors ${step.done ? 'bg-green-500 border-green-500 text-white' : 'border-gray-200 dark:border-slate-700 text-gray-400 dark:text-slate-500 bg-white dark:bg-slate-900'}`}>
                        {step.done ? '✓' : i + 1}
                      </div>
                      {i < steps.length - 1 && <div className="w-px flex-1 bg-gray-100 dark:bg-slate-800 my-1" />}
                    </div>
                    {/* Step content */}
                    <div className={`pb-5 ${i === steps.length - 1 ? '' : ''}`}>
                      <p className={`font-semibold text-sm ${step.done ? 'text-green-600 dark:text-green-400' : 'text-gray-700 dark:text-gray-300'}`}>{step.title}</p>
                      <p className="text-gray-400 dark:text-slate-500 text-xs mt-0.5">{step.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>

          {/* ── CTAs ── */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="flex flex-col sm:flex-row gap-4 justify-center"
          >
            <GradientButton asChild>
              <Link to="/">
                <Home className="w-4 h-4 mr-2" /> Back to Home
              </Link>
            </GradientButton>
            <GradientButton variant="neutral" asChild>
              <Link to="/services">
                View All Services <ArrowRight className="w-4 h-4 ml-2" />
              </Link>
            </GradientButton>
          </motion.div>

        </div>
      </div>
    </PageTransition>
  );
}

function DetailRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 flex-shrink-0 w-7 h-7 rounded-lg bg-brand-blue/10 dark:bg-brand-blue/20 flex items-center justify-center">
        {icon}
      </div>
      <div>
        <p className="text-xs text-gray-400 dark:text-slate-500 uppercase tracking-wide font-medium">{label}</p>
        <p className="text-gray-800 dark:text-white font-semibold text-sm">{value}</p>
      </div>
    </div>
  );
}
