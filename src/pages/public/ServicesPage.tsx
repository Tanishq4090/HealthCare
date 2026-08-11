import { Link } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { services } from '@/data/services';
import * as Icons from 'lucide-react';
import { motion } from 'framer-motion';
import { PageTransition } from '@/components/PageTransition';
import { AnimateOnScroll } from '@/components/AnimateOnScroll';
import { fadeUp, staggerContainer, staggerItem } from '@/lib/animations';
import { SEOMeta } from '@/components/SEOMeta';

export default function ServicesPage() {
  const nursingServices = services.filter(s => s.slug.includes('nursing') || s.slug.includes('wound') || s.slug.includes('injection') || s.slug.includes('respiratory'));
  const caretakerServices = services.filter(s => !nursingServices.includes(s));

  const renderIcon = (iconName: string) => {
    const iconMap: Record<string, any> = {
      'bandage': Icons.HeartHandshake,
      'lungs': Icons.Activity,
      'syringe': Icons.Syringe,
      'stethoscope': Icons.Stethoscope,
      'heart': Icons.HeartHandshake,
      'baby': Icons.Baby,
      'users': Icons.Users
    };
    const IconComponent = iconMap[iconName] || Icons.ShieldCheck;
    return <IconComponent className="w-5 h-5 text-brand-blue" />;
  };

  const renderServiceCard = (service: typeof services[0]) => (
    <motion.div key={service.slug} variants={staggerItem}>
      <Link to={`/services/${service.slug}`} className="block h-full">
        <motion.div
          whileHover={{ y: -6, boxShadow: '0 20px 40px rgba(27, 108, 168, 0.12)' }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          className="bg-white dark:bg-slate-900 rounded-3xl border border-gray-200/80 dark:border-slate-800 transition-all duration-300 group text-left flex flex-col h-full cursor-pointer overflow-hidden shadow-sm hover:shadow-md"
        >
          <div className="aspect-[16/10] w-full bg-slate-100 dark:bg-slate-800 overflow-hidden border-b border-gray-100 dark:border-slate-800 relative">
            <img 
              src={service.image} 
              alt={service.title}
              className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-500"
            />
            <div className="absolute top-3 left-3 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm p-2 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800">
              {renderIcon(service.icon)}
            </div>
          </div>

          <div className="p-7 flex flex-col flex-1">
            <span className="text-[10px] font-bold text-brand-blue uppercase tracking-widest mb-3 bg-brand-blue/10 dark:bg-slate-800 px-3 py-1 rounded-full w-fit">
              {service.category === 'nursing' ? 'Nursing Service' : 'Caretaker Service'}
            </span>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2 group-hover:text-brand-blue transition-colors">
              {service.title}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 leading-relaxed flex-1">
              {service.shortDesc}
            </p>
            <div className="text-brand-blue text-sm font-semibold flex items-center gap-1 group-hover:gap-2 transition-all mt-auto pt-4 border-t border-gray-100 dark:border-slate-800">
              <span>Explore Service</span>
              <Icons.ArrowRight className="w-4 h-4" />
            </div>
          </div>
        </motion.div>
      </Link>
    </motion.div>
  );

  return (
    <PageTransition>
      <SEOMeta
        title="Home Healthcare Services in Surat | 99 Care"
        description="Browse all home healthcare services: nursing, wound care, injection at home, maternity care, newborn care, old age care, and caretaker services in Surat."
        canonical="https://99care.org/services"
      />
      <div className="w-full bg-slate-50/60 dark:bg-slate-950 pb-32 min-h-screen">
        {/* SECTION 1 — HERO */}
        <section className="relative pt-32 pb-20 px-6 text-center bg-gradient-to-b from-blue-50/60 via-white to-slate-50/60 dark:from-slate-900 dark:via-slate-950 dark:to-slate-950 border-b border-gray-200/60 dark:border-slate-800 overflow-hidden">
          <div className="absolute top-10 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-brand-blue/5 blur-[120px] rounded-full pointer-events-none"></div>

          <div className="max-w-4xl mx-auto relative z-10">
            <AnimateOnScroll variants={{ hidden: { opacity: 0, y: -10 }, visible: { opacity: 1, y: 0, transition: { duration: 0.4 } } }}>
              <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-brand-blue/10 text-brand-blue dark:text-teal-400 text-xs font-bold uppercase tracking-wider mb-4">
                <Icons.Sparkles className="w-3.5 h-3.5" /> What We Offer
              </span>
            </AnimateOnScroll>
            <AnimateOnScroll variants={fadeUp} delay={0.1}>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-gray-900 dark:text-white mb-6 tracking-tight leading-tight">
                Surat's Premier Home Care Services
              </h1>
            </AnimateOnScroll>
            <AnimateOnScroll variants={fadeUp} delay={0.2}>
              <p className="text-lg sm:text-xl text-gray-600 dark:text-gray-300 font-light max-w-2xl mx-auto leading-relaxed">
                Comprehensive, verified, and compassionate healthcare delivered directly to your doorstep in Surat.
              </p>
            </AnimateOnScroll>
          </div>
        </section>

      {/* SECTION 2 — SERVICES TABS */}
      <section className="pt-16 px-6">
        <div className="container mx-auto max-w-7xl">
          <Tabs defaultValue="all" className="w-full flex flex-col items-center">
            
            <TabsList className="bg-white dark:bg-slate-900 border border-gray-200/80 dark:border-slate-800 rounded-2xl p-1.5 mb-14 shadow-sm inline-flex justify-center gap-2">
              <TabsTrigger 
                value="all" 
                className="rounded-xl px-6 py-3 text-sm font-bold text-gray-600 dark:text-gray-300 data-[state=active]:bg-brand-blue data-[state=active]:text-white data-[state=active]:shadow-md transition-all"
              >
                All Services ({services.length})
              </TabsTrigger>
              <TabsTrigger 
                value="nursing" 
                className="rounded-xl px-6 py-3 text-sm font-bold text-gray-600 dark:text-gray-300 data-[state=active]:bg-brand-blue data-[state=active]:text-white data-[state=active]:shadow-md transition-all"
              >
                Nursing Services ({nursingServices.length})
              </TabsTrigger>
              <TabsTrigger 
                value="caretaker" 
                className="rounded-xl px-6 py-3 text-sm font-bold text-gray-600 dark:text-gray-300 data-[state=active]:bg-brand-blue data-[state=active]:text-white data-[state=active]:shadow-md transition-all"
              >
                Caretaker Services ({caretakerServices.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="all" className="w-full animate-in fade-in slide-in-from-bottom-4 duration-500">
              <motion.div 
                variants={staggerContainer} 
                initial="hidden" 
                animate="visible" 
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8"
              >
                {services.map(renderServiceCard)}
              </motion.div>
            </TabsContent>

            <TabsContent value="nursing" className="w-full animate-in fade-in slide-in-from-bottom-4 duration-500">
              <motion.div 
                variants={staggerContainer} 
                initial="hidden" 
                animate="visible" 
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8"
              >
                {nursingServices.map(renderServiceCard)}
              </motion.div>
            </TabsContent>

            <TabsContent value="caretaker" className="w-full animate-in fade-in slide-in-from-bottom-4 duration-500">
              <motion.div 
                variants={staggerContainer} 
                initial="hidden" 
                animate="visible" 
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8"
              >
                {caretakerServices.map(renderServiceCard)}
              </motion.div>
            </TabsContent>

          </Tabs>
        </div>
      </section>
    </div>
    </PageTransition>
  );
}
