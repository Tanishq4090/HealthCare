import { useState, useEffect } from 'react';
import { Menu, X, Heart } from 'lucide-react';

const Navigation = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navLinks = [
    { name: 'Home', href: '#home' },
    { name: 'About', href: '#about' },
    { name: 'Services', href: '#services' },
    { name: 'Doctors', href: '#doctors' },
    { name: 'Testimonials', href: '#testimonials' },
    { name: 'Appointment', href: '#appointment' },
    { name: 'Contact', href: '#contact' },
  ];

  const scrollToSection = (href: string) => {
    const element = document.querySelector(href);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
    setIsMobileMenuOpen(false);
  };

  return (
    <>
      <nav
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
          isScrolled ? 'nav-scrolled py-3' : 'py-5 bg-transparent'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <a
              href="#home"
              onClick={(e) => {
                e.preventDefault();
                scrollToSection('#home');
              }}
              className="flex items-center gap-2 group cursor-pointer"
            >
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#285fe2] to-[#03cd69] flex items-center justify-center transform group-hover:rotate-12 transition-transform duration-300">
                <Heart className="w-5 h-5 text-white animate-heartbeat" />
              </div>
              <span className="text-xl font-bold text-[#002a5c] font-['Plus_Jakarta_Sans']">
                HealthFirst
              </span>
            </a>

            {/* Desktop Navigation */}
            <div className="hidden lg:flex items-center gap-1">
              {navLinks.map((link) => (
                <a
                  key={link.name}
                  href={link.href}
                  onClick={(e) => {
                    e.preventDefault();
                    scrollToSection(link.href);
                  }}
                  className="px-4 py-2 text-sm font-medium text-[#002a5c]/80 hover:text-[#285fe2] rounded-lg hover:bg-[#285fe2]/5 transition-all duration-300 cursor-pointer animated-underline"
                >
                  {link.name}
                </a>
              ))}
            </div>

            {/* CTA Button */}
            <div className="hidden lg:block">
              <a
                href="#appointment"
                onClick={(e) => {
                  e.preventDefault();
                  scrollToSection('#appointment');
                }}
                className="px-6 py-3 bg-gradient-to-r from-[#285fe2] to-[#1e4fc2] text-white text-sm font-semibold rounded-full hover:shadow-lg hover:shadow-[#285fe2]/30 transform hover:scale-105 transition-all duration-300 cursor-pointer"
              >
                Book Now
              </a>
            </div>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="lg:hidden p-2 rounded-lg hover:bg-[#285fe2]/10 transition-colors cursor-pointer"
            >
              {isMobileMenuOpen ? (
                <X className="w-6 h-6 text-[#002a5c]" />
              ) : (
                <Menu className="w-6 h-6 text-[#002a5c]" />
              )}
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile Menu */}
      <div
        className={`fixed inset-0 z-40 lg:hidden transition-all duration-500 ${
          isMobileMenuOpen ? 'opacity-100 visible' : 'opacity-0 invisible'
        }`}
      >
        <div
          className="absolute inset-0 bg-black/20 backdrop-blur-sm"
          onClick={() => setIsMobileMenuOpen(false)}
        />
        <div
          className={`absolute top-20 left-4 right-4 bg-white rounded-2xl shadow-2xl p-6 transform transition-all duration-500 ${
            isMobileMenuOpen ? 'translate-y-0 opacity-100' : '-translate-y-10 opacity-0'
          }`}
        >
          <div className="flex flex-col gap-2">
            {navLinks.map((link) => (
              <a
                key={link.name}
                href={link.href}
                onClick={(e) => {
                  e.preventDefault();
                  scrollToSection(link.href);
                }}
                className="px-4 py-3 text-[#002a5c] font-medium rounded-xl hover:bg-[#285fe2]/5 transition-colors cursor-pointer"
              >
                {link.name}
              </a>
            ))}
            <a
              href="#appointment"
              onClick={(e) => {
                e.preventDefault();
                scrollToSection('#appointment');
              }}
              className="mt-4 px-6 py-3 bg-gradient-to-r from-[#285fe2] to-[#1e4fc2] text-white text-center font-semibold rounded-full cursor-pointer"
            >
              Book Now
            </a>
          </div>
        </div>
      </div>
    </>
  );
};

export default Navigation;
