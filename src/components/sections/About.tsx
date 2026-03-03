import { useScrollReveal, useCountUp } from '@/hooks/useScrollReveal';
import { useEffect } from 'react';
import { Award, Heart, Stethoscope, Clock, CheckCircle2 } from 'lucide-react';

const About = () => {
  const { ref: sectionRef, isVisible } = useScrollReveal<HTMLElement>({ threshold: 0.2 });
  
  const { count: doctorsCount, startAnimation: startDoctors } = useCountUp(100, 2000);
  const { count: patientsCount, startAnimation: startPatients } = useCountUp(50, 2000);
  const { count: ratingCount, startAnimation: startRating } = useCountUp(4.9, 2000, 0);

  useEffect(() => {
    if (isVisible) {
      startDoctors();
      startPatients();
      startRating();
    }
  }, [isVisible, startDoctors, startPatients, startRating]);

  const flipCards = [
    {
      icon: Heart,
      title: 'Patient-Centered Care',
      description: 'We put our patients first, ensuring personalized treatment plans tailored to your unique needs.',
      color: 'from-rose-400 to-rose-600',
      bgColor: 'bg-rose-50',
    },
    {
      icon: Stethoscope,
      title: 'Expert Physicians',
      description: 'Our team of board-certified doctors brings decades of combined experience across specialties.',
      color: 'from-blue-400 to-blue-600',
      bgColor: 'bg-blue-50',
    },
    {
      icon: Award,
      title: 'Award Winning',
      description: 'Recognized for excellence in healthcare with multiple industry awards and certifications.',
      color: 'from-amber-400 to-amber-600',
      bgColor: 'bg-amber-50',
    },
    {
      icon: Clock,
      title: '24/7 Availability',
      description: 'Round-the-clock medical services ensuring you receive care whenever you need it.',
      color: 'from-emerald-400 to-emerald-600',
      bgColor: 'bg-emerald-50',
    },
  ];

  const features = [
    'State-of-the-art medical equipment',
    'Comprehensive health screenings',
    'Same-day appointment availability',
    'Online consultation services',
    'Insurance claim assistance',
    'Follow-up care programs',
  ];

  return (
    <section
      id="about"
      ref={sectionRef}
      className="relative py-24 lg:py-32 bg-white overflow-hidden"
    >
      {/* Background Decorations */}
      <div className="absolute top-0 right-0 w-1/3 h-full bg-gradient-to-l from-[#f0f4ff] to-transparent opacity-50" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-[#03cd69]/5 rounded-full blur-3xl" />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className={`text-center mb-16 transition-all duration-1000 ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
          <span className="inline-block px-4 py-2 bg-[#285fe2]/10 text-[#285fe2] text-sm font-semibold rounded-full mb-4">
            About Us
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-[#002a5c] font-['Plus_Jakarta_Sans'] mb-4">
            Why Choose <span className="text-[#285fe2]">HealthFirst</span>
          </h2>
          <p className="text-lg text-[#002a5c]/70 max-w-2xl mx-auto">
            We are committed to providing exceptional healthcare services with a focus on 
            patient comfort, advanced technology, and compassionate care.
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-16 items-center mb-20">
          {/* Left - Image with Stats */}
          <div className={`relative transition-all duration-1000 delay-200 ${isVisible ? 'translate-x-0 opacity-100' : '-translate-x-10 opacity-0'}`}>
            <div className="relative">
              {/* Main Image */}
              <div className="relative rounded-3xl overflow-hidden shadow-2xl">
                <img
                  src="/about-doctors.jpg"
                  alt="Our Medical Team"
                  className="w-full h-auto"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#002a5c]/20 to-transparent" />
              </div>

              {/* Floating Stats Cards */}
              <div className="absolute -bottom-8 -right-8 glass-card rounded-2xl p-6 shadow-xl animate-float-slow">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#285fe2] to-[#1e4fc2] flex items-center justify-center">
                    <Heart className="w-8 h-8 text-white" />
                  </div>
                  <div>
                    <p className="text-3xl font-bold text-[#002a5c]">{doctorsCount}+</p>
                    <p className="text-sm text-[#002a5c]/60">Expert Doctors</p>
                  </div>
                </div>
              </div>

              <div className="absolute -top-6 -left-6 glass-card rounded-2xl p-5 shadow-xl animate-float">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#03cd69] to-[#02b85a] flex items-center justify-center">
                    <Award className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-[#002a5c]">{patientsCount}K+</p>
                    <p className="text-xs text-[#002a5c]/60">Happy Patients</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right - Content */}
          <div className={`space-y-6 transition-all duration-1000 delay-300 ${isVisible ? 'translate-x-0 opacity-100' : 'translate-x-10 opacity-0'}`}>
            <h3 className="text-2xl sm:text-3xl font-bold text-[#002a5c] font-['Plus_Jakarta_Sans']">
              Dedicated to Your Health & Well-being
            </h3>
            
            <p className="text-[#002a5c]/70 leading-relaxed">
              At HealthFirst, we believe that quality healthcare should be accessible to everyone. 
              Our state-of-the-art facilities, combined with our team of experienced medical 
              professionals, ensure that you receive the best possible care.
            </p>

            <p className="text-[#002a5c]/70 leading-relaxed">
              From routine check-ups to specialized treatments, we offer comprehensive medical 
              services designed to keep you and your family healthy. Our patient-centered approach 
              means we take the time to understand your needs and provide personalized care.
            </p>

            {/* Features List */}
            <div className="grid sm:grid-cols-2 gap-3 pt-4">
              {features.map((feature, index) => (
                <div
                  key={index}
                  className="flex items-center gap-2 group"
                >
                  <CheckCircle2 className="w-5 h-5 text-[#03cd69] group-hover:scale-110 transition-transform" />
                  <span className="text-sm text-[#002a5c]/80">{feature}</span>
                </div>
              ))}
            </div>

            {/* Rating */}
            <div className="flex items-center gap-4 pt-4">
              <div className="flex items-center gap-1">
                {[...Array(5)].map((_, i) => (
                  <svg
                    key={i}
                    className="w-5 h-5 text-yellow-400 fill-yellow-400"
                    viewBox="0 0 20 20"
                  >
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
              </div>
              <div>
                <span className="text-2xl font-bold text-[#002a5c]">{ratingCount.toFixed(1)}</span>
                <span className="text-[#002a5c]/60 ml-2">Patient Rating</span>
              </div>
            </div>
          </div>
        </div>

        {/* Flip Cards Section */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {flipCards.map((card, index) => (
            <div
              key={index}
              className={`flip-card cursor-pointer transition-all duration-700 ${
                isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'
              }`}
              style={{ transitionDelay: `${400 + index * 100}ms` }}
            >
              <div className="flip-card-inner">
                {/* Front */}
                <div className={`flip-card-front ${card.bgColor} p-6 flex flex-col items-center justify-center text-center`}>
                  <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${card.color} flex items-center justify-center mb-4 shadow-lg`}>
                    <card.icon className="w-8 h-8 text-white" />
                  </div>
                  <h4 className="text-lg font-bold text-[#002a5c] mb-2">{card.title}</h4>
                  <p className="text-sm text-[#002a5c]/60">Hover to learn more</p>
                </div>

                {/* Back */}
                <div className={`flip-card-back bg-gradient-to-br ${card.color} p-6 flex flex-col items-center justify-center text-center`}>
                  <card.icon className="w-10 h-10 text-white/80 mb-4" />
                  <p className="text-white text-sm leading-relaxed">{card.description}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default About;
