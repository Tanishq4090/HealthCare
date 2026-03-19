import { useState, useMemo } from 'react';
import { NavLink, Link } from 'react-router-dom';
import { Menu, Home, User, HeartPulse, FileText, Phone, Circle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { useScroll, useMotionValueEvent, motion } from 'framer-motion';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { GradientButton } from '@/components/ui/gradient-button';
import { TubelightNavbar } from '@/components/ui/tubelight-navbar';

const SERVICES = [
  { name: 'Wound Care', path: '/services/wound-care' },
  { name: 'Respiratory Care', path: '/services/respiratory-care-at-home' },
  { name: 'Injection at Home', path: '/services/injection-at-home' },
  { name: 'Nursing On-Demand', path: '/services/nursing-services-on-demand' },
  { name: 'Maternity Care', path: '/services/maternity-care' },
  { name: 'Newborn Baby Care', path: '/services/new-born-baby-care' },
  { name: 'Old Age Person Care', path: '/services/old-age-person-care' },
];

export default function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const { scrollY } = useScroll();

  useMotionValueEvent(scrollY, "change", (latest) => {
    setIsScrolled(latest > 20);
  });

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      'relative text-sm font-medium transition-colors duration-200 py-2',
      isActive ? 'text-brand-blue font-semibold' : 'text-gray-600 dark:text-gray-400 hover:text-brand-blue dark:hover:text-brand-blue',
      // Active underline indicator
      isActive && 'after:absolute after:bottom-0 after:left-0 after:h-[2px] after:w-full after:bg-brand-blue after:rounded-t-md'
    );

  // Services dropdown panel, passed as JSX to TubelightNavbar
  const servicesDropdown = (
    <div className="bg-white dark:bg-slate-900 rounded-xl shadow-lg border border-gray-100 dark:border-slate-800 overflow-hidden py-2 mt-2 ml-[-0.5rem]">
      {SERVICES.map((srv, idx) => (
        <Link 
          key={idx} 
          to={srv.path}
          className="flex items-center gap-3 px-5 py-3 text-sm text-gray-600 dark:text-gray-400 hover:text-brand-blue dark:hover:text-brand-blue hover:bg-brand-blue/5 dark:hover:bg-brand-blue/10 transition-colors"
        >
          <Circle className="w-1.5 h-1.5 fill-brand-blue text-brand-blue flex-shrink-0" />
          {srv.name}
        </Link>
      ))}
    </div>
  );

  const navItems = useMemo(() => [
    { name: 'Home', url: '/', icon: Home },
    { name: 'About', url: '/about', icon: User },
    { name: 'Services', url: '/services', icon: HeartPulse, dropdown: servicesDropdown },
    { name: 'Blog', url: '/blog', icon: FileText },
    { name: 'Contact', url: '/contact', icon: Phone }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], []);

  return (
    <nav
      className={cn(
        'sticky top-0 z-50 w-full bg-white dark:bg-slate-950 transition-all duration-300 border-b border-[#E5E7EB] dark:border-slate-800',
        isScrolled ? 'shadow-sm' : 'shadow-none'
      )}
    >
      <div className="container mx-auto px-6 lg:px-8">
        <div className="flex items-center justify-between h-[72px] lg:h-[88px]">
          
          {/* LEFT: Logo - Shifted towards center */}
          <Link to="/" className="flex-shrink-0 ml-4 lg:ml-20" onClick={() => setIsOpen(false)}>
            <motion.img 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              whileHover={{ scale: 1.05 }}
              transition={{ type: 'spring', stiffness: 400, damping: 20 }}
              src="/99care-logo.svg" 
              alt="99 Care Logo" 
              className="h-[52px] lg:h-[68px] w-auto drop-shadow-[0_4px_12px_rgba(26,166,168,0.25)] dark:drop-shadow-[0_4px_12px_rgba(255,255,255,0.1)]" 
            />
          </Link>

          {/* CENTER: Desktop Navigation (Tubelight Navbar) */}
          <div className="hidden lg:flex items-center justify-center flex-1">
            <TubelightNavbar items={navItems} />
          </div>

          {/* RIGHT: Book Now Button (Desktop) */}
          <div className="hidden lg:flex items-center gap-4">
            <ThemeToggle />
            <GradientButton asChild>
              <Link to="/appointment">
                Book Now
              </Link>
            </GradientButton>
          </div>

          {/* MOBILE: Hamburger & Sheet */}
          <div className="lg:hidden flex items-center gap-2">
            <ThemeToggle />
            <Sheet open={isOpen} onOpenChange={setIsOpen}>
              <SheetTrigger asChild>
                <button className="text-gray-600 hover:text-brand-blue p-2 transition-colors">
                  <Menu className="w-6 h-6" />
                </button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[300px] sm:w-[350px] bg-white dark:bg-slate-950 border-gray-100 dark:border-slate-800 pt-16 flex flex-col">
                <div className="flex flex-col space-y-4">
                  <NavLink to="/" onClick={() => setIsOpen(false)} className={navLinkClass}>Home</NavLink>
                  <NavLink to="/about" onClick={() => setIsOpen(false)} className={navLinkClass}>About</NavLink>
                  <NavLink to="/services" onClick={() => setIsOpen(false)} className={navLinkClass}>Services</NavLink>
                  {/* Subtle indent for mobile services */}
                  <div className="pl-4 flex flex-col space-y-3 pb-2 border-b border-gray-50 dark:border-slate-800">
                    {SERVICES.slice(0, 4).map((srv, idx) => (
                       <Link 
                         key={idx} 
                         to={srv.path}
                         onClick={() => setIsOpen(false)}
                         className="text-sm text-gray-500 hover:text-brand-blue"
                       >
                         {srv.name}
                       </Link>
                    ))}
                    <Link to="/services" onClick={() => setIsOpen(false)} className="text-xs text-brand-blue font-medium mt-1">View all services &rarr;</Link>
                  </div>
                  <NavLink to="/blog" onClick={() => setIsOpen(false)} className={navLinkClass}>Blog</NavLink>
                  <NavLink to="/contact" onClick={() => setIsOpen(false)} className={navLinkClass}>Contact</NavLink>
                </div>
                
                <div className="pl-4 flex flex-col space-y-3 pb-2 border-b border-gray-50 dark:border-slate-900">
                  <GradientButton asChild className="w-full">
                    <Link 
                      to="/appointment" 
                      onClick={() => setIsOpen(false)}
                    >
                      Book Appointment Now
                    </Link>
                  </GradientButton>
                </div>
              </SheetContent>
            </Sheet>
          </div>
          
        </div>
      </div>
    </nav>
  );
}
