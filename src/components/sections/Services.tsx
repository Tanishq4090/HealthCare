import { useRef } from 'react';
import { useScrollReveal } from '@/hooks/useScrollReveal';
import { 
  Stethoscope, 
  HeartPulse, 
  Pill, 
  Activity,
  Baby,
  Brain,
  Bone,
  Eye,
  ArrowRight
} from 'lucide-react';

const Services = () => {
  const { ref: sectionRef, isVisible } = useScrollReveal<HTMLElement>({ threshold: 0.1 });
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>, index: number) => {
    const card = cardRefs.current[index];
    if (!card) return;

    const rect = card.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    card.style.setProperty('--mouse-x', `${x}%`);
    card.style.setProperty('--mouse-y', `${y}%`);
  };

  const services = [
    {
      icon: HeartPulse,
      title: 'Cardiology',
      description: 'Comprehensive heart care including diagnostics, treatment, and preventive cardiology services.',
      color: 'from-rose-500 to-rose-600',
      features: ['ECG & Echo', 'Stress Tests', 'Heart Monitoring'],
    },
    {
      icon: Stethoscope,
      title: 'General Medicine',
      description: 'Primary healthcare services for all ages, from routine check-ups to chronic disease management.',
      color: 'from-blue-500 to-blue-600',
      features: ['Health Checkups', 'Vaccinations', 'Chronic Care'],
    },
    {
      icon: Pill,
      title: 'Pharmacy',
      description: 'Full-service pharmacy with prescription fulfillment, medication counseling, and health products.',
      color: 'from-emerald-500 to-emerald-600',
      features: ['Prescriptions', 'Health Products', 'Consultations'],
    },
    {
      icon: Baby,
      title: 'Pediatrics',
      description: 'Specialized care for infants, children, and adolescents in a friendly, comforting environment.',
      color: 'from-amber-500 to-amber-600',
      features: ['Well-Baby Visits', 'Immunizations', 'Growth Monitoring'],
    },
    {
      icon: Brain,
      title: 'Neurology',
      description: 'Expert diagnosis and treatment of neurological conditions with advanced imaging technology.',
      color: 'from-violet-500 to-violet-600',
      features: ['Brain Imaging', 'EEG Testing', 'Headache Clinic'],
    },
    {
      icon: Bone,
      title: 'Orthopedics',
      description: 'Comprehensive musculoskeletal care including surgery, rehabilitation, and sports medicine.',
      color: 'from-cyan-500 to-cyan-600',
      features: ['Joint Care', 'Sports Medicine', 'Rehabilitation'],
    },
    {
      icon: Eye,
      title: 'Ophthalmology',
      description: 'Complete eye care services from routine exams to advanced surgical procedures.',
      color: 'from-indigo-500 to-indigo-600',
      features: ['Eye Exams', 'Cataract Surgery', 'LASIK'],
    },
    {
      icon: Activity,
      title: 'Emergency Care',
      description: '24/7 emergency medical services with rapid response and state-of-the-art trauma care.',
      color: 'from-red-500 to-red-600',
      features: ['24/7 Available', 'Trauma Care', 'Ambulance'],
    },
  ];

  return (
    <section
      id="services"
      ref={sectionRef}
      className="relative py-24 lg:py-32 bg-[#f8fafc] overflow-hidden"
    >
      {/* Background Decorations */}
      <div className="absolute top-0 left-0 w-full h-full">
        <div className="absolute top-20 left-10 w-72 h-72 bg-[#285fe2]/5 rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-[#03cd69]/5 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className={`text-center mb-16 transition-all duration-1000 ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
          <span className="inline-block px-4 py-2 bg-[#285fe2]/10 text-[#285fe2] text-sm font-semibold rounded-full mb-4">
            Our Services
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-[#002a5c] font-['Plus_Jakarta_Sans'] mb-4">
            Comprehensive <span className="text-[#285fe2]">Medical Services</span>
          </h2>
          <p className="text-lg text-[#002a5c]/70 max-w-2xl mx-auto">
            We offer a wide range of medical services to meet all your healthcare needs, 
            delivered by experienced professionals using the latest technology.
          </p>
        </div>

        {/* Services Grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {services.map((service, index) => (
            <div
              key={index}
              ref={(el) => { cardRefs.current[index] = el; }}
              onMouseMove={(e) => handleMouseMove(e, index)}
              className={`service-card glass-card rounded-2xl p-6 card-lift cursor-pointer group transition-all duration-700 ${
                isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'
              }`}
              style={{ transitionDelay: `${200 + index * 100}ms` }}
            >
              {/* Icon */}
              <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${service.color} flex items-center justify-center mb-5 shadow-lg group-hover:scale-110 group-hover:rotate-6 transition-all duration-500`}>
                <service.icon className="w-7 h-7 text-white" />
              </div>

              {/* Content */}
              <h3 className="text-xl font-bold text-[#002a5c] mb-3 group-hover:text-[#285fe2] transition-colors">
                {service.title}
              </h3>
              
              <p className="text-sm text-[#002a5c]/70 mb-4 leading-relaxed">
                {service.description}
              </p>

              {/* Features */}
              <div className="space-y-2 mb-5">
                {service.features.map((feature, fIndex) => (
                  <div key={fIndex} className="flex items-center gap-2">
                    <div className={`w-1.5 h-1.5 rounded-full bg-gradient-to-r ${service.color}`} />
                    <span className="text-xs text-[#002a5c]/60">{feature}</span>
                  </div>
                ))}
              </div>

              {/* Link */}
              <div className="flex items-center gap-2 text-[#285fe2] font-medium text-sm group/link cursor-pointer">
                <span>Learn More</span>
                <ArrowRight className="w-4 h-4 group-hover/link:translate-x-1 transition-transform" />
              </div>

              {/* Hover Glow Effect */}
              <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none">
                <div className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${service.color} opacity-5`} />
              </div>
            </div>
          ))}
        </div>

        {/* Bottom CTA */}
        <div className={`mt-16 text-center transition-all duration-1000 delay-700 ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
          <p className="text-[#002a5c]/70 mb-4">
            Need help finding the right service? Contact our support team.
          </p>
          <a
            href="#contact"
            onClick={(e) => {
              e.preventDefault();
              document.querySelector('#contact')?.scrollIntoView({ behavior: 'smooth' });
            }}
            className="inline-flex items-center gap-2 px-6 py-3 bg-[#285fe2] text-white font-semibold rounded-full hover:shadow-lg hover:shadow-[#285fe2]/30 transform hover:scale-105 transition-all duration-300 cursor-pointer"
          >
            Contact Us
            <ArrowRight className="w-5 h-5" />
          </a>
        </div>
      </div>
    </section>
  );
};

export default Services;
