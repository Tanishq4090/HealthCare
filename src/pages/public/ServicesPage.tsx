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
  const nursingServices = services.filter(s => s.category === 'nursing');
  const caretakerServices = services.filter(s => s.category === 'caretaker');

  const renderIcon = (iconName: string) => {
    // Map string names to Lucide icons dynamically or manually
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
    return <IconComponent className="w-6 h-6" />;
  };

  const renderServiceCard = (service: typeof services[0]) => (
    <motion.div key={service.slug} variants={staggerItem}>
      <Link to={`/services/${service.slug}`} className="block h-full">
        <motion.div
          whileHover={{ y: -6, boxShadow: '0 20px 40px rgba(27, 108, 168, 0.10)' }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          className="bg-white dark:bg-slate-900 p-8 rounded-2xl border border-gray-100 dark:border-slate-800 transition-all duration-300 group text-left flex flex-col h-full cursor-pointer"
        >
          <div className="aspect-video w-full bg-gray-50 dark:bg-slate-800 rounded-xl overflow-hidden mb-6 border border-gray-100 dark:border-slate-700">
            <img 
              src={service.image} 
              alt={service.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
          </div>
          <div className="w-10 h-10 bg-brand-blue-light dark:bg-slate-800 rounded-xl flex items-center justify-center mb-4 text-brand-blue">
            {renderIcon(service.icon)}
          </div>
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">{service.title}</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-8 leading-relaxed flex-1">{service.shortDesc}</p>
          <div className="text-brand-blue text-sm font-semibold flex items-center gap-1 group-hover:gap-2 transition-all mt-auto w-fit">
            <motion.span whileHover={{ x: 4 }} transition={{ duration: 0.2 }} className="flex items-center gap-1">Learn more <Icons.ChevronRight className="w-4 h-4" /></motion.span>
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
      <div className="w-full bg-white dark:bg-slate-950 pb-32">
        {/* SECTION 1 — HERO */}
        <section className="pt-32 pb-16 px-6 text-center border-b border-gray-100 dark:border-slate-800">
          <div className="max-w-3xl mx-auto">
            <AnimateOnScroll variants={{ hidden: { opacity: 0 }, visible: { opacity: 1, transition: { duration: 0.5 } } }}>
              <span className="text-brand-blue text-xs font-bold uppercase tracking-[0.2em] mb-4 block">What We Offer</span>
            </AnimateOnScroll>
            <AnimateOnScroll variants={fadeUp} delay={0.1}>
              <h1 className="text-4xl md:text-5xl font-extrabold text-gray-900 dark:text-white mb-6 tracking-tight">
                Our Services
              </h1>
            </AnimateOnScroll>
            <AnimateOnScroll variants={fadeUp} delay={0.2}>
              <p className="text-lg text-gray-500 dark:text-gray-400 font-light max-w-2xl mx-auto">
                Comprehensive, professional healthcare delivered directly to your home in Surat.
              </p>
            </AnimateOnScroll>
          </div>
        </section>

      {/* SECTION 2 — SERVICES TABS */}
      <section className="pt-16 px-6">
        <div className="container mx-auto max-w-7xl">
          <Tabs defaultValue="nursing" className="w-full flex flex-col items-center">
            
            <TabsList className="bg-transparent border-b border-gray-200 dark:border-slate-800 w-full max-w-2xl justify-center h-auto p-0 mb-12">
              <TabsTrigger 
                value="nursing" 
                className="rounded-none border border-transparent border-b-0 data-[state=active]:border-brand-blue data-[state=active]:border-x-gray-200 data-[state=active]:border-t-gray-200 data-[state=active]:dark:border-x-slate-700 data-[state=active]:dark:border-t-slate-700 gradient-button gradient-button-neutral data-[state=active]:shadow-md px-8 py-4 text-base text-gray-600 dark:text-brand-blue data-[state=active]:text-brand-blue data-[state=active]:font-bold font-semibold transition-all opacity-80 data-[state=active]:opacity-100 hover:opacity-100"
              >
                Nursing Services
              </TabsTrigger>
              <TabsTrigger 
                value="caretaker" 
                className="rounded-none border border-transparent border-b-0 data-[state=active]:border-brand-blue data-[state=active]:border-x-gray-200 data-[state=active]:border-t-gray-200 data-[state=active]:dark:border-x-slate-700 data-[state=active]:dark:border-t-slate-700 gradient-button gradient-button-neutral data-[state=active]:shadow-md px-8 py-4 text-base text-gray-600 dark:text-brand-blue data-[state=active]:text-brand-blue data-[state=active]:font-bold font-semibold transition-all opacity-80 data-[state=active]:opacity-100 hover:opacity-100"
              >
                Caretaker Services
              </TabsTrigger>
            </TabsList>

            <TabsContent value="nursing" className="w-full animate-in fade-in slide-in-from-bottom-4 duration-500">
              <motion.div 
                variants={staggerContainer} 
                initial="hidden" 
                animate="visible" 
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6"
              >
                {nursingServices.map(renderServiceCard)}
              </motion.div>
            </TabsContent>

            <TabsContent value="caretaker" className="w-full animate-in fade-in slide-in-from-bottom-4 duration-500">
              <motion.div 
                variants={staggerContainer} 
                initial="hidden" 
                animate="visible" 
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto"
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
