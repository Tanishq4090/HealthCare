import { useState } from 'react';
import { useScrollReveal } from '@/hooks/useScrollReveal';
import { ChevronLeft, ChevronRight, Star, Mail, Phone } from 'lucide-react';

const Doctors = () => {
  const { ref: sectionRef, isVisible } = useScrollReveal<HTMLElement>({ threshold: 0.1 });
  const [activeIndex, setActiveIndex] = useState(0);

  const doctors = [
    {
      name: 'Dr. Sarah Johnson',
      specialty: 'Cardiologist',
      image: '/doctor-sarah.jpg',
      rating: 4.9,
      reviews: 128,
      experience: '15+ years',
      email: 'sarah.j@healthfirst.com',
      phone: '+1 (555) 123-4567',
      description: 'Board-certified cardiologist specializing in preventive cardiology and heart failure management.',
    },
    {
      name: 'Dr. Michael Chen',
      specialty: 'General Physician',
      image: '/doctor-michael.jpg',
      rating: 4.8,
      reviews: 156,
      experience: '12+ years',
      email: 'michael.c@healthfirst.com',
      phone: '+1 (555) 234-5678',
      description: 'Experienced general physician providing comprehensive primary care for patients of all ages.',
    },
    {
      name: 'Dr. Emily Rodriguez',
      specialty: 'Pediatrician',
      image: '/doctor-emily.jpg',
      rating: 5.0,
      reviews: 203,
      experience: '10+ years',
      email: 'emily.r@healthfirst.com',
      phone: '+1 (555) 345-6789',
      description: 'Dedicated pediatrician passionate about children\'s health and developmental care.',
    },
  ];

  const nextSlide = () => {
    setActiveIndex((prev) => (prev + 1) % doctors.length);
  };

  const prevSlide = () => {
    setActiveIndex((prev) => (prev - 1 + doctors.length) % doctors.length);
  };

  return (
    <section
      id="doctors"
      ref={sectionRef}
      className="relative py-24 lg:py-32 bg-white overflow-hidden"
    >
      {/* Background Decorations */}
      <div className="absolute inset-0">
        <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-[#f0f4ff] to-transparent" />
        <div className="absolute bottom-0 left-20 w-72 h-72 bg-[#285fe2]/5 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className={`flex flex-col lg:flex-row lg:items-end lg:justify-between mb-16 transition-all duration-1000 ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
          <div>
            <span className="inline-block px-4 py-2 bg-[#285fe2]/10 text-[#285fe2] text-sm font-semibold rounded-full mb-4">
              Our Doctors
            </span>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-[#002a5c] font-['Plus_Jakarta_Sans'] mb-4">
              Meet Our <span className="text-[#285fe2]">Expert Team</span>
            </h2>
            <p className="text-lg text-[#002a5c]/70 max-w-xl">
              Our team of experienced physicians is dedicated to providing you with 
              the highest quality healthcare services.
            </p>
          </div>

          {/* Navigation Arrows */}
          <div className="flex gap-3 mt-6 lg:mt-0">
            <button
              onClick={prevSlide}
              className="w-12 h-12 rounded-full bg-white border-2 border-[#285fe2]/20 flex items-center justify-center text-[#285fe2] hover:bg-[#285fe2] hover:text-white hover:border-[#285fe2] transition-all duration-300 cursor-pointer"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <button
              onClick={nextSlide}
              className="w-12 h-12 rounded-full bg-white border-2 border-[#285fe2]/20 flex items-center justify-center text-[#285fe2] hover:bg-[#285fe2] hover:text-white hover:border-[#285fe2] transition-all duration-300 cursor-pointer"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Doctors Carousel */}
        <div className="relative">
          <div className="overflow-hidden">
            <div 
              className="flex transition-transform duration-700 ease-out"
              style={{ transform: `translateX(-${activeIndex * 100}%)` }}
            >
              {doctors.map((doctor, index) => (
                <div
                  key={index}
                  className="w-full flex-shrink-0 px-2"
                >
                  <div className={`grid lg:grid-cols-2 gap-8 items-center transition-all duration-700 ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`} style={{ transitionDelay: `${200 + index * 100}ms` }}>
                    {/* Doctor Image */}
                    <div className="relative">
                      <div className="relative rounded-3xl overflow-hidden shadow-2xl group">
                        <img
                          src={doctor.image}
                          alt={doctor.name}
                          className="w-full h-[400px] lg:h-[500px] object-cover object-top group-hover:scale-105 transition-transform duration-700"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-[#002a5c]/40 to-transparent" />
                        
                        {/* Experience Badge */}
                        <div className="absolute top-6 left-6 glass-card px-4 py-2 rounded-full">
                          <span className="text-sm font-semibold text-[#002a5c]">{doctor.experience}</span>
                        </div>
                      </div>

                      {/* Decorative Elements */}
                      <div className="absolute -bottom-4 -right-4 w-24 h-24 bg-[#03cd69]/20 rounded-full blur-2xl" />
                      <div className="absolute -top-4 -left-4 w-32 h-32 bg-[#285fe2]/20 rounded-full blur-2xl" />
                    </div>

                    {/* Doctor Info */}
                    <div className="space-y-6">
                      <div>
                        <span className="inline-block px-3 py-1 bg-[#285fe2]/10 text-[#285fe2] text-sm font-medium rounded-full mb-3">
                          {doctor.specialty}
                        </span>
                        <h3 className="text-2xl sm:text-3xl font-bold text-[#002a5c] font-['Plus_Jakarta_Sans'] mb-2">
                          {doctor.name}
                        </h3>
                        
                        {/* Rating */}
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1">
                            {[...Array(5)].map((_, i) => (
                              <Star
                                key={i}
                                className={`w-5 h-5 ${
                                  i < Math.floor(doctor.rating)
                                    ? 'text-yellow-400 fill-yellow-400'
                                    : 'text-gray-300'
                                }`}
                              />
                            ))}
                          </div>
                          <span className="font-semibold text-[#002a5c]">{doctor.rating}</span>
                          <span className="text-[#002a5c]/60">({doctor.reviews} reviews)</span>
                        </div>
                      </div>

                      <p className="text-[#002a5c]/70 leading-relaxed">
                        {doctor.description}
                      </p>

                      {/* Contact Info */}
                      <div className="space-y-3">
                        <div className="flex items-center gap-3 text-[#002a5c]/70">
                          <div className="w-10 h-10 rounded-lg bg-[#285fe2]/10 flex items-center justify-center">
                            <Mail className="w-5 h-5 text-[#285fe2]" />
                          </div>
                          <span>{doctor.email}</span>
                        </div>
                        <div className="flex items-center gap-3 text-[#002a5c]/70">
                          <div className="w-10 h-10 rounded-lg bg-[#03cd69]/10 flex items-center justify-center">
                            <Phone className="w-5 h-5 text-[#03cd69]" />
                          </div>
                          <span>{doctor.phone}</span>
                        </div>
                      </div>

                      {/* CTA Buttons */}
                      <div className="flex flex-wrap gap-4">
                        <a
                          href="#appointment"
                          onClick={(e) => {
                            e.preventDefault();
                            document.querySelector('#appointment')?.scrollIntoView({ behavior: 'smooth' });
                          }}
                          className="px-6 py-3 bg-gradient-to-r from-[#285fe2] to-[#1e4fc2] text-white font-semibold rounded-full hover:shadow-lg hover:shadow-[#285fe2]/30 transform hover:scale-105 transition-all duration-300 cursor-pointer"
                        >
                          Book Appointment
                        </a>
                        <button className="px-6 py-3 border-2 border-[#285fe2]/20 text-[#285fe2] font-semibold rounded-full hover:border-[#285fe2] hover:bg-[#285fe2]/5 transition-all duration-300 cursor-pointer">
                          View Profile
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Pagination Dots */}
          <div className="flex justify-center gap-2 mt-8">
            {doctors.map((_, index) => (
              <button
                key={index}
                onClick={() => setActiveIndex(index)}
                className={`w-3 h-3 rounded-full transition-all duration-300 cursor-pointer ${
                  index === activeIndex
                    ? 'w-8 bg-[#285fe2]'
                    : 'bg-[#285fe2]/30 hover:bg-[#285fe2]/50'
                }`}
              />
            ))}
          </div>
        </div>

        {/* All Doctors Grid Preview */}
        <div className={`mt-16 grid grid-cols-3 gap-4 transition-all duration-1000 delay-500 ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
          {doctors.map((doctor, index) => (
            <button
              key={index}
              onClick={() => setActiveIndex(index)}
              className={`relative rounded-xl overflow-hidden transition-all duration-300 cursor-pointer ${
                index === activeIndex ? 'ring-2 ring-[#285fe2] ring-offset-2' : 'opacity-60 hover:opacity-100'
              }`}
            >
              <img
                src={doctor.image}
                alt={doctor.name}
                className="w-full h-24 sm:h-32 object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#002a5c]/60 to-transparent" />
              <div className="absolute bottom-2 left-2 right-2">
                <p className="text-white text-xs sm:text-sm font-semibold truncate">{doctor.name}</p>
                <p className="text-white/80 text-xs truncate">{doctor.specialty}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Doctors;
