import { Link } from 'react-router-dom';
import { ShieldCheck, Clock, UserCheck, HeartHandshake, CheckCircle2, ChevronRight } from 'lucide-react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { useCountUp } from '@/hooks/useCountUp';
import { AnimateOnScroll } from '@/components/AnimateOnScroll';
import { staggerContainer, staggerItem, fadeUp } from '@/lib/animations';
import { PageTransition } from '@/components/PageTransition';
import { GradientButton } from '@/components/ui/gradient-button';
import { services } from '@/data/services';
import { SEOMeta } from '@/components/SEOMeta';

interface StatCardProps {
  value: number;
  suffix: string;
  label: string;
  sublabel: string;
}

function StatCard({ value, suffix, label, sublabel }: StatCardProps) {
  const { count, ref } = useCountUp(value, 1800);
  return (
    <motion.div 
      ref={ref} 
      className="text-center pt-6 md:pt-0"
      whileHover={{ scale: 1.03 }}
      transition={{ duration: 0.2 }}
    >
      <div className="text-4xl md:text-5xl font-extrabold text-brand-blue dark:text-brand-blue mb-2 tracking-tight">
        {count}{suffix}
      </div>
      <div className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-widest mb-1">{label}</div>
      <div className="text-xs text-gray-400 dark:text-gray-500 font-medium">{sublabel}</div>
    </motion.div>
  );
}

export default function HomePage() {
  const { scrollY } = useScroll();
  const heroY = useTransform(scrollY, [0, 500], [0, -60]);
  const heroOpacity = useTransform(scrollY, [0, 300], [1, 0.3]);
  const blob1Y = useTransform(scrollY, [0, 500], [0, -30]);
  const blob2Y = useTransform(scrollY, [0, 500], [0, -50]);

  return (
    <PageTransition>
      <SEOMeta
        title="99 Care — Home Healthcare Services in Surat | 24/7 Nursing & Caretaker"
        description="Professional home healthcare in Surat. Expert nurses, caretakers, wound care, maternity & newborn care — background verified, available 24/7. Call +91 9016 116 564."
        canonical="https://99care.org"
      />
      <div className="w-full bg-white dark:bg-slate-950">
      {/* SECTION 1 — HERO */}
      <section className="relative min-h-[90vh] flex flex-col justify-center items-center text-center px-6 pt-20 pb-32 bg-white dark:bg-slate-950 overflow-hidden">
        {/* Decorative subtle background gradient blob */}
        <motion.div 
          style={{ y: blob1Y }}
          animate={{ scale: [1, 1.05, 1], opacity: [0.4, 0.6, 0.4] }}
          transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute top-20 right-20 w-96 h-96 bg-brand-blue/5 rounded-full blur-3xl -z-10" 
        />
        <motion.div 
          style={{ y: blob2Y }}
          animate={{ scale: [1, 1.05, 1], opacity: [0.3, 0.5, 0.3] }}
          transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
          className="absolute bottom-20 left-10 w-64 h-64 bg-brand-teal/5 rounded-full blur-2xl -z-10" 
        />
        
        <motion.div style={{ y: heroY, opacity: heroOpacity }} className="max-w-4xl mx-auto flex flex-col items-center">
          <motion.span 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1], delay: 0 }}
            className="text-brand-blue dark:text-brand-blue text-xs font-bold uppercase tracking-[0.2em] mb-8 bg-brand-blue-light/50 dark:bg-brand-blue/20 px-4 py-1.5 rounded-full border border-brand-blue/20 dark:border-brand-blue/40"
          >
            Trusted Home Healthcare • Surat, Gujarat
          </motion.span>
          
          <h1 className="text-5xl md:text-7xl font-extrabold text-gray-900 dark:text-white tracking-tight leading-[1.1] mb-6 overflow-hidden">
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
            >
              Healthcare That Comes <br className="hidden md:block" />
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1], delay: 0.2 }}
            >
              <span className="text-brand-blue">To Your Home</span>
            </motion.div>
          </h1>
          
          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1], delay: 0.35 }}
            className="text-lg md:text-xl text-gray-500 dark:text-gray-400 font-light max-w-2xl mb-12"
          >
            Professional, verified caretakers and medical staff available 24/7 — right at your doorstep.
          </motion.p>
          
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1], delay: 0.45 }}
            className="flex flex-col sm:flex-row items-center gap-4 mb-16 w-full sm:w-auto"
          >
            <motion.div
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              transition={{ type: 'spring', stiffness: 400, damping: 20 }}
            >
              <GradientButton asChild size="lg" className="w-full sm:w-auto h-14">
                <Link to="/appointment" className="flex items-center justify-center gap-2">
                  Book Appointment <ChevronRight className="w-4 h-4" />
                </Link>
              </GradientButton>
            </motion.div>
            <motion.div
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              transition={{ type: 'spring', stiffness: 400, damping: 20 }}
            >
              <GradientButton asChild size="lg" variant="neutral" className="w-full sm:w-auto h-14">
                <Link to="/services" className="flex items-center justify-center">
                  View Services
                </Link>
              </GradientButton>
            </motion.div>
          </motion.div>
          
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1], delay: 0.6 }}
            className="flex justify-center items-center flex-wrap gap-x-6 gap-y-3 text-xs text-gray-400 dark:text-gray-500 font-medium"
          >
            <div className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-brand-green" /> Background Verified</div>
            <div className="hidden sm:block w-px h-3 bg-gray-200"></div>
            <div className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-brand-green" /> 24/7 Support</div>
            <div className="hidden sm:block w-px h-3 bg-gray-200"></div>
            <div className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-brand-green" /> 3+ Years Experience</div>
            <div className="hidden sm:block w-px h-3 bg-gray-200 dark:bg-slate-800"></div>
            <div className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-brand-green" /> 53+ Sessions Done</div>
          </motion.div>
        </motion.div>
      </section>

      {/* SECTION 2 — STATS */}
      <section className="py-24 bg-brand-gray dark:bg-slate-900/50 border-y border-gray-100 dark:border-slate-800">
        <AnimateOnScroll variants={staggerContainer} className="container mx-auto px-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-12 text-center md:text-left divide-y md:divide-y-0 divide-gray-200 dark:divide-slate-800">
            <StatCard value={16} suffix="+" label="Happy Patients" sublabel="In Surat area" />
            <div className="md:border-l md:border-gray-200 md:pl-12 border-0">
              <StatCard value={53} suffix="+" label="Sessions Done" sublabel="Successfully completed" />
            </div>
            <div className="lg:border-l lg:border-gray-200 lg:pl-12 border-0">
              <StatCard value={24} suffix="×7" label="Support" sublabel="Always available" />
            </div>
            <div className="md:border-l md:border-gray-200 md:pl-12 border-0">
              <StatCard value={3} suffix="+" label="Years Experience" sublabel="Trusted in Surat" />
            </div>
          </div>
        </AnimateOnScroll>
      </section>

      {/* SECTION 3 — SERVICES */}
      <section className="py-24 md:py-32 bg-white dark:bg-slate-950">
        <div className="container mx-auto px-6 max-w-7xl">
          <div className="text-center md:text-left mb-16 max-w-3xl">
            <AnimateOnScroll variants={{ hidden: { opacity: 0 }, visible: { opacity: 1, transition: { duration: 0.5 } } }}>
              <span className="text-brand-blue text-xs font-bold uppercase tracking-[0.15em] mb-4 block">What We Offer</span>
            </AnimateOnScroll>
            <AnimateOnScroll variants={fadeUp} delay={0.1}>
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4 tracking-tight">Services Designed Around You</h2>
            </AnimateOnScroll>
            <AnimateOnScroll variants={fadeUp} delay={0.2}>
              <p className="text-lg text-gray-500 dark:text-gray-400 font-light">
                Experience the highest quality of healthcare delivered directly to your home with our specialized medical services.
              </p>
            </AnimateOnScroll>
          </div>

          <motion.div 
            variants={staggerContainer} 
            initial="hidden" 
            whileInView="visible" 
            viewport={{ once: true, margin: '-80px' }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6"
          >
            {services.filter(s => s.category === 'nursing').map((service) => (
              <motion.div key={service.slug} variants={staggerItem}>
                <Link to={`/services/${service.slug}`} className="block group cursor-pointer">
                  <motion.div 
                    whileHover={{ y: -8 }}
                    transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                    className="relative cursor-pointer h-[400px] w-full rounded-[2rem] overflow-hidden border border-gray-100 dark:border-slate-800 shadow-sm transition-shadow duration-500 hover:shadow-2xl"
                  >
                    {/* Image Background */}
                    <div className="absolute inset-0 overflow-hidden">
                      <motion.img 
                        src={service.image} 
                        alt={service.title}
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-gray-900/90 via-gray-900/40 to-transparent opacity-60 group-hover:opacity-80 transition-opacity duration-500" />
                    </div>

                    {/* Content Overlay */}
                    <div className="absolute inset-0 p-8 flex flex-col justify-end text-white">
                      <h3 className="text-2xl font-bold mb-2 tracking-tight">
                        {service.title}
                      </h3>
                      <p className="text-white/80 text-sm mb-6 leading-relaxed opacity-0 group-hover:opacity-100 transform translate-y-4 group-hover:translate-y-0 transition-all duration-500">
                        {service.shortDesc}
                      </p>
                      <div className="flex items-center gap-2 text-sm font-semibold text-white group-hover:gap-3 transition-all">
                        Explore <ChevronRight className="w-4 h-4" />
                      </div>
                    </div>
                  </motion.div>
                </Link>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* SECTION 4 — CARETAKER SERVICES */}
      <section className="py-24 md:py-32 bg-brand-blue-light dark:bg-slate-900/30">
        <div className="container mx-auto px-6 max-w-7xl">
          <div className="text-center mb-16">
            <AnimateOnScroll variants={{ hidden: { opacity: 0 }, visible: { opacity: 1, transition: { duration: 0.5 } } }}>
              <span className="text-brand-blue text-xs font-bold uppercase tracking-[0.15em] mb-4 block">Compassionate Support</span>
            </AnimateOnScroll>
            <AnimateOnScroll variants={fadeUp} delay={0.1}>
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4 tracking-tight">Caretaker Services at Home</h2>
            </AnimateOnScroll>
          </div>

          <motion.div 
            variants={staggerContainer} 
            initial="hidden" 
            whileInView="visible" 
            viewport={{ once: true, margin: '-80px' }}
            className="grid grid-cols-1 md:grid-cols-3 gap-8"
          >
            {services.filter(s => s.category === 'caretaker').map((service) => (
              <motion.div key={service.slug} variants={staggerItem}>
                <Link to={`/services/${service.slug}`} className="block group cursor-pointer">
                  <motion.div 
                    whileHover={{ y: -8 }}
                    transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                    className="relative cursor-pointer h-[450px] w-full rounded-[2.5rem] overflow-hidden border border-gray-100 dark:border-slate-800 shadow-sm transition-shadow duration-500 hover:shadow-2xl"
                  >
                    {/* Image Background */}
                    <div className="absolute inset-0 overflow-hidden">
                      <motion.img 
                        src={service.image} 
                        alt={service.title}
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-gray-900/90 via-gray-900/40 to-transparent opacity-60 group-hover:opacity-80 transition-opacity duration-500" />
                    </div>

                    {/* Content Overlay */}
                    <div className="absolute inset-0 p-10 flex flex-col justify-end text-white">
                      <h3 className="text-2xl font-bold mb-3 tracking-tight">
                        {service.title}
                      </h3>
                      <p className="text-white/80 text-sm mb-6 leading-relaxed opacity-0 group-hover:opacity-100 transform translate-y-4 group-hover:translate-y-0 transition-all duration-500">
                        {service.shortDesc}
                      </p>
                      <div className="flex items-center gap-2 text-sm font-semibold text-white group-hover:gap-3 transition-all">
                        View Details <ChevronRight className="w-4 h-4" />
                      </div>
                    </div>
                  </motion.div>
                </Link>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* SECTION 5 — WHY CHOOSE US */}
      <section className="py-24 md:py-32 bg-white dark:bg-slate-950 flex overflow-hidden">
        <div className="container mx-auto px-6 max-w-7xl">
          <div className="text-center md:text-left mb-20 max-w-2xl">
            <AnimateOnScroll variants={fadeUp} delay={0.1}>
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-6 tracking-tight">Why Families Trust<br/>99 Care</h2>
            </AnimateOnScroll>
          </div>

          <motion.div 
            variants={staggerContainer} 
            initial="hidden" 
            whileInView="visible" 
            viewport={{ once: true, margin: '-80px' }}
            className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-16"
          >
            <motion.div variants={staggerItem} className="flex gap-6 group">
              <div className="flex-shrink-0 mt-1">
                <motion.div 
                  whileHover={{ scale: 1.1, backgroundColor: '#EFF6FF' }}
                  transition={{ duration: 0.25 }}
                  className="w-10 h-10 rounded-full bg-brand-blue-light flex items-center justify-center text-brand-blue"
                >
                  <Clock className="w-5 h-5" />
                </motion.div>
              </div>
              <div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">24/7 Availability</h3>
                <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed">Medical emergencies don't wait. We provide round-the-clock nursing staff and caretakers to ensure continuous care without disruption.</p>
              </div>
            </motion.div>

            <motion.div variants={staggerItem} className="flex gap-6 group">
              <div className="flex-shrink-0 mt-1">
                <motion.div 
                  whileHover={{ scale: 1.1, backgroundColor: '#EFF6FF' }}
                  transition={{ duration: 0.25 }}
                  className="w-10 h-10 rounded-full bg-brand-blue-light flex items-center justify-center text-brand-blue"
                >
                  <ShieldCheck className="w-5 h-5" />
                </motion.div>
              </div>
              <div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Satisfaction Guarantee</h3>
                <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed">Your peace of mind is our priority. If you're not fully satisfied with your assigned caretaker, we provide immediate replacements.</p>
              </div>
            </motion.div>

            <motion.div variants={staggerItem} className="flex gap-6 group">
              <div className="flex-shrink-0 mt-1">
                <motion.div 
                  whileHover={{ scale: 1.1, backgroundColor: '#EFF6FF' }}
                  transition={{ duration: 0.25 }}
                  className="w-10 h-10 rounded-full bg-brand-blue-light flex items-center justify-center text-brand-blue"
                >
                  <UserCheck className="w-5 h-5" />
                </motion.div>
              </div>
              <div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Professional Nurses</h3>
                <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed">Our medical staff spans registered nurses to certified ICU attendants, all rigorously vetted for their medical expertise and compassion.</p>
              </div>
            </motion.div>

            <motion.div variants={staggerItem} className="flex gap-6 group">
              <div className="flex-shrink-0 mt-1">
                <motion.div 
                  whileHover={{ scale: 1.1, backgroundColor: '#EFF6FF' }}
                  transition={{ duration: 0.25 }}
                  className="w-10 h-10 rounded-full bg-brand-blue-light flex items-center justify-center text-brand-blue"
                >
                  <HeartHandshake className="w-5 h-5" />
                </motion.div>
              </div>
              <div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Affordable Prices</h3>
                <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed">We believe quality healthcare should be accessible. Our transparent pricing structure ensures premium service without hidden costs.</p>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* SECTION 6 — TESTIMONIALS */}
      <section className="py-24 md:py-32 bg-brand-gray dark:bg-slate-900/50 overflow-hidden">
        <div className="container mx-auto px-6 max-w-5xl">
          <AnimateOnScroll variants={fadeUp} delay={0.1}>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-16 tracking-tight text-center">What Our Patients Say</h2>
          </AnimateOnScroll>
          
          <motion.div 
            variants={staggerContainer} 
            initial="hidden" 
            whileInView="visible" 
            viewport={{ once: true, margin: '-80px' }}
            className="grid grid-cols-1 md:grid-cols-2 gap-12"
          >
            <motion.div variants={staggerItem} className="flex flex-col">
              <span className="text-6xl text-brand-blue opacity-20 font-serif leading-none h-8">&ldquo;</span>
              <p className="text-lg text-gray-700 dark:text-gray-300 font-medium leading-relaxed mb-6 flex-1 mt-4">
                The physiotherapy service from 99 Care has been exceptional. My recovery process was smooth and the staff was extremely punctual and professional every single day.
              </p>
              <div>
                <h4 className="font-bold text-gray-900 dark:text-white">Pranav Katariya</h4>
                <span className="text-sm text-gray-500 dark:text-gray-400">Physiotherapy Client</span>
              </div>
            </motion.div>

            <motion.div variants={staggerItem} className="flex flex-col">
              <span className="text-6xl text-brand-blue opacity-20 font-serif leading-none h-8">&ldquo;</span>
              <p className="text-lg text-gray-700 dark:text-gray-300 font-medium leading-relaxed mb-6 flex-1 mt-4">
                Finding reliable care for my disabled family member was stressful until we found 99 Care. The caretaker is compassionate and highly skilled. It brought peace to our home.
              </p>
              <div>
                <h4 className="font-bold text-gray-900 dark:text-white">HR. Mahima Gayakwad</h4>
                <span className="text-sm text-gray-500 dark:text-gray-400">Disabled Patient Family</span>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* SECTION 7 — BOOKING CTA */}
      <section className="py-24 bg-brand-blue text-center px-6 overflow-hidden">
        <AnimateOnScroll variants={{ hidden: { opacity: 0, scale: 0.92 }, visible: { opacity: 1, scale: 1, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } } }} className="max-w-2xl mx-auto flex flex-col items-center">
          <h2 className="text-3xl md:text-5xl font-bold text-white mb-6">Ready to Book Your Care?</h2>
          <p className="text-brand-blue-light/80 text-lg md:text-xl mb-10 font-light max-w-lg">
            Schedule in minutes. We'll be at your door with the professional medical care you deserve.
          </p>
          <motion.div
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 400, damping: 20 }}
          >
            <GradientButton asChild size="lg" variant="neutral" className="w-full sm:w-auto h-14">
              <Link to="/appointment" className="flex items-center justify-center text-brand-blue font-bold">
                Book Appointment
              </Link>
            </GradientButton>
          </motion.div>
        </AnimateOnScroll>
      </section>
    </div>
    </PageTransition>
  );
}
