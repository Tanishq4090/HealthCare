import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Clock, Users, Shield, Star } from 'lucide-react';

const Hero = () => {
  const [isLoaded, setIsLoaded] = useState(false);
  const heroRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsLoaded(true);
  }, []);

  // Mouse parallax effect for hero image
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!imageRef.current) return;
      
      const { clientX, clientY } = e;
      const { innerWidth, innerHeight } = window;
      
      const xPercent = (clientX / innerWidth - 0.5) * 2;
      const yPercent = (clientY / innerHeight - 0.5) * 2;
      
      imageRef.current.style.transform = `
        perspective(1000px)
        rotateY(${xPercent * 10}deg)
        rotateX(${-yPercent * 10}deg)
        translateZ(20px)
      `;
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  const scrollToAppointment = () => {
    const element = document.querySelector('#appointment');
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <section
      id="home"
      ref={heroRef}
      className="relative min-h-screen flex items-center overflow-hidden animated-gradient pt-20"
    >
      {/* Background Decorative Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Floating Blobs */}
        <div className="absolute top-20 left-10 w-72 h-72 bg-[#285fe2]/10 rounded-full blur-3xl animate-blob" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-[#03cd69]/10 rounded-full blur-3xl animate-blob" style={{ animationDelay: '-4s' }} />
        <div className="absolute top-1/2 left-1/3 w-64 h-64 bg-[#285fe2]/5 rounded-full blur-2xl animate-float-slow" />
        
        {/* Grid Pattern */}
        <div 
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `
              linear-gradient(#285fe2 1px, transparent 1px),
              linear-gradient(90deg, #285fe2 1px, transparent 1px)
            `,
            backgroundSize: '60px 60px'
          }}
        />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-20">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-8 items-center">
          {/* Left Content */}
          <div className="space-y-8">
            {/* Badge */}
            <div 
              className={`inline-flex items-center gap-2 px-4 py-2 bg-white/80 backdrop-blur-sm rounded-full shadow-lg transform transition-all duration-1000 ${
                isLoaded ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'
              }`}
            >
              <span className="w-2 h-2 bg-[#03cd69] rounded-full animate-pulse" />
              <span className="text-sm font-medium text-[#002a5c]">24/7 Emergency Services Available</span>
            </div>

            {/* Headline */}
            <div className="space-y-4">
              <h1 
                className={`text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-bold text-[#002a5c] font-['Plus_Jakarta_Sans'] leading-tight transform transition-all duration-1000 delay-200 ${
                  isLoaded ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'
                }`}
              >
                Expert Care for{' '}
                <span className="relative inline-block">
                  <span className="relative z-10 text-[#285fe2]">Your Health</span>
                  <svg 
                    className="absolute -bottom-2 left-0 w-full"
                    viewBox="0 0 200 12"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M2 10C50 2 150 2 198 10"
                      stroke="#03cd69"
                      strokeWidth="4"
                      strokeLinecap="round"
                      className={`transition-all duration-1000 delay-700 ${isLoaded ? 'stroke-dashoffset-0' : ''}`}
                      style={{
                        strokeDasharray: 200,
                        strokeDashoffset: isLoaded ? 0 : 200,
                        transition: 'stroke-dashoffset 1s ease-out 0.7s'
                      }}
                    />
                  </svg>
                </span>
              </h1>
              
              <p 
                className={`text-lg sm:text-xl text-[#002a5c]/70 max-w-xl leading-relaxed transform transition-all duration-1000 delay-300 ${
                  isLoaded ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'
                }`}
              >
                We provide the best medical services with advanced technology and 
                compassionate care. Your health is our priority.
              </p>
            </div>

            {/* CTA Buttons */}
            <div 
              className={`flex flex-wrap gap-4 transform transition-all duration-1000 delay-400 ${
                isLoaded ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'
              }`}
            >
              <button
                onClick={scrollToAppointment}
                className="group px-8 py-4 bg-gradient-to-r from-[#285fe2] to-[#1e4fc2] text-white font-semibold rounded-full hover:shadow-xl hover:shadow-[#285fe2]/30 transform hover:scale-105 transition-all duration-300 flex items-center gap-2 cursor-pointer"
              >
                Book Appointment
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </button>
              
              <a
                href="#services"
                onClick={(e) => {
                  e.preventDefault();
                  document.querySelector('#services')?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="px-8 py-4 bg-white text-[#285fe2] font-semibold rounded-full border-2 border-[#285fe2]/20 hover:border-[#285fe2] hover:shadow-lg transform hover:scale-105 transition-all duration-300 cursor-pointer"
              >
                Our Services
              </a>
            </div>

            {/* Stats */}
            <div 
              className={`flex flex-wrap gap-6 pt-4 transform transition-all duration-1000 delay-500 ${
                isLoaded ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-[#285fe2]/10 flex items-center justify-center">
                  <Clock className="w-6 h-6 text-[#285fe2]" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-[#002a5c]">24/7</p>
                  <p className="text-sm text-[#002a5c]/60">Emergency</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-[#03cd69]/10 flex items-center justify-center">
                  <Users className="w-6 h-6 text-[#03cd69]" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-[#002a5c]">100+</p>
                  <p className="text-sm text-[#002a5c]/60">Expert Doctors</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-[#285fe2]/10 flex items-center justify-center">
                  <Shield className="w-6 h-6 text-[#285fe2]" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-[#002a5c]">15+</p>
                  <p className="text-sm text-[#002a5c]/60">Years Experience</p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Content - 3D Images */}
          <div className="relative lg:h-[600px] flex items-center justify-center perspective-container">
            {/* Main Doctor Image */}
            <div
              ref={imageRef}
              className={`relative z-10 transform transition-all duration-1000 delay-300 ${
                isLoaded ? 'translate-x-0 opacity-100' : 'translate-x-20 opacity-0'
              }`}
              style={{ transformStyle: 'preserve-3d', transition: 'transform 0.1s ease' }}
            >
              <img
                src="/hero-doctor.png"
                alt="Doctor"
                className="w-full max-w-md lg:max-w-lg drop-shadow-2xl"
              />
            </div>

            {/* Floating Card 1 - Stats */}
            <div 
              className={`absolute top-10 left-0 lg:-left-8 glass-card rounded-2xl p-4 shadow-xl animate-float transform transition-all duration-1000 delay-700 ${
                isLoaded ? 'translate-y-0 opacity-100 scale-100' : 'translate-y-10 opacity-0 scale-90'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 rounded-xl overflow-hidden bg-[#f0f4ff]">
                  <img
                    src="/hero-team.png"
                    alt="Medical Team"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#002a5c]">Expert Team</p>
                  <div className="flex items-center gap-1">
                    <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                    <span className="text-sm text-[#002a5c]/70">4.9 Rating</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Floating Card 2 - Appointment */}
            <div 
              className={`absolute bottom-20 right-0 lg:-right-4 glass-card rounded-2xl p-4 shadow-xl animate-float-figure8 transform transition-all duration-1000 delay-900 ${
                isLoaded ? 'translate-y-0 opacity-100 scale-100' : 'translate-y-10 opacity-0 scale-90'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 rounded-xl overflow-hidden bg-[#f0f4ff]">
                  <img
                    src="/hero-appointment.png"
                    alt="Doctor"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#002a5c]">Next Available</p>
                  <p className="text-sm text-[#03cd69] font-medium">Today, 2:00 PM</p>
                </div>
              </div>
            </div>

            {/* Decorative Elements */}
            <div className="absolute top-1/4 right-1/4 w-4 h-4 bg-[#285fe2] rounded-full animate-pulse" />
            <div className="absolute bottom-1/3 left-1/4 w-3 h-3 bg-[#03cd69] rounded-full animate-pulse" style={{ animationDelay: '-1s' }} />
            <div className="absolute top-1/2 right-10 w-2 h-2 bg-[#285fe2]/50 rounded-full animate-pulse" style={{ animationDelay: '-2s' }} />
          </div>
        </div>
      </div>

      {/* Bottom Wave */}
      <div className="absolute bottom-0 left-0 right-0">
        <svg
          viewBox="0 0 1440 120"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full"
          preserveAspectRatio="none"
        >
          <path
            d="M0 120L60 110C120 100 240 80 360 70C480 60 600 60 720 65C840 70 960 80 1080 85C1200 90 1320 90 1380 90L1440 90V120H1380C1320 120 1200 120 1080 120C960 120 840 120 720 120C600 120 480 120 360 120C240 120 120 120 60 120H0Z"
            fill="white"
          />
        </svg>
      </div>
    </section>
  );
};

export default Hero;
