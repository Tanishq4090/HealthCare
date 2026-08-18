import { useParams, Navigate, Link } from 'react-router-dom';
import { ChevronRight, CheckCircle2, Phone, CalendarHeart, MessageCircle, ArrowRight, ShieldCheck, Clock, Award, Sparkles } from 'lucide-react';
import { services } from '@/data/services';
import { motion } from 'framer-motion';
import { PageTransition } from '@/components/PageTransition';
import { AnimateOnScroll } from '@/components/AnimateOnScroll';
import { fadeUp, slideLeft, slideRight, staggerContainer, staggerItem } from '@/lib/animations';
import { GradientButton } from '@/components/ui/gradient-button';
import { SEOMeta } from '@/components/SEOMeta';

export default function ServiceDetailPage() {
  const { slug } = useParams();
  
  // Find the requested service
  const service = services.find(s => s.slug === slug);
  
  // Handle 404 gracefully
  if (!service) {
    return <Navigate to="/services" replace />;
  }

  // Other services for the bottom grid section
  const otherServices = services.filter(s => s.slug !== service.slug);

  return (
    <PageTransition>
      <SEOMeta
        title={`${service.title} in Surat | 99 Care`}
        description={service.shortDesc}
        canonical={`https://99care.org/services/${service.slug}`}
        ogImage={`https://99care.org${service.image}`}
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "Service",
          "name": `${service.title} at Home`,
          "serviceType": service.category === 'nursing' ? 'Home Nursing Care' : 'Home Caretaker Service',
          "provider": {
            "@type": ["LocalBusiness", "MedicalBusiness"],
            "name": "99 Care",
            "telephone": "+919016116564",
            "url": "https://99care.org",
            "address": {
              "@type": "PostalAddress",
              "addressLocality": "Surat",
              "addressRegion": "Gujarat",
              "addressCountry": "IN"
            }
          },
          "areaServed": {
            "@type": "City",
            "name": "Surat"
          },
          "description": service.shortDesc,
          "image": `https://99care.org${service.image}`
        }}
      />
      <div className="w-full bg-slate-50/60 dark:bg-slate-950 min-h-screen pb-32">
        {/* SECTION 1 — HERO HEADER */}
        <section className="relative pt-32 pb-20 px-6 bg-gradient-to-b from-blue-50/60 via-white to-slate-50/60 dark:from-slate-900 dark:via-slate-950 dark:to-slate-950 border-b border-gray-200/60 dark:border-slate-800 overflow-hidden">
          {/* Subtle Decorative Background Glow */}
          <div className="absolute top-10 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-brand-blue/5 blur-[120px] rounded-full pointer-events-none"></div>

          <div className="container mx-auto max-w-7xl relative z-10">
            {/* Breadcrumbs */}
            <AnimateOnScroll variants={{ hidden: { opacity: 0, y: -10 }, visible: { opacity: 1, y: 0, transition: { duration: 0.4 } } }}>
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white dark:bg-slate-900 border border-gray-200/80 dark:border-slate-800 text-xs text-gray-500 dark:text-gray-400 mb-8 shadow-sm">
                <Link to="/" className="hover:text-brand-blue transition-colors">Home</Link>
                <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
                <Link to="/services" className="hover:text-brand-blue transition-colors">Services</Link>
                <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
                <span className="text-brand-blue dark:text-teal-400 font-semibold">{service.title}</span>
              </div>
            </AnimateOnScroll>

            {/* Category Tag */}
            <AnimateOnScroll variants={fadeUp} delay={0.05}>
              <div className="flex items-center gap-2 mb-4">
                <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-brand-blue/10 text-brand-blue dark:text-teal-400 text-xs font-bold uppercase tracking-wider">
                  <Sparkles className="w-3.5 h-3.5" />
                  {service.category === 'nursing' ? 'Professional Nursing Service' : 'Dedicated Caretaker Service'}
                </span>
              </div>
            </AnimateOnScroll>

            {/* Main Title */}
            <AnimateOnScroll variants={fadeUp} delay={0.1}>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-gray-900 dark:text-white mb-6 tracking-tight leading-[1.15]">
                {service.title}
              </h1>
            </AnimateOnScroll>

            {/* Subtitle */}
            <AnimateOnScroll variants={fadeUp} delay={0.2}>
              <p className="text-lg sm:text-xl text-gray-600 dark:text-gray-300 font-light max-w-3xl leading-relaxed mb-10">
                {service.shortDesc}
              </p>
            </AnimateOnScroll>

            {/* Quick Trust Pill Badges Bar */}
            <AnimateOnScroll variants={fadeUp} delay={0.3}>
              <div className="flex flex-wrap gap-4 pt-4 border-t border-gray-200/80 dark:border-slate-800 text-xs font-medium text-gray-600 dark:text-gray-400">
                <div className="flex items-center gap-2 bg-white dark:bg-slate-900 px-4 py-2 rounded-xl border border-gray-200/60 dark:border-slate-800 shadow-sm">
                  <ShieldCheck className="w-4 h-4 text-emerald-500" />
                  <span>100% Background Verified Staff</span>
                </div>
                <div className="flex items-center gap-2 bg-white dark:bg-slate-900 px-4 py-2 rounded-xl border border-gray-200/60 dark:border-slate-800 shadow-sm">
                  <Clock className="w-4 h-4 text-brand-blue" />
                  <span>24/7 On-Call Support</span>
                </div>
                <div className="flex items-center gap-2 bg-white dark:bg-slate-900 px-4 py-2 rounded-xl border border-gray-200/60 dark:border-slate-800 shadow-sm">
                  <Award className="w-4 h-4 text-amber-500" />
                  <span>Experienced Care Specialists in Surat</span>
                </div>
              </div>
            </AnimateOnScroll>
          </div>
        </section>

      {/* SECTION 2 — TWO COLUMN CONTENT */}
      <section className="pt-16 px-6">
        <div className="container mx-auto max-w-7xl">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16">
            
            {/* LEFT COLUMN: Main Content (8 cols) */}
            <AnimateOnScroll variants={slideLeft} className="lg:col-span-8 space-y-10">
              
              {/* About Service Card */}
              <div className="bg-white dark:bg-slate-900 p-8 md:p-12 rounded-3xl border border-gray-200/80 dark:border-slate-800 shadow-sm hover:shadow-md transition-all duration-300">
                <div className="flex items-center gap-3 mb-8 pb-4 border-b border-gray-100 dark:border-slate-800">
                  <div className="w-10 h-10 rounded-2xl bg-brand-blue/10 text-brand-blue flex items-center justify-center font-bold">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">About This Service</h2>
                </div>
                <div className="space-y-6 text-base sm:text-lg text-gray-600 dark:text-gray-300 font-light leading-relaxed">
                  {service.description.map((para, idx) => (
                    <p key={idx} className="leading-relaxed">
                      {para}
                    </p>
                  ))}
                </div>
              </div>

              {/* Key Benefits Card */}
              <div className="bg-white dark:bg-slate-900 p-8 md:p-12 rounded-3xl border border-gray-200/80 dark:border-slate-800 shadow-sm hover:shadow-md transition-all duration-300">
                <div className="flex items-center gap-3 mb-8 pb-4 border-b border-gray-100 dark:border-slate-800">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">Key Benefits & Features</h2>
                </div>
                <motion.ul 
                  variants={staggerContainer} 
                  initial="hidden" 
                  whileInView="visible" 
                  viewport={{ once: true, margin: '-80px' }}
                  className="grid grid-cols-1 sm:grid-cols-2 gap-4"
                >
                  {service.benefits.map((benefit, idx) => (
                    <motion.li 
                      key={idx} 
                      variants={staggerItem} 
                      className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-gray-100 dark:border-slate-800 flex items-start gap-3.5 hover:border-brand-blue/30 transition-colors"
                    >
                      <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                      <span className="text-sm sm:text-base text-gray-700 dark:text-gray-200 font-medium leading-snug">{benefit}</span>
                    </motion.li>
                  ))}
                </motion.ul>
              </div>
            </AnimateOnScroll>

            {/* RIGHT COLUMN: Sticky Sidebar (4 cols) */}
            <AnimateOnScroll variants={slideRight} delay={0.2} className="lg:col-span-4">
              <div className="sticky top-32 space-y-6">
                
                {/* Service Featured Photo */}
                <div className="bg-white dark:bg-slate-900 p-2.5 rounded-3xl border border-gray-200/80 dark:border-slate-800 shadow-sm overflow-hidden">
                   <div className="aspect-[4/3] rounded-2xl overflow-hidden bg-slate-100 dark:bg-slate-800">
                     <img 
                       src={service.image} 
                       alt={service.title}
                       className="w-full h-full object-cover object-top transition-transform duration-500 hover:scale-105"
                     />
                   </div>
                </div>

                {/* Booking & Inquiry Card */}
                <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl border border-gray-200/80 dark:border-slate-800 shadow-md flex flex-col gap-6">
                  <div>
                    <span className="text-brand-blue text-xs font-bold uppercase tracking-[0.15em] mb-2 block">24/7 Fast Dispatch</span>
                    <h3 className="text-2xl font-bold text-gray-900 dark:text-white leading-tight">Book {service.title}</h3>
                  </div>
                  
                  <div className="h-px w-full bg-gray-100 dark:bg-slate-800"></div>
                  
                  <div className="flex flex-col gap-4">
                    <motion.a 
                      whileHover={{ scale: 1.02, y: -2 }}
                      whileTap={{ scale: 0.98 }}
                      transition={{ duration: 0.2 }}
                      href="tel:+919016116564" 
                      className="flex items-center gap-4 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-gray-200/60 dark:border-slate-700/60 hover:bg-brand-blue hover:text-white group transition-all"
                    >
                      <div className="w-11 h-11 rounded-xl bg-white dark:bg-slate-700 flex items-center justify-center text-gray-700 dark:text-gray-200 group-hover:bg-white/20 group-hover:text-white transition-colors flex-shrink-0 shadow-sm">
                        <Phone className="w-5 h-5 text-brand-blue group-hover:text-white" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-gray-400 dark:text-gray-400 uppercase tracking-wider group-hover:text-white/80">Call Us Directly</div>
                        <div className="text-sm font-bold text-gray-900 dark:text-white group-hover:text-white tracking-wide">+91 9016 116 564</div>
                      </div>
                    </motion.a>

                    <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} transition={{ type: 'spring', stiffness: 400, damping: 20 }}>
                      <Link to={`/appointment?service=${service.slug}`} className="w-full bg-brand-blue text-white py-4 rounded-2xl text-base font-bold hover:bg-brand-blue/90 hover:shadow-lg transition-all flex justify-center items-center gap-2">
                        <CalendarHeart className="w-5 h-5" /> Book Appointment
                      </Link>
                    </motion.div>

                    <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} transition={{ type: 'spring', stiffness: 400, damping: 20 }}>
                      <GradientButton asChild variant="success" className="w-full py-4 rounded-2xl flex justify-center items-center gap-2">
                        <a href={`https://wa.me/919016116564?text=Hi, I want to inquire about ${service.title} services.`} target="_blank" rel="noopener noreferrer">
                           <MessageCircle className="w-5 h-5 flex-shrink-0 fill-white" /> Chat on WhatsApp
                        </a>
                      </GradientButton>
                    </motion.div>
                  </div>
                </div>

                {/* Why Trust 99 Care Box */}
                <div className="p-8 rounded-3xl bg-white dark:bg-slate-900 border border-gray-200/80 dark:border-slate-800 shadow-sm">
                  <h4 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-widest mb-6 text-center">Why Trust 99 Care</h4>
                  <div className="space-y-5">
                    {service.whyUs.map((point, idx) => (
                      <div key={idx} className="flex gap-3.5">
                        <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                        <div>
                          <div className="text-sm font-bold text-gray-900 dark:text-white mb-1">{point.title}</div>
                          <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">{point.text}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            </AnimateOnScroll>

          </div>
        </div>
      </section>

      {/* SECTION 3 — EXPLORE ALL OTHER SERVICES */}
      <section className="pt-24 px-6 border-t border-gray-200/60 dark:border-slate-800 mt-24">
        <div className="container mx-auto max-w-7xl">
          <AnimateOnScroll variants={fadeUp} delay={0.1}>
            <div className="text-center mb-16">
              <span className="text-brand-blue text-xs font-bold uppercase tracking-[0.2em] mb-3 block">Complete Care Options</span>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 dark:text-white mb-4 tracking-tight">Explore Other Care Services</h2>
              <p className="text-gray-500 dark:text-gray-400 text-base max-w-2xl mx-auto font-light">
                Discover our full spectrum of professional nursing and dedicated caretaker services in Surat.
              </p>
            </div>
          </AnimateOnScroll>

          <motion.div 
            variants={staggerContainer} 
            initial="hidden" 
            whileInView="visible" 
            viewport={{ once: true, margin: '-80px' }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
          >
            {otherServices.map((item) => (
              <motion.div key={item.slug} variants={staggerItem}>
                <Link to={`/services/${item.slug}`} className="block h-full">
                  <motion.div
                    whileHover={{ y: -6, boxShadow: '0 20px 40px rgba(27, 108, 168, 0.10)' }}
                    transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                    className="bg-white dark:bg-slate-900 rounded-3xl border border-gray-200/80 dark:border-slate-800 overflow-hidden transition-all duration-300 group text-left flex flex-col h-full cursor-pointer shadow-sm hover:shadow-md"
                  >
                    <div className="aspect-[16/10] w-full bg-slate-100 dark:bg-slate-800 overflow-hidden border-b border-gray-100 dark:border-slate-800">
                      <img 
                        src={item.image} 
                        alt={item.title}
                        className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-500"
                      />
                    </div>
                    <div className="p-7 flex flex-col flex-1">
                      <span className="text-[10px] font-bold text-brand-blue uppercase tracking-widest mb-3 bg-brand-blue/10 dark:bg-slate-800 px-3 py-1 rounded-full w-fit">
                        {item.category === 'nursing' ? 'Nursing Service' : 'Caretaker Service'}
                      </span>
                      <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2 group-hover:text-brand-blue transition-colors">
                        {item.title}
                      </h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 leading-relaxed flex-1">
                        {item.shortDesc}
                      </p>
                      <div className="text-brand-blue text-sm font-semibold flex items-center gap-1 group-hover:gap-2 transition-all mt-auto pt-4 border-t border-gray-100 dark:border-slate-800">
                        <span>Learn More</span>
                        <ArrowRight className="w-4 h-4" />
                      </div>
                    </div>
                  </motion.div>
                </Link>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      </div>
    </PageTransition>
  );
}
