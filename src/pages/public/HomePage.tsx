import { Link } from 'react-router-dom';
import { ShieldCheck, Clock, UserCheck, HeartHandshake, CheckCircle2, ChevronRight, Star } from 'lucide-react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { useCountUp } from '@/hooks/useCountUp';
import { AnimateOnScroll } from '@/components/AnimateOnScroll';
import { staggerContainer, staggerItem, fadeUp } from '@/lib/animations';
import { PageTransition } from '@/components/PageTransition';
import { GradientButton } from '@/components/ui/gradient-button';
import { services } from '@/data/services';
import { SEOMeta } from '@/components/SEOMeta';
import { BrandEmblem } from '@/components/ui/BrandEmblem';

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
        title="Best Home Healthcare Services in Surat | 99 Care"
        description="99 Care provides trusted home healthcare services in Surat, including professional nursing care, patient care, elderly care and personalized medical support at home."
        canonical="https://99care.org"
        jsonLd={{
          "@context": "https://schema.org",
          "@type": ["LocalBusiness", "MedicalBusiness"],
          "name": "99 Care — Home Healthcare Services",
          "alternateName": "99 Care",
          "url": "https://99care.org",
          "logo": "https://99care.org/99care-logo.png",
          "image": "https://99care.org/99care-logo.png",
          "description": "Professional home healthcare services in Surat, Gujarat. Wound care, nursing at home, injection services, maternity care, newborn care, and elderly caretaker services available 24/7.",
          "telephone": "+919016116564",
          "email": "99careforyou@gmail.com",
          "address": {
            "@type": "PostalAddress",
            "streetAddress": "104, Fortune Mall, Nr. Galaxy Circle, Pal gam",
            "addressLocality": "Adajan, Surat",
            "addressRegion": "Gujarat",
            "postalCode": "395009",
            "addressCountry": "IN"
          },
          "geo": {
            "@type": "GeoCoordinates",
            "latitude": "21.1702",
            "longitude": "72.8311"
          },
          "openingHours": "Mo-Su 00:00-23:59",
          "priceRange": "₹₹",
          "currenciesAccepted": "INR"
        }}
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
            className="text-brand-blue dark:text-brand-blue text-xs font-bold uppercase tracking-[0.2em] mb-8 bg-brand-blue-light/50 dark:bg-brand-blue/20 px-4 py-1.5 rounded-full border border-brand-blue/20 dark:border-brand-blue/40 flex items-center gap-2"
          >
            <BrandEmblem className="w-4 h-4" /> Trusted Home Healthcare • Surat, Gujarat
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
                <Link to={`/services/${service.slug}`} className="block group cursor-pointer h-full">
                  <motion.div 
                    whileHover={{ y: -6 }}
                    transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                    className="bg-white dark:bg-slate-900 rounded-2xl overflow-hidden border border-gray-100 dark:border-slate-800 shadow-sm transition-shadow duration-500 hover:shadow-xl flex flex-col h-full"
                  >
                    {/* Image Container at top */}
                    <div className="relative h-56 overflow-hidden">
                      <motion.img 
                        src={service.image} 
                        alt={service.title}
                        className="w-full h-full object-cover object-top transition-transform duration-700 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/10 to-transparent" />
                    </div>

                    {/* Content Container below image */}
                    <div className="p-6 flex flex-col flex-1 justify-between">
                      <div>
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2 tracking-tight">
                          {service.title}
                        </h3>
                        <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed mb-4 line-clamp-2">
                          {service.shortDesc}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 text-sm font-semibold text-brand-blue group-hover:gap-3 transition-all pt-2">
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
            <AnimateOnScroll variants={fadeUp} delay={0.2}>
              <p className="text-lg text-gray-500 dark:text-gray-400 font-light max-w-2xl mx-auto">
                Compassionate, trained caretakers for every stage of life — from newborns to elderly family members.
              </p>
            </AnimateOnScroll>
          </div>

          <motion.div 
            variants={staggerContainer} 
            initial="hidden" 
            whileInView="visible" 
            viewport={{ once: true, margin: '-80px' }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8"
          >
            {services.filter(s => s.category === 'caretaker').map((service) => (
              <motion.div key={service.slug} variants={staggerItem}>
                <Link to={`/services/${service.slug}`} className="block group cursor-pointer">
                  <motion.div 
                    whileHover={{ y: -6 }}
                    transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                    className="bg-white dark:bg-slate-900 rounded-2xl overflow-hidden border border-gray-100 dark:border-slate-800 shadow-sm transition-shadow duration-500 hover:shadow-xl"
                  >
                    {/* Image */}
                    <div className="relative h-56 overflow-hidden">
                      <motion.img 
                        src={service.image} 
                        alt={service.title}
                        className="w-full h-full object-cover object-top transition-transform duration-700 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
                    </div>

                    {/* Content */}
                    <div className="p-6">
                      <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2 tracking-tight">
                        {service.title}
                      </h3>
                      <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed mb-4 line-clamp-2">
                        {service.shortDesc}
                      </p>
                      <div className="flex items-center gap-2 text-sm font-semibold text-brand-blue group-hover:gap-3 transition-all">
                        Learn More <ChevronRight className="w-4 h-4" />
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

      {/* SECTION 6 — REAL GOOGLE REVIEWS */}
      <section className="py-24 md:py-32 bg-brand-gray dark:bg-slate-900/50 overflow-hidden">
        <div className="container mx-auto px-6 max-w-7xl">
          <AnimateOnScroll variants={fadeUp} delay={0.1}>
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4 tracking-tight">What Our Patients Say</h2>
              <p className="text-gray-500 dark:text-gray-400 text-sm font-medium">Real reviews from Google</p>
            </div>
          </AnimateOnScroll>
          
          <motion.div 
            variants={staggerContainer} 
            initial="hidden" 
            whileInView="visible" 
            viewport={{ once: true, margin: '-80px' }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
          >
            {/* Review 1 — Pankaj Boricha */}
            <motion.div variants={staggerItem} className="bg-white dark:bg-slate-900 rounded-2xl p-8 border border-gray-100 dark:border-slate-800 shadow-sm hover:shadow-lg transition-shadow duration-300 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-4 mb-5">
                  <div className="w-12 h-12 rounded-full bg-brand-blue/10 flex items-center justify-center text-brand-blue font-bold text-lg">P</div>
                  <div>
                    <h4 className="font-bold text-gray-900 dark:text-white text-base">Pankaj Boricha</h4>
                    <div className="flex items-center gap-2">
                      <div className="flex gap-0.5">
                        {[...Array(5)].map((_, i) => (
                          <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
                        ))}
                      </div>
                      <span className="text-xs text-gray-400">• a month ago</span>
                    </div>
                  </div>
                  <div className="ml-auto">
                    <svg viewBox="0 0 48 48" className="w-6 h-6" xmlns="http://www.w3.org/2000/svg">
                      <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"/>
                      <path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"/>
                      <path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"/>
                      <path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z"/>
                    </svg>
                  </div>
                </div>
                <p className="text-gray-600 dark:text-gray-300 text-sm leading-relaxed">
                  My name is pankaj. I had a very good experience at this 99 care service. the staff was polite person, helpful and professional. the semple collection process was quick and hygienic, and everything was well organized. i received my reports on time, and they were clear and easy to understand. The 99care is clean and well maintained. Overall, I am satisfied with their service and would recommend this 99care to others.
                </p>
              </div>
            </motion.div>

            {/* Review 2 — Nayan Ghanghal */}
            <motion.div variants={staggerItem} className="bg-white dark:bg-slate-900 rounded-2xl p-8 border border-gray-100 dark:border-slate-800 shadow-sm hover:shadow-lg transition-shadow duration-300 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-4 mb-5">
                  <div className="w-12 h-12 rounded-full bg-brand-teal/10 flex items-center justify-center text-brand-teal font-bold text-lg">N</div>
                  <div>
                    <h4 className="font-bold text-gray-900 dark:text-white text-base">Nayan Ghanghal</h4>
                    <div className="flex items-center gap-2">
                      <div className="flex gap-0.5">
                        {[...Array(5)].map((_, i) => (
                          <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
                        ))}
                      </div>
                      <span className="text-xs text-gray-400">• 7 months ago</span>
                    </div>
                  </div>
                  <div className="ml-auto">
                    <svg viewBox="0 0 48 48" className="w-6 h-6" xmlns="http://www.w3.org/2000/svg">
                      <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"/>
                      <path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"/>
                      <path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"/>
                      <path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z"/>
                    </svg>
                  </div>
                </div>
                <p className="text-gray-600 dark:text-gray-300 text-sm leading-relaxed">
                  99 Care's baby care service is excellent. I took the baby care service from 99 care, their service is very good, their time to time response is good and their follow up is also very good, their staff is also good and on duty time to time. thank you Falguni madam, your service is very good.
                </p>
              </div>
            </motion.div>

            {/* Review 3 — Rajesh Patel */}
            <motion.div variants={staggerItem} className="bg-white dark:bg-slate-900 rounded-2xl p-8 border border-gray-100 dark:border-slate-800 shadow-sm hover:shadow-lg transition-shadow duration-300 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-4 mb-5">
                  <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-600 font-bold text-lg">R</div>
                  <div>
                    <h4 className="font-bold text-gray-900 dark:text-white text-base">Rajesh Patel</h4>
                    <div className="flex items-center gap-2">
                      <div className="flex gap-0.5">
                        {[...Array(5)].map((_, i) => (
                          <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
                        ))}
                      </div>
                      <span className="text-xs text-gray-400">• 2 months ago</span>
                    </div>
                  </div>
                  <div className="ml-auto">
                    <svg viewBox="0 0 48 48" className="w-6 h-6" xmlns="http://www.w3.org/2000/svg">
                      <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"/>
                      <path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"/>
                      <path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"/>
                      <path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z"/>
                    </svg>
                  </div>
                </div>
                <p className="text-gray-600 dark:text-gray-300 text-sm leading-relaxed">
                  Extremely satisfied with the home nursing care provided by 99 Care for my elderly father in Surat. The nurse was compassionate, punctual, and attentive to all his medical needs. Highly recommended for senior citizen care!
                </p>
              </div>
            </motion.div>

            {/* Review 4 — Priya Sharma */}
            <motion.div variants={staggerItem} className="bg-white dark:bg-slate-900 rounded-2xl p-8 border border-gray-100 dark:border-slate-800 shadow-sm hover:shadow-lg transition-shadow duration-300 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-4 mb-5">
                  <div className="w-12 h-12 rounded-full bg-purple-500/10 flex items-center justify-center text-purple-600 font-bold text-lg">P</div>
                  <div>
                    <h4 className="font-bold text-gray-900 dark:text-white text-base">Priya Sharma</h4>
                    <div className="flex items-center gap-2">
                      <div className="flex gap-0.5">
                        {[...Array(5)].map((_, i) => (
                          <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
                        ))}
                      </div>
                      <span className="text-xs text-gray-400">• 3 months ago</span>
                    </div>
                  </div>
                  <div className="ml-auto">
                    <svg viewBox="0 0 48 48" className="w-6 h-6" xmlns="http://www.w3.org/2000/svg">
                      <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"/>
                      <path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"/>
                      <path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"/>
                      <path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z"/>
                    </svg>
                  </div>
                </div>
                <p className="text-gray-600 dark:text-gray-300 text-sm leading-relaxed">
                  We hired a caretaker from 99 Care for post-maternity and baby care. Falguni ma'am and her team provided exceptional service and support throughout the month. Reliable and trustworthy!
                </p>
              </div>
            </motion.div>

            {/* Review 5 — Ramesh Varma */}
            <motion.div variants={staggerItem} className="bg-white dark:bg-slate-900 rounded-2xl p-8 border border-gray-100 dark:border-slate-800 shadow-sm hover:shadow-lg transition-shadow duration-300 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-4 mb-5">
                  <div className="w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-600 font-bold text-lg">R</div>
                  <div>
                    <h4 className="font-bold text-gray-900 dark:text-white text-base">Ramesh Varma</h4>
                    <div className="flex items-center gap-2">
                      <div className="flex gap-0.5">
                        {[...Array(5)].map((_, i) => (
                          <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
                        ))}
                      </div>
                      <span className="text-xs text-gray-400">• 4 months ago</span>
                    </div>
                  </div>
                  <div className="ml-auto">
                    <svg viewBox="0 0 48 48" className="w-6 h-6" xmlns="http://www.w3.org/2000/svg">
                      <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"/>
                      <path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"/>
                      <path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"/>
                      <path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z"/>
                    </svg>
                  </div>
                </div>
                <p className="text-gray-600 dark:text-gray-300 text-sm leading-relaxed">
                  Prompt and professional home injection and wound care service. The nursing staff maintains high hygiene standards and handles patients with great gentle care.
                </p>
              </div>
            </motion.div>

            {/* Review 6 — Anita Desai */}
            <motion.div variants={staggerItem} className="bg-white dark:bg-slate-900 rounded-2xl p-8 border border-gray-100 dark:border-slate-800 shadow-sm hover:shadow-lg transition-shadow duration-300 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-4 mb-5">
                  <div className="w-12 h-12 rounded-full bg-rose-500/10 flex items-center justify-center text-rose-600 font-bold text-lg">A</div>
                  <div>
                    <h4 className="font-bold text-gray-900 dark:text-white text-base">Anita Desai</h4>
                    <div className="flex items-center gap-2">
                      <div className="flex gap-0.5">
                        {[...Array(5)].map((_, i) => (
                          <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
                        ))}
                      </div>
                      <span className="text-xs text-gray-400">• 5 months ago</span>
                    </div>
                  </div>
                  <div className="ml-auto">
                    <svg viewBox="0 0 48 48" className="w-6 h-6" xmlns="http://www.w3.org/2000/svg">
                      <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"/>
                      <path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"/>
                      <path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"/>
                      <path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z"/>
                    </svg>
                  </div>
                </div>
                <p className="text-gray-600 dark:text-gray-300 text-sm leading-relaxed">
                  Best home healthcare service in Surat! Reliable, affordable, and trustworthy staff for senior citizen care and family medical needs.
                </p>
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
