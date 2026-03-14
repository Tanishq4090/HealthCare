import { useParams, Navigate, Link } from 'react-router-dom';
import { ChevronRight, CheckCircle2, Phone, CalendarHeart, MessageCircle } from 'lucide-react';
import { services } from '@/data/services';
import { motion } from 'framer-motion';
import { PageTransition } from '@/components/PageTransition';
import { AnimateOnScroll } from '@/components/AnimateOnScroll';
import { fadeUp, slideLeft, slideRight, staggerContainer, staggerItem } from '@/lib/animations';

export default function ServiceDetailPage() {
  const { slug } = useParams();
  
  // Find the requested service
  const service = services.find(s => s.slug === slug);
  
  // Handle 404 gracefully
  if (!service) {
    return <Navigate to="/services" replace />;
  }

  return (
    <PageTransition>
      <div className="w-full bg-brand-gray dark:bg-slate-950 min-h-screen pb-32">
        {/* SECTION 1 — HERO */}
        <section className="pt-32 pb-16 px-6 bg-white dark:bg-slate-950 border-b border-gray-100 dark:border-slate-800">
          <div className="container mx-auto max-w-7xl">
            <AnimateOnScroll variants={{ hidden: { opacity: 0 }, visible: { opacity: 1, transition: { duration: 0.5 } } }}>
              <div className="text-sm text-gray-400 mb-8 flex items-center gap-2">
                <Link to="/" className="hover:text-brand-blue transition-colors">Home</Link>
                <ChevronRight className="w-4 h-4" />
                <Link to="/services" className="hover:text-brand-blue transition-colors">Services</Link>
                <ChevronRight className="w-4 h-4" />
                <span className="text-gray-900 dark:text-white font-medium">{service.title}</span>
              </div>
            </AnimateOnScroll>
            <AnimateOnScroll variants={fadeUp} delay={0.1}>
              <h1 className="text-4xl md:text-5xl font-extrabold text-gray-900 dark:text-white mb-6 tracking-tight">
                {service.title}
              </h1>
            </AnimateOnScroll>
            <AnimateOnScroll variants={fadeUp} delay={0.2}>
              <p className="text-xl text-gray-500 font-light max-w-3xl">
                {service.shortDesc}
              </p>
            </AnimateOnScroll>
          </div>
        </section>

      {/* SECTION 2 — TWO COLUMN CONTENT */}
      <section className="pt-16 px-6">
        <div className="container mx-auto max-w-7xl">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16">
            
            {/* LEFT COLUMN: Main Content (8 cols) */}
            <AnimateOnScroll variants={slideLeft} className="lg:col-span-8">
              <div className="bg-white dark:bg-slate-900 p-8 md:p-12 rounded-[2rem] border border-gray-200 dark:border-slate-800 mb-12 shadow-sm hover:shadow-md transition-shadow duration-300">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">About This Service</h2>
                <div className="space-y-6 text-lg text-gray-600 dark:text-gray-400 font-light leading-relaxed">
                  {service.description.map((para, idx) => (
                    <p key={idx}>{para}</p>
                  ))}
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 p-8 md:p-12 rounded-[2rem] border border-gray-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow duration-300">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-8">Key Benefits</h2>
                <motion.ul 
                  variants={staggerContainer} 
                  initial="hidden" 
                  whileInView="visible" 
                  viewport={{ once: true, margin: '-80px' }}
                  className="space-y-5"
                >
                  {service.benefits.map((benefit, idx) => (
                    <motion.li key={idx} variants={staggerItem} className="flex items-start gap-4">
                      <CheckCircle2 className="w-6 h-6 text-brand-green flex-shrink-0 mt-0.5" />
                      <span className="text-lg text-gray-700 dark:text-gray-300 leading-relaxed">{benefit}</span>
                    </motion.li>
                  ))}
                </motion.ul>
              </div>
            </AnimateOnScroll>

            {/* RIGHT COLUMN: Sticky Sidebar (4 cols) */}
            <AnimateOnScroll variants={slideRight} delay={0.2} className="lg:col-span-4">
              <div className="sticky top-32">
                <div className="bg-white dark:bg-slate-900 p-2 rounded-[2rem] border border-gray-200 dark:border-slate-800 shadow-sm mb-6 overflow-hidden">
                   <div className="aspect-[4/3] rounded-[1.5rem] overflow-hidden">
                     <img 
                       src={service.image} 
                       alt={service.title}
                       className="w-full h-full object-cover"
                     />
                   </div>
                </div>
                <div className="bg-white dark:bg-slate-900 p-8 rounded-[2rem] border border-gray-200 dark:border-slate-800 shadow-sm flex flex-col gap-6">
                  <div>
                    <span className="text-brand-blue text-xs font-bold uppercase tracking-[0.15em] mb-2 block">Available 24/7</span>
                    <h3 className="text-2xl font-bold text-gray-900 dark:text-white leading-tight">Book {service.title}</h3>
                  </div>
                  
                  <div className="h-px w-full bg-gray-100 dark:bg-slate-800"></div>
                  
                  <div className="flex flex-col gap-5">
                    <motion.a 
                      whileHover={{ scale: 1.02, y: -2 }}
                      whileTap={{ scale: 0.98 }}
                      transition={{ duration: 0.2 }}
                      href="tel:+919016116564" 
                      className="flex items-center gap-4 group cursor-pointer"
                    >
                      <div className="w-12 h-12 rounded-xl bg-gray-50 dark:bg-slate-800 flex items-center justify-center text-gray-600 dark:text-gray-400 group-hover:bg-brand-blue group-hover:text-white transition-colors">
                        <Phone className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-gray-900 dark:text-white">Call Us Directly</div>
                        <div className="text-gray-500 dark:text-gray-400 font-medium tracking-wide">+91 9016 116 564</div>
                      </div>
                    </motion.a>

                    <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} transition={{ type: 'spring', stiffness: 400, damping: 20 }}>
                      <Link to={`/appointment?service=${service.slug}`} className="w-full bg-brand-blue text-white py-4 rounded-xl text-base font-semibold hover:bg-brand-blue/90 hover:shadow-lg transition-all flex justify-center items-center gap-2">
                        <CalendarHeart className="w-5 h-5" /> Book Appointment
                      </Link>
                    </motion.div>

                    <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} transition={{ type: 'spring', stiffness: 400, damping: 20 }}>
                      <a href={`https://wa.me/919016116564?text=Hi, I want to inquire about ${service.title} services.`} target="_blank" rel="noopener noreferrer" className="w-full bg-white text-[#25D366] border border-[#25D366] py-3.5 rounded-xl text-base font-semibold hover:bg-[#25D366]/5 transition-all flex justify-center items-center gap-2">
                         <MessageCircle className="w-5 h-5" /> Chat on WhatsApp
                      </a>
                    </motion.div>
                  </div>
                </div>

                <div className="mt-8 px-6 pt-8 border-t border-gray-200 dark:border-slate-800">
                  <h4 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-widest mb-6 text-center">Why Trust 99 Care</h4>
                  <div className="space-y-6">
                    {service.whyUs.map((point, idx) => (
                      <div key={idx} className="flex gap-3">
                        <CheckCircle2 className="w-5 h-5 text-brand-green flex-shrink-0 mt-0.5" />
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
      </div>
    </PageTransition>
  );
}
