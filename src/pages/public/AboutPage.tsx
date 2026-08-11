import { Link } from 'react-router-dom';
import { ChevronRight, CheckCircle2, HeartHandshake, Eye, HandHeart, ShieldCheck, Award, Star, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';
import { PageTransition } from '@/components/PageTransition';
import { AnimateOnScroll } from '@/components/AnimateOnScroll';
import { fadeUp, slideLeft, slideRight, staggerContainer, staggerItem } from '@/lib/animations';
import { GradientButton } from '@/components/ui/gradient-button';
import { SEOMeta } from '@/components/SEOMeta';

export default function AboutPage() {
  return (
    <PageTransition>
      <SEOMeta
        title="About 99 Care | Trusted Home Healthcare in Surat"
        description="Learn about 99 Care's mission to bring verified, compassionate healthcare to Surat homes. Meet our team and discover our commitment to quality care."
        canonical="https://99care.org/about"
      />
      <div className="w-full bg-slate-50/60 dark:bg-slate-950 min-h-screen pb-24">
        {/* SECTION 1 — HERO HEADER */}
        <section className="relative pt-32 pb-20 px-6 text-center bg-gradient-to-b from-blue-50/60 via-white to-slate-50/60 dark:from-slate-900 dark:via-slate-950 dark:to-slate-950 border-b border-gray-200/60 dark:border-slate-800 overflow-hidden">
          <div className="absolute top-10 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-brand-blue/5 blur-[120px] rounded-full pointer-events-none"></div>

          <div className="max-w-4xl mx-auto relative z-10">
            <AnimateOnScroll variants={{ hidden: { opacity: 0, y: -10 }, visible: { opacity: 1, y: 0, transition: { duration: 0.4 } } }}>
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white dark:bg-slate-900 border border-gray-200/80 dark:border-slate-800 text-xs text-gray-500 dark:text-gray-400 mb-6 shadow-sm">
                <Link to="/" className="hover:text-brand-blue transition-colors">Home</Link>
                <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
                <span className="text-brand-blue dark:text-teal-400 font-semibold">About Us</span>
              </div>
            </AnimateOnScroll>
            <AnimateOnScroll variants={fadeUp} delay={0.05}>
              <span className="inline-flex items-center gap-1.5 px-4 py-1 rounded-full bg-brand-blue/10 text-brand-blue dark:text-teal-400 text-xs font-bold uppercase tracking-wider mb-4">
                <Sparkles className="w-3.5 h-3.5" /> Our Story & Healthcare Mission
              </span>
            </AnimateOnScroll>
            <AnimateOnScroll variants={fadeUp} delay={0.1}>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-gray-900 dark:text-white mb-6 tracking-tight leading-tight">
                Caring for Surat, One Home at a Time
              </h1>
            </AnimateOnScroll>
            <AnimateOnScroll variants={fadeUp} delay={0.2}>
              <p className="text-lg sm:text-xl text-gray-600 dark:text-gray-300 font-light max-w-2xl mx-auto leading-relaxed">
                Bringing professional, compassionate, and personalized healthcare directly to your doorstep in Surat.
              </p>
            </AnimateOnScroll>
          </div>
        </section>

        {/* SECTION 2 — ABOUT INTRO */}
        <section className="py-20 bg-white dark:bg-slate-950 overflow-hidden border-b border-gray-100 dark:border-slate-800">
          <div className="container mx-auto px-6 max-w-7xl">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12 lg:gap-16 items-center">
              <AnimateOnScroll variants={slideLeft}>
                <div className="bg-slate-50/80 dark:bg-slate-900/60 p-8 sm:p-10 rounded-3xl border border-gray-200/80 dark:border-slate-800 shadow-sm">
                  <span className="text-brand-blue text-xs font-bold uppercase tracking-[0.2em] mb-3 block">Surat's Premier Healthcare Partner</span>
                  <h2 className="text-3xl font-extrabold text-gray-900 dark:text-white mb-6 tracking-tight">Welcome to 99 Care</h2>
                  <p className="text-gray-600 dark:text-gray-300 mb-6 leading-relaxed font-light text-base sm:text-lg">
                    We understand that home is where healing happens best. That's why we bring expert medical care directly to you. Our team of certified nurses, experienced caretakers, and trained medical professionals are passionate about improving your quality of life without the stress of hospital visits.
                  </p>
                  <p className="text-gray-600 dark:text-gray-300 mb-8 leading-relaxed font-light text-base">
                    Founded in Surat, Gujarat, we have built our reputation on trust, reliability, and an unwavering commitment to patient well-being.
                  </p>
                  
                  <div className="space-y-3.5 pt-4 border-t border-gray-200/60 dark:border-slate-800">
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                      <span className="text-gray-800 dark:text-gray-200 font-medium text-sm sm:text-base">Certified & Experienced Medical Staff</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                      <span className="text-gray-800 dark:text-gray-200 font-medium text-sm sm:text-base">Personalized Care Plans Tailored to Patients</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                      <span className="text-gray-800 dark:text-gray-200 font-medium text-sm sm:text-base">24/7 Dedicated Assistance and Monitoring</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                      <span className="text-gray-800 dark:text-gray-200 font-medium text-sm sm:text-base">Thorough Background Verification on Every Staff Member</span>
                    </div>
                  </div>
                </div>
              </AnimateOnScroll>
              
              <AnimateOnScroll variants={slideRight} delay={0.2} className="relative">
                <div className="p-3 bg-white dark:bg-slate-900 rounded-3xl border border-gray-200/80 dark:border-slate-800 shadow-md">
                  <div className="aspect-[4/3] rounded-2xl overflow-hidden bg-slate-100 dark:bg-slate-800">
                    <img 
                      src="/images/about-us.jpg" 
                      alt="99 Care Team"
                      className="w-full h-full object-cover object-top transition-transform duration-500 hover:scale-105"
                    />
                  </div>
                </div>
                <div className="mt-4 text-center">
                  <span className="text-xs text-gray-500 dark:text-gray-400 italic">Delivering healthcare with compassion in Surat</span>
                </div>
              </AnimateOnScroll>
            </div>
          </div>
        </section>

        {/* SECTION 3 — OUR STORY */}
        <section className="py-20 bg-slate-50/60 dark:bg-slate-950 border-b border-gray-200/60 dark:border-slate-800">
          <div className="container mx-auto px-6 max-w-4xl text-center">
            <div className="bg-white dark:bg-slate-900 p-8 sm:p-14 rounded-3xl border border-gray-200/80 dark:border-slate-800 shadow-sm text-left space-y-8">
              <div className="text-center">
                <span className="text-brand-blue text-xs font-bold uppercase tracking-[0.2em] mb-2 block">Founding Journey</span>
                <h2 className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">Our Story</h2>
              </div>
              
              <div className="space-y-6 text-gray-600 dark:text-gray-300 leading-relaxed text-base sm:text-lg font-light">
                <p className="first-letter:text-4xl first-letter:font-bold first-letter:text-brand-blue first-letter:mr-2 first-letter:float-left">
                  99Care was founded with a strong desire to redefine the manner in which care services are delivered in order to give high-quality, professional, and personalized care directly to our patients' homes. It started out from a simple idea: healing happens best in the comfort of one's own space. Since our establishment, we have been working extensively with an objective to cater to all the specific needs of families and people with reliable healthcare solutions.
                </p>
                
                <h3 className="text-xl font-bold text-gray-900 dark:text-white pt-4 border-t border-gray-100 dark:border-slate-800">Expanding with Intention</h3>
                <p>
                  By expanding the business from basic caring to comprehensive medical support comprising nursing, wound care, post-surgical care, and specialized caretaker support, we have developed remarkably over the years. This growth stems from an approach toward excellence, wherein every care provider we recruit is meticulously evaluated and rigorously trained to render compassionate care.
                </p>
                
                <h3 className="text-xl font-bold text-gray-900 dark:text-white pt-4 border-t border-gray-100 dark:border-slate-800">Bringing About Change</h3>
                <p>
                  With pride, 99Care serves as a reliable healthcare partner for multiple families today. Continuing into the future, we still hold tight to our core values, innovating and raising the bar for home health services across Surat.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 4 — MISSION & VISION */}
        <section className="py-20 bg-white dark:bg-slate-950 border-b border-gray-200/60 dark:border-slate-800">
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
                  whileHover={{ y: -6, boxShadow: '0 20px 40px rgba(27, 108, 168, 0.12)' }}
                  transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                  className="bg-slate-50/80 dark:bg-slate-900 p-10 md:p-12 rounded-3xl border border-gray-200/80 dark:border-slate-800 h-full transition-all shadow-sm"
                >
                  <div className="w-14 h-14 bg-brand-blue/10 dark:bg-slate-800 rounded-2xl flex items-center justify-center mb-8 text-brand-blue">
                    <HandHeart className="w-7 h-7" />
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Our Mission</h3>
                  <p className="text-gray-600 dark:text-gray-300 leading-relaxed font-light">
                    To create a seamless and compassionate healthcare experience at home, assuring patients of dignity and prompt care while offering peace of mind to their families through a team that is well-prepared and genuinely empathetic.
                  </p>
                </motion.div>
              </motion.div>

              {/* Vision Card */}
              <motion.div variants={staggerItem}>
                <motion.div 
                  whileHover={{ y: -6, boxShadow: '0 20px 40px rgba(27, 108, 168, 0.12)' }}
                  transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                  className="bg-slate-50/80 dark:bg-slate-900 p-10 md:p-12 rounded-3xl border border-gray-200/80 dark:border-slate-800 h-full transition-all shadow-sm"
                >
                  <div className="w-14 h-14 bg-emerald-500/10 dark:bg-slate-800 rounded-2xl flex items-center justify-center mb-8 text-emerald-600">
                    <Eye className="w-7 h-7" />
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Our Vision</h3>
                  <p className="text-gray-600 dark:text-gray-300 leading-relaxed font-light">
                    To be the most trusted and preferred partner for home healthcare in Surat, setting new benchmarks for quality, reliability, and compassion in every aspect of personalized recovery and wellness.
                  </p>
                </motion.div>
              </motion.div>
            </motion.div>
          </div>
        </section>

        {/* SECTION 5 — VALUES */}
        <section className="py-20 bg-slate-50/60 dark:bg-slate-950">
          <div className="container mx-auto px-6 max-w-6xl">
            <AnimateOnScroll variants={fadeUp} className="text-center mb-16">
              <span className="text-brand-blue text-xs font-bold uppercase tracking-[0.2em] mb-3 block">What Drives Us</span>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 dark:text-white tracking-tight">Our Core Values</h2>
            </AnimateOnScroll>

            <motion.div 
              variants={staggerContainer} 
              initial="hidden" 
              whileInView="visible" 
              viewport={{ once: true, margin: '-80px' }}
              className="grid grid-cols-1 sm:grid-cols-2 gap-8"
            >
              <motion.div variants={staggerItem} className="p-8 bg-white dark:bg-slate-900 rounded-3xl border border-gray-200/80 dark:border-slate-800 shadow-sm flex gap-6 group hover:border-brand-blue/30 transition-colors">
                <div className="w-12 h-12 bg-brand-blue/10 rounded-2xl flex items-center justify-center text-brand-blue flex-shrink-0">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Integrity</h3>
                  <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed font-light">We operate with complete transparency and honesty in all our patient interactions, building lasting relationships founded on moral principles.</p>
                </div>
              </motion.div>

              <motion.div variants={staggerItem} className="p-8 bg-white dark:bg-slate-900 rounded-3xl border border-gray-200/80 dark:border-slate-800 shadow-sm flex gap-6 group hover:border-brand-blue/30 transition-colors">
                <div className="w-12 h-12 bg-brand-blue/10 rounded-2xl flex items-center justify-center text-brand-blue flex-shrink-0">
                  <HeartHandshake className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Compassion</h3>
                  <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed font-light">We provide care that goes beyond medical needs, treating every patient with the empathy, respect, and warmth they deserve.</p>
                </div>
              </motion.div>

              <motion.div variants={staggerItem} className="p-8 bg-white dark:bg-slate-900 rounded-3xl border border-gray-200/80 dark:border-slate-800 shadow-sm flex gap-6 group hover:border-brand-blue/30 transition-colors">
                <div className="w-12 h-12 bg-emerald-500/10 rounded-2xl flex items-center justify-center text-emerald-600 flex-shrink-0">
                  <Award className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Excellence</h3>
                  <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed font-light">We are committed to delivering the highest clinical standards through rigorous training, continuous improvement, and professional execution.</p>
                </div>
              </motion.div>

              <motion.div variants={staggerItem} className="p-8 bg-white dark:bg-slate-900 rounded-3xl border border-gray-200/80 dark:border-slate-800 shadow-sm flex gap-6 group hover:border-brand-blue/30 transition-colors">
                <div className="w-12 h-12 bg-amber-500/10 rounded-2xl flex items-center justify-center text-amber-500 flex-shrink-0">
                  <Star className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Trust</h3>
                  <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed font-light">We understand we are entering your home. Every member of our team is carefully vetted to ensure your complete safety and peace of mind.</p>
                </div>
              </motion.div>
            </motion.div>
          </div>
        </section>

        {/* SECTION 6 — BOOKING CTA */}
        <section className="py-20 bg-brand-blue text-center px-6 overflow-hidden rounded-3xl max-w-7xl mx-auto shadow-xl">
          <AnimateOnScroll variants={{ hidden: { opacity: 0, scale: 0.95 }, visible: { opacity: 1, scale: 1, transition: { duration: 0.5 } } }} className="max-w-2xl mx-auto flex flex-col items-center">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-white mb-6">Ready to Experience Better Care?</h2>
            <p className="text-white/90 text-base sm:text-lg mb-10 font-light max-w-lg leading-relaxed">
              Schedule a consultation today and let our verified team care for your family in Surat.
            </p>
            <motion.div
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              transition={{ type: 'spring', stiffness: 400, damping: 20 }}
            >
              <GradientButton size="lg" asChild>
                <Link to="/appointment">
                  Book Appointment Now
                </Link>
              </GradientButton>
            </motion.div>
          </AnimateOnScroll>
        </section>
      </div>
    </PageTransition>
  );
}
