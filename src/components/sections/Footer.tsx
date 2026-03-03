import { Heart, Facebook, Twitter, Instagram, Linkedin, ArrowUp } from 'lucide-react';

const Footer = () => {
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const quickLinks = [
    { name: 'Home', href: '#home' },
    { name: 'About Us', href: '#about' },
    { name: 'Services', href: '#services' },
    { name: 'Doctors', href: '#doctors' },
    { name: 'Testimonials', href: '#testimonials' },
    { name: 'Appointment', href: '#appointment' },
  ];

  const services = [
    { name: 'Cardiology', href: '#services' },
    { name: 'General Medicine', href: '#services' },
    { name: 'Pediatrics', href: '#services' },
    { name: 'Neurology', href: '#services' },
    { name: 'Orthopedics', href: '#services' },
    { name: 'Emergency Care', href: '#services' },
  ];

  const legal = [
    { name: 'Privacy Policy', href: '#' },
    { name: 'Terms of Service', href: '#' },
    { name: 'Cookie Policy', href: '#' },
    { name: 'HIPAA Compliance', href: '#' },
  ];

  const socialLinks = [
    { icon: Facebook, href: '#', label: 'Facebook' },
    { icon: Twitter, href: '#', label: 'Twitter' },
    { icon: Instagram, href: '#', label: 'Instagram' },
    { icon: Linkedin, href: '#', label: 'LinkedIn' },
  ];

  const scrollToSection = (href: string) => {
    if (href.startsWith('#')) {
      const element = document.querySelector(href);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
      }
    }
  };

  return (
    <footer className="relative bg-[#002a5c] text-white overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-5">
        <div 
          className="absolute inset-0"
          style={{
            backgroundImage: `radial-gradient(circle at 2px 2px, white 1px, transparent 0)`,
            backgroundSize: '40px 40px'
          }}
        />
      </div>

      {/* Main Footer Content */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-12">
          {/* Brand Column */}
          <div className="space-y-6">
            <a href="#home" onClick={(e) => { e.preventDefault(); scrollToSection('#home'); }} className="flex items-center gap-2 group cursor-pointer">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#285fe2] to-[#03cd69] flex items-center justify-center transform group-hover:rotate-12 transition-transform duration-300">
                <Heart className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold font-['Plus_Jakarta_Sans']">
                HealthFirst
              </span>
            </a>
            <p className="text-white/70 text-sm leading-relaxed">
              Providing exceptional healthcare services with compassion and cutting-edge 
              technology. Your health is our priority.
            </p>
            <div className="flex gap-3">
              {socialLinks.map((social, index) => (
                <a
                  key={index}
                  href={social.href}
                  aria-label={social.label}
                  className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center hover:bg-[#285fe2] transition-colors duration-300 cursor-pointer"
                >
                  <social.icon className="w-4 h-4" />
                </a>
              ))}
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="text-lg font-semibold mb-6">Quick Links</h4>
            <ul className="space-y-3">
              {quickLinks.map((link, index) => (
                <li key={index}>
                  <a
                    href={link.href}
                    onClick={(e) => { e.preventDefault(); scrollToSection(link.href); }}
                    className="text-white/70 hover:text-white text-sm transition-colors duration-300 cursor-pointer inline-block relative group"
                  >
                    {link.name}
                    <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-[#03cd69] group-hover:w-full transition-all duration-300" />
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Services */}
          <div>
            <h4 className="text-lg font-semibold mb-6">Our Services</h4>
            <ul className="space-y-3">
              {services.map((service, index) => (
                <li key={index}>
                  <a
                    href={service.href}
                    onClick={(e) => { e.preventDefault(); scrollToSection(service.href); }}
                    className="text-white/70 hover:text-white text-sm transition-colors duration-300 cursor-pointer inline-block relative group"
                  >
                    {service.name}
                    <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-[#03cd69] group-hover:w-full transition-all duration-300" />
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact Info */}
          <div>
            <h4 className="text-lg font-semibold mb-6">Contact Info</h4>
            <ul className="space-y-4">
              <li className="flex items-start gap-3">
                <div className="w-5 h-5 rounded bg-[#285fe2]/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-xs">📍</span>
                </div>
                <span className="text-white/70 text-sm">
                  123 Healthcare Avenue<br />
                  Medical District, NY 10001
                </span>
              </li>
              <li className="flex items-center gap-3">
                <div className="w-5 h-5 rounded bg-[#285fe2]/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-xs">📞</span>
                </div>
                <span className="text-white/70 text-sm">+1 (555) 123-4567</span>
              </li>
              <li className="flex items-center gap-3">
                <div className="w-5 h-5 rounded bg-[#285fe2]/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-xs">✉️</span>
                </div>
                <span className="text-white/70 text-sm">info@healthfirst.com</span>
              </li>
              <li className="flex items-start gap-3">
                <div className="w-5 h-5 rounded bg-[#285fe2]/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-xs">🕐</span>
                </div>
                <span className="text-white/70 text-sm">
                  Mon - Fri: 8AM - 8PM<br />
                  Sat - Sun: 9AM - 5PM
                </span>
              </li>
            </ul>
          </div>
        </div>

        {/* Newsletter */}
        <div className="mt-12 pt-12 border-t border-white/10">
          <div className="grid lg:grid-cols-2 gap-8 items-center">
            <div>
              <h4 className="text-xl font-semibold mb-2">Subscribe to Our Newsletter</h4>
              <p className="text-white/70 text-sm">
                Get health tips, news, and updates delivered to your inbox.
              </p>
            </div>
            <div className="flex gap-3">
              <input
                type="email"
                placeholder="Enter your email"
                className="flex-1 px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder:text-white/50 focus:outline-none focus:border-[#285fe2] transition-colors"
              />
              <button className="px-6 py-3 bg-gradient-to-r from-[#285fe2] to-[#03cd69] rounded-xl font-semibold hover:shadow-lg hover:shadow-[#285fe2]/30 transition-all duration-300 cursor-pointer">
                Subscribe
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="relative z-10 border-t border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-white/60 text-sm text-center sm:text-left">
              © {new Date().getFullYear()} HealthFirst. All rights reserved.
            </p>
            <div className="flex items-center gap-6">
              {legal.map((item, index) => (
                <a
                  key={index}
                  href={item.href}
                  className="text-white/60 hover:text-white text-sm transition-colors duration-300 cursor-pointer"
                >
                  {item.name}
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Scroll to Top Button */}
      <button
        onClick={scrollToTop}
        className="fixed bottom-8 right-8 w-12 h-12 rounded-full bg-gradient-to-r from-[#285fe2] to-[#03cd69] flex items-center justify-center text-white shadow-lg hover:shadow-xl hover:scale-110 transition-all duration-300 z-50 cursor-pointer"
        aria-label="Scroll to top"
      >
        <ArrowUp className="w-5 h-5" />
      </button>
    </footer>
  );
};

export default Footer;
