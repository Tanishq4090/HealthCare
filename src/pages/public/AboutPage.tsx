import { Link } from 'react-router-dom';
import { ChevronRight, CheckCircle2, HeartHandshake, Eye, HandHeart, ShieldCheck, Award, Star } from 'lucide-react';
import { motion } from 'framer-motion';
import { PageTransition } from '@/components/PageTransition';
import { AnimateOnScroll } from '@/components/AnimateOnScroll';
import { fadeUp, slideLeft, slideRight, staggerContainer, staggerItem } from '@/lib/animations';

export default function AboutPage() {
  return (
    <PageTransition>
      <div className="w-full">
      {/* SECTION 1 — PAGE HERO */}
      <section className="pt-32 pb-16 px-6 text-center bg-white dark:bg-slate-950 border-b border-gray-100 dark:border-slate-800">
        <div className="max-w-3xl mx-auto">
          <AnimateOnScroll variants={{ hidden: { opacity: 0 }, visible: { opacity: 1, transition: { duration: 0.5 } } }}>
            <div className="text-sm text-gray-400 mb-6 flex justify-center items-center gap-2">
              <Link to="/" className="hover:text-brand-blue transition-colors">Home</Link>
              <ChevronRight className="w-4 h-4" />
              <span className="text-gray-900 dark:text-white font-medium">About</span>
            </div>
            <span className="text-brand-blue text-xs font-bold uppercase tracking-[0.2em] mb-4 block">Our Story</span>
          </AnimateOnScroll>
          <AnimateOnScroll variants={fadeUp} delay={0.1}>
            <h1 className="text-4xl md:text-5xl font-extrabold text-gray-900 dark:text-white mb-6 tracking-tight">
              Caring for Surat, One Home at a Time
            </h1>
          </AnimateOnScroll>
          <AnimateOnScroll variants={fadeUp} delay={0.2}>
            <p className="text-lg text-gray-500 dark:text-gray-400 font-light">
              Bringing professional, compassionate, and personalized healthcare directly to your doorstep.
            </p>
          </AnimateOnScroll>
        </div>
      </section>

      {/* SECTION 2 — ABOUT INTRO */}
      <section className="py-24 bg-white dark:bg-slate-950 overflow-hidden">
        <div className="container mx-auto px-6 max-w-7xl">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
            <AnimateOnScroll variants={slideLeft}>
              <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-6 tracking-tight">Welcome to 99 Care</h2>
              <p className="text-gray-600 dark:text-gray-400 mb-6 leading-relaxed">
                We understand that home is where healing happens best. That's why we bring expert medical care directly to you. Our team of certified nurses, experienced physiotherapists, and dedicated caretakers are passionate about improving your quality of life without the stress of hospital visits.
              </p>
              <p className="text-gray-600 dark:text-gray-400 mb-10 leading-relaxed">
                Founded in Surat, Gujarat, we have built our reputation on trust, reliability, and an unwavering commitment to patient well-being.
              </p>
              
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-brand-blue" />
                  <span className="text-gray-700 dark:text-gray-300 font-medium">Certified & Experienced Medical Staff</span>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-brand-blue" />
                  <span className="text-gray-700 dark:text-gray-300 font-medium">Personalized Care Plans</span>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-brand-blue" />
                  <span className="text-gray-700 dark:text-gray-300 font-medium">24/7 Support and Monitoring</span>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-brand-blue" />
                  <span className="text-gray-700 dark:text-gray-300 font-medium">Thorough Background Verification</span>
                </div>
              </div>
            </AnimateOnScroll>
            
            <AnimateOnScroll variants={slideRight} delay={0.2} className="relative">
              {/* Real About Us Image */}
              <div className="aspect-video bg-gray-100 dark:bg-slate-900 rounded-2xl overflow-hidden relative shadow-sm border border-gray-100 dark:border-slate-800">
                <img 
                  src="/images/about-us.jpg" 
                  alt="99 Care Team"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-br from-brand-blue/5 to-transparent"></div>
              </div>
              <div className="mt-4 text-center">
                <span className="text-sm text-gray-500 dark:text-gray-400 italic">Delivering healthcare with compassion in Surat</span>
              </div>
            </AnimateOnScroll>
          </div>
        </div>
      </section>

      {/* SECTION 3 — OUR STORY */}
      <section className="py-24 bg-white dark:bg-slate-950 border-t border-gray-100 dark:border-slate-800">
        <div className="container mx-auto px-6 max-w-3xl text-center">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-10 tracking-tight">Our Story</h2>
          
          <div className="text-left space-y-6 text-gray-600 dark:text-gray-400 leading-relaxed text-lg font-light">
            <p>
              99Care was founded with a strong desire to redefine the manner in which care services are delivered in order to give high-quality, professional, and personalized care directly to our patients’ homes. It started out from a really simplistic idea — healing happens best in the comfort of one’s own space. Since our establishment, we have been working extensively with an objective to cater to all the specific needs of families and people with reliable healthcare solutions.
            </p>
            
            <h3 className="text-xl font-bold text-gray-900 dark:text-white pt-6">Expanding with Intention</h3>
            <p>
              By expanding the business from basic caring to comprehensive medical support comprising nursing, physiotherapy, post-surgical care, and much more, we have developed remarkably over the years. This growth stems from an approach toward excellence, wherein every care provider we recruit is meticulously evaluated and rigorously trained to render compassionate care.
            </p>
            
            <h3 className="text-xl font-bold text-gray-900 dark:text-white pt-6">Bringing About Change</h3>
            <p>
              With pride, 99Care serves as a reliable healthcare partner for multiple families today. Continuing into the future, we still hold tight to our core values, innovating and raising the bar for home health services.
            </p>
          </div>
        </div>
      </section>

      {/* SECTION 4 — MISSION & VISION */}
      <section className="py-24 bg-brand-gray dark:bg-slate-900/50 border-t border-gray-100 dark:border-slate-800">
        <div className="container mx-auto px-6 max-w-6xl">
          <motion.div 
            variants={staggerContainer} 
            initial="hidden" 
            whileInView="visible" 
            viewport={{ once: true, margin: '-80px' }}
            className="grid grid-cols-1 md:grid-cols-2 gap-8"
          >
            {/* Mission Card */}
            <motion.div variants={staggerItem}>
              <motion.div 
                whileHover={{ y: -6, boxShadow: '0 20px 40px rgba(27, 108, 168, 0.10)' }}
                transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                className="bg-white dark:bg-slate-900 p-10 md:p-12 rounded-[2rem] border border-gray-200 dark:border-slate-800 h-full transition-all"
              >
                <div className="w-14 h-14 bg-brand-blue-light dark:bg-slate-800 rounded-2xl flex items-center justify-center mb-8 text-brand-blue">
                  <HandHeart className="w-7 h-7" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Our Mission</h3>
                <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
                  To create a seamless and compassionate healthcare experience at home, assuring patients of dignity and prompt care while offering peace of mind to their families through a team that is well-prepared and genuinely empathetic.
                </p>
              </motion.div>
            </motion.div>

            {/* Vision Card */}
            <motion.div variants={staggerItem}>
              <motion.div 
                whileHover={{ y: -6, boxShadow: '0 20px 40px rgba(27, 108, 168, 0.10)' }}
                transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                className="bg-white dark:bg-slate-900 p-10 md:p-12 rounded-[2rem] border border-gray-200 dark:border-slate-800 h-full transition-all"
              >
                <div className="w-14 h-14 bg-brand-teal-light dark:bg-slate-800 rounded-2xl flex items-center justify-center mb-8 text-brand-teal">
                  <Eye className="w-7 h-7" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Our Vision</h3>
                <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
                  To be the most trusted and preferred partner for home healthcare in the region, setting new benchmarks for quality, reliability, and compassion in every aspect of personalized recovery and wellness.
                </p>
              </motion.div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* SECTION 5 — VALUES */}
      <section className="py-24 md:py-32 bg-white dark:bg-slate-950 flex overflow-hidden">
        <div className="container mx-auto px-6 max-w-5xl">
          <AnimateOnScroll variants={{ hidden: { opacity: 0 }, visible: { opacity: 1, transition: { duration: 0.5 } } }} className="text-center mb-20">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">Our Core Values</h2>
          </AnimateOnScroll>

          <motion.div 
            variants={staggerContainer} 
            initial="hidden" 
            whileInView="visible" 
            viewport={{ once: true, margin: '-80px' }}
            className="grid grid-cols-1 sm:grid-cols-2 gap-x-16 gap-y-16"
          >
            <motion.div variants={staggerItem} className="flex gap-6 group">
              <div className="flex-shrink-0 mt-1">
                <motion.div 
                  whileHover={{ scale: 1.1, backgroundColor: '#EFF6FF' }}
                  transition={{ duration: 0.25 }}
                  className="w-12 h-12 bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-full flex items-center justify-center text-gray-700 dark:text-gray-300 group-hover:text-brand-blue group-hover:border-brand-blue-light"
                >
                  <ShieldCheck className="w-5 h-5" />
                </motion.div>
              </div>
              <div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">Integrity</h3>
                <p className="text-gray-500 dark:text-gray-400 leading-relaxed">We operate with complete transparency and honesty in all our patient interactions, building lasting relationships founded on moral principles.</p>
              </div>
            </motion.div>

            <motion.div variants={staggerItem} className="flex gap-6 group">
              <div className="flex-shrink-0 mt-1">
                <motion.div 
                  whileHover={{ scale: 1.1, backgroundColor: '#EFF6FF' }}
                  transition={{ duration: 0.25 }}
                  className="w-12 h-12 bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-full flex items-center justify-center text-gray-700 dark:text-gray-300 group-hover:text-brand-blue group-hover:border-brand-blue-light"
                >
                  <HeartHandshake className="w-5 h-5" />
                </motion.div>
              </div>
              <div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">Compassion</h3>
                <p className="text-gray-500 dark:text-gray-400 leading-relaxed">We provide care that goes beyond medical needs, treating every patient with the empathy, respect, and warmth they deserve.</p>
              </div>
            </motion.div>

            <motion.div variants={staggerItem} className="flex gap-6 group">
              <div className="flex-shrink-0 mt-1">
                <motion.div 
                  whileHover={{ scale: 1.1, backgroundColor: '#EFF6FF' }}
                  transition={{ duration: 0.25 }}
                  className="w-12 h-12 bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-full flex items-center justify-center text-gray-700 dark:text-gray-300 group-hover:text-brand-blue group-hover:border-brand-blue-light"
                >
                  <Award className="w-5 h-5" />
                </motion.div>
              </div>
              <div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">Excellence</h3>
                <p className="text-gray-500 dark:text-gray-400 leading-relaxed">We are committed to delivering the highest clinical standards through rigorous training, continuous improvement, and professional execution.</p>
              </div>
            </motion.div>

            <motion.div variants={staggerItem} className="flex gap-6 group">
              <div className="flex-shrink-0 mt-1">
                <motion.div 
                  whileHover={{ scale: 1.1, backgroundColor: '#EFF6FF' }}
                  transition={{ duration: 0.25 }}
                  className="w-12 h-12 bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-full flex items-center justify-center text-gray-700 dark:text-gray-300 group-hover:text-brand-blue group-hover:border-brand-blue-light"
                >
                  <Star className="w-5 h-5" />
                </motion.div>
              </div>
              <div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">Trust</h3>
                <p className="text-gray-500 dark:text-gray-400 leading-relaxed">We understand we are entering your home. Every member of our team is carefully vetted to ensure your complete safety and peace of mind.</p>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* SECTION 6 — BOOKING CTA */}
      <section className="py-24 bg-brand-blue text-center px-6 overflow-hidden">
        <AnimateOnScroll variants={{ hidden: { opacity: 0, scale: 0.92 }, visible: { opacity: 1, scale: 1, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } } }} className="max-w-2xl mx-auto flex flex-col items-center">
          <h2 className="text-3xl md:text-5xl font-bold text-white mb-6">Ready to Experience Better Care?</h2>
          <p className="text-brand-blue-light/80 text-lg md:text-xl mb-10 font-light max-w-lg">
            Schedule a consultation today and let our family care for yours.
          </p>
          <motion.div
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 400, damping: 20 }}
          >
            <Link 
              to="/appointment" 
              className="bg-white text-brand-blue px-10 py-4 rounded-full text-base font-bold hover:bg-gray-50 transition-all shadow-lg block"
            >
              Book Appointment
            </Link>
          </motion.div>
        </AnimateOnScroll>
      </section>
    </div>
    </PageTransition>
  );
}
