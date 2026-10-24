import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Star, CheckCircle2, HeartHandshake, ShieldCheck, Sparkles, MessageSquareHeart } from 'lucide-react';
import { motion } from 'framer-motion';
import { PageTransition } from '@/components/PageTransition';
import { AnimateOnScroll } from '@/components/AnimateOnScroll';
import { fadeUp, staggerContainer, staggerItem } from '@/lib/animations';
import { GradientButton } from '@/components/ui/gradient-button';
import { SEOMeta } from '@/components/SEOMeta';
import { BrandEmblem } from '@/components/ui/BrandEmblem';

interface Review {
  id: string;
  name: string;
  category: 'all' | 'nursing' | 'elderly' | 'baby';
  rating: number;
  date: string;
  avatarBg: string;
  avatarColor: string;
  service: string;
  text: string;
}

const REVIEWS: Review[] = [
  {
    id: '1',
    name: 'Pankaj Boricha',
    category: 'nursing',
    rating: 5,
    date: '1 month ago',
    avatarBg: 'bg-brand-blue/10',
    avatarColor: 'text-brand-blue',
    service: 'Sample Collection & Nursing',
    text: 'My name is pankaj. I had a very good experience at this 99 care service. the staff was polite person, helpful and professional. the sample collection process was quick and hygienic, and everything was well organized. i received my reports on time, and they were clear and easy to understand. The 99care is clean and well maintained. Overall, I am satisfied with their service and would recommend this 99care to others.'
  },
  {
    id: '2',
    name: 'Nayan Ghanghal',
    category: 'baby',
    rating: 5,
    date: '7 months ago',
    avatarBg: 'bg-brand-teal/10',
    avatarColor: 'text-brand-teal',
    service: 'Newborn & Baby Care',
    text: "99 Care's baby care service is excellent. I took the baby care service from 99 care, their service is very good, their time to time response is good and their follow up is also very good, their staff is also good and on duty time to time. thank you Falguni madam, your service is very good."
  },
  {
    id: '3',
    name: 'Rajesh Patel',
    category: 'elderly',
    rating: 5,
    date: '2 months ago',
    avatarBg: 'bg-emerald-500/10',
    avatarColor: 'text-emerald-600',
    service: 'Elderly Caretaker Support',
    text: 'Extremely satisfied with the home nursing care provided by 99 Care for my elderly father at home. The nurse was compassionate, punctual, and attentive to all his medical needs. Highly recommended for senior citizen care!'
  },
  {
    id: '4',
    name: 'Priya Sharma',
    category: 'baby',
    rating: 5,
    date: '3 months ago',
    avatarBg: 'bg-purple-500/10',
    avatarColor: 'text-purple-600',
    service: 'Post-Maternity & Japa Care',
    text: "We hired a caretaker from 99 Care for post-maternity and baby care. Falguni ma'am and her team provided exceptional service and support throughout the month. Reliable, respectful, and trustworthy!"
  },
  {
    id: '5',
    name: 'Ramesh Varma',
    category: 'nursing',
    rating: 5,
    date: '4 months ago',
    avatarBg: 'bg-amber-500/10',
    avatarColor: 'text-amber-600',
    service: 'Wound Care & Injections',
    text: 'Prompt and professional home injection and wound care service. The nursing staff maintains high hygiene standards, sterilizes equipment properly, and handles patients with great gentle care.'
  },
  {
    id: '6',
    name: 'Anita Desai',
    category: 'elderly',
    rating: 5,
    date: '5 months ago',
    avatarBg: 'bg-rose-500/10',
    avatarColor: 'text-rose-600',
    service: '24/7 Bedridden Patient Care',
    text: 'Best home healthcare service! Reliable, affordable, and trustworthy staff for senior citizen care and family medical needs. The staff was gentle and treated my mother like their own family.'
  },
  {
    id: '7',
    name: 'Hitesh Shah',
    category: 'nursing',
    rating: 5,
    date: '6 months ago',
    avatarBg: 'bg-sky-500/10',
    avatarColor: 'text-sky-600',
    service: 'Post-Operative Recovery',
    text: 'After my knee replacement surgery, 99 Care arranged an experienced male attendant on short notice. He assisted with dressing changes, daily movement, and vital signs monitoring. Excellent communication and peace of mind.'
  },
  {
    id: '8',
    name: 'Meena Kothari',
    category: 'elderly',
    rating: 5,
    date: '8 months ago',
    avatarBg: 'bg-indigo-500/10',
    avatarColor: 'text-indigo-600',
    service: 'Senior Companion & Care',
    text: 'We are very grateful to the 99 Care team for their caring support for my mother-in-law. Prompt coordination by the office and polite, well-mannered staff at home. We highly recommend them.'
  }
];

export default function ReviewsPage() {
  const [filter, setFilter] = useState<'all' | 'nursing' | 'elderly' | 'baby'>('all');

  const filteredReviews = filter === 'all' 
    ? REVIEWS 
    : REVIEWS.filter(r => r.category === filter);

  return (
    <PageTransition>
      <SEOMeta
        title="Patient Reviews & Ratings | 99 Care Home Healthcare"
        description="Read authentic, verified Google reviews and testimonials from families who trust 99 Care for professional home nursing, elderly care, and baby care services."
        canonical="https://99care.org/reviews"
      />
      <div className="w-full bg-slate-50/60 dark:bg-slate-950 min-h-screen pb-32">
        {/* SECTION 1 — HERO HEADER */}
        <section className="relative pt-32 pb-20 px-6 text-center bg-gradient-to-b from-blue-50/60 via-white to-slate-50/60 dark:from-slate-900 dark:via-slate-950 dark:to-slate-950 border-b border-gray-200/60 dark:border-slate-800 overflow-hidden">
          <div className="absolute top-10 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-brand-blue/5 blur-[120px] rounded-full pointer-events-none"></div>

          <div className="max-w-4xl mx-auto relative z-10">
            <AnimateOnScroll variants={{ hidden: { opacity: 0, y: -10 }, visible: { opacity: 1, y: 0, transition: { duration: 0.4 } } }}>
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white dark:bg-slate-900 border border-gray-200/80 dark:border-slate-800 text-xs text-gray-500 dark:text-gray-400 mb-6 shadow-sm">
                <Link to="/" className="hover:text-brand-blue transition-colors">Home</Link>
                <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
                <span className="text-brand-blue dark:text-teal-400 font-semibold">Reviews</span>
              </div>
            </AnimateOnScroll>
            
            <AnimateOnScroll variants={fadeUp} delay={0.05}>
              <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-brand-blue/10 text-brand-blue dark:text-teal-400 text-xs font-bold uppercase tracking-wider mb-4">
                <Sparkles className="w-4 h-4" /> Verified Patient Feedback
              </span>
            </AnimateOnScroll>

            <AnimateOnScroll variants={fadeUp} delay={0.1}>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-gray-900 dark:text-white mb-6 tracking-tight leading-tight">
                What Families Say About 99 Care
              </h1>
            </AnimateOnScroll>

            <AnimateOnScroll variants={fadeUp} delay={0.2}>
              <p className="text-lg sm:text-xl text-gray-600 dark:text-gray-300 font-light max-w-2xl mx-auto leading-relaxed mb-8">
                Read authentic, verified experiences from families and patients who have experienced our compassionate home healthcare and nursing services.
              </p>
            </AnimateOnScroll>

            {/* Google Rating Summary Card */}
            <AnimateOnScroll variants={fadeUp} delay={0.3}>
              <div className="inline-flex flex-col sm:flex-row items-center gap-4 sm:gap-6 bg-white dark:bg-slate-900 px-6 py-4 rounded-3xl border border-gray-200/80 dark:border-slate-800 shadow-md">
                <div className="flex items-center gap-3">
                  <svg viewBox="0 0 48 48" className="w-8 h-8" xmlns="http://www.w3.org/2000/svg">
                    <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"/>
                    <path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"/>
                    <path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"/>
                    <path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z"/>
                  </svg>
                  <div className="text-left">
                    <div className="flex items-center gap-1.5">
                      <span className="text-2xl font-extrabold text-gray-900 dark:text-white">4.9</span>
                      <div className="flex">
                        {[...Array(5)].map((_, i) => (
                          <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
                        ))}
                      </div>
                    </div>
                    <span className="text-xs text-gray-400 font-medium">Google Customer Reviews</span>
                  </div>
                </div>

                <div className="hidden sm:block w-px h-8 bg-gray-200 dark:bg-slate-700"></div>

                <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 font-medium">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  <span>500+ Happy Families Served</span>
                </div>
              </div>
            </AnimateOnScroll>
          </div>
        </section>

        {/* SECTION 2 — FILTER TABS & REVIEWS GRID */}
        <section className="pt-16 px-6">
          <div className="container mx-auto max-w-7xl">
            {/* Filter Buttons */}
            <div className="flex justify-center flex-wrap gap-2 mb-12">
              {[
                { key: 'all', label: 'All Reviews' },
                { key: 'nursing', label: 'Nursing & Medical' },
                { key: 'elderly', label: 'Elderly Care' },
                { key: 'baby', label: 'Baby & Maternity' },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setFilter(tab.key as any)}
                  className={`px-5 py-2.5 rounded-full text-sm font-semibold transition-all ${
                    filter === tab.key
                      ? 'bg-brand-blue text-white shadow-md'
                      : 'bg-white dark:bg-slate-900 text-gray-600 dark:text-gray-300 border border-gray-200/80 dark:border-slate-800 hover:border-brand-blue/30'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Reviews Cards Grid */}
            <motion.div
              variants={staggerContainer}
              initial="hidden"
              animate="visible"
              key={filter}
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
            >
              {filteredReviews.map((review) => (
                <motion.div
                  key={review.id}
                  variants={staggerItem}
                  className="bg-white dark:bg-slate-900 rounded-3xl p-8 border border-gray-200/80 dark:border-slate-800 shadow-sm hover:shadow-lg transition-all duration-300 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center gap-4 mb-5">
                      <div className={`w-12 h-12 rounded-2xl ${review.avatarBg} flex items-center justify-center ${review.avatarColor} font-bold text-lg`}>
                        {review.name.charAt(0)}
                      </div>
                      <div className="flex-1">
                        <h4 className="font-bold text-gray-900 dark:text-white text-base">{review.name}</h4>
                        <div className="flex items-center gap-2">
                          <div className="flex gap-0.5">
                            {[...Array(review.rating)].map((_, i) => (
                              <Star key={i} className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                            ))}
                          </div>
                          <span className="text-xs text-gray-400">• {review.date}</span>
                        </div>
                      </div>
                      <div className="ml-auto">
                        <svg viewBox="0 0 48 48" className="w-5 h-5 opacity-90" xmlns="http://www.w3.org/2000/svg">
                          <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"/>
                          <path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"/>
                          <path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"/>
                          <path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z"/>
                        </svg>
                      </div>
                    </div>

                    <div className="inline-block px-3 py-1 bg-slate-100 dark:bg-slate-800/80 rounded-lg text-xs font-semibold text-brand-blue mb-4">
                      {review.service}
                    </div>

                    <p className="text-gray-600 dark:text-gray-300 text-sm leading-relaxed font-light">
                      "{review.text}"
                    </p>
                  </div>

                  <div className="pt-6 mt-6 border-t border-gray-100 dark:border-slate-800/60 flex items-center justify-between text-xs text-gray-400">
                    <span className="flex items-center gap-1.5 text-emerald-600 font-medium">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Verified Patient
                    </span>
                    <span>Google Review</span>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* SECTION 3 — CTA */}
        <section className="py-20 mt-16 bg-brand-blue text-center px-6 overflow-hidden rounded-3xl max-w-7xl mx-auto shadow-xl">
          <AnimateOnScroll variants={{ hidden: { opacity: 0, scale: 0.95 }, visible: { opacity: 1, scale: 1, transition: { duration: 0.5 } } }} className="max-w-2xl mx-auto flex flex-col items-center">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-white mb-6">Experience Award-Winning Care</h2>
            <p className="text-white/90 text-base sm:text-lg mb-10 font-light max-w-lg leading-relaxed">
              Join hundreds of happy families who trust 99 Care for their loved ones.
            </p>
            <motion.div
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              transition={{ type: 'spring', stiffness: 400, damping: 20 }}
            >
              <GradientButton size="lg" asChild>
                <Link to="/appointment">
                  Book Care Now
                </Link>
              </GradientButton>
            </motion.div>
          </AnimateOnScroll>
        </section>
      </div>
    </PageTransition>
  );
}
