import { useState } from 'react';
import { useScrollReveal } from '@/hooks/useScrollReveal';
import { Quote, Star, ChevronLeft, ChevronRight } from 'lucide-react';

const Testimonials = () => {
  const { ref: sectionRef, isVisible } = useScrollReveal<HTMLElement>({ threshold: 0.1 });
  const [activeIndex, setActiveIndex] = useState(0);

  const testimonials = [
    {
      name: 'John Smith',
      role: 'Business Executive',
      image: '/testimonial-john.jpg',
      rating: 5,
      text: 'The care I received at HealthFirst was exceptional. From the moment I walked in, the staff was attentive and professional. Dr. Chen took the time to explain everything thoroughly, and I felt truly cared for. Highly recommend!',
      treatment: 'General Checkup',
    },
    {
      name: 'Maria Garcia',
      role: 'Teacher',
      image: '/testimonial-maria.jpg',
      rating: 5,
      text: 'I brought my daughter here for her pediatric checkup, and Dr. Rodriguez was amazing with her. She made my daughter feel comfortable and the entire experience was stress-free. The facility is clean and modern too.',
      treatment: 'Pediatric Care',
    },
    {
      name: 'Lisa Thompson',
      role: 'Software Engineer',
      image: '/testimonial-lisa.jpg',
      rating: 5,
      text: 'After struggling with heart issues for years, I finally found the right care at HealthFirst. Dr. Johnson\'s expertise in cardiology has been life-changing. The follow-up care and support have been outstanding.',
      treatment: 'Cardiology',
    },
  ];

  const nextTestimonial = () => {
    setActiveIndex((prev) => (prev + 1) % testimonials.length);
  };

  const prevTestimonial = () => {
    setActiveIndex((prev) => (prev - 1 + testimonials.length) % testimonials.length);
  };

  return (
    <section
      id="testimonials"
      ref={sectionRef}
      className="relative py-24 lg:py-32 bg-[#f8fafc] overflow-hidden"
    >
      {/* Background Decorations */}
      <div className="absolute inset-0">
        <div className="absolute top-20 left-10 w-72 h-72 bg-[#285fe2]/5 rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-[#03cd69]/5 rounded-full blur-3xl" />
        
        {/* Large Quote Decoration */}
        <Quote className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] text-[#285fe2]/[0.03]" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className={`text-center mb-16 transition-all duration-1000 ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
          <span className="inline-block px-4 py-2 bg-[#285fe2]/10 text-[#285fe2] text-sm font-semibold rounded-full mb-4">
            Testimonials
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-[#002a5c] font-['Plus_Jakarta_Sans'] mb-4">
            What Our <span className="text-[#285fe2]">Patients Say</span>
          </h2>
          <p className="text-lg text-[#002a5c]/70 max-w-2xl mx-auto">
            Real stories from real patients who have experienced our care firsthand.
          </p>
        </div>

        {/* Testimonials Content */}
        <div className={`relative transition-all duration-1000 delay-200 ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
          {/* Main Testimonial Card */}
          <div className="relative max-w-4xl mx-auto">
            <div className="glass-card rounded-3xl p-8 lg:p-12 shadow-xl">
              {/* Quote Icon */}
              <div className="absolute -top-6 left-8 w-12 h-12 bg-gradient-to-br from-[#285fe2] to-[#1e4fc2] rounded-xl flex items-center justify-center shadow-lg">
                <Quote className="w-6 h-6 text-white" />
              </div>

              <div className="grid lg:grid-cols-3 gap-8 items-center">
                {/* Patient Image */}
                <div className="relative">
                  <div className="relative w-32 h-32 lg:w-48 lg:h-48 mx-auto">
                    <div className="absolute inset-0 rounded-full bg-gradient-to-br from-[#285fe2] to-[#03cd69] p-1">
                      <div className="w-full h-full rounded-full overflow-hidden bg-white">
                        <img
                          src={testimonials[activeIndex].image}
                          alt={testimonials[activeIndex].name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    </div>
                  </div>
                  
                  {/* Treatment Badge */}
                  <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 glass-card px-4 py-1 rounded-full whitespace-nowrap">
                    <span className="text-xs font-medium text-[#285fe2]">
                      {testimonials[activeIndex].treatment}
                    </span>
                  </div>
                </div>

                {/* Testimonial Content */}
                <div className="lg:col-span-2 space-y-4">
                  {/* Rating */}
                  <div className="flex items-center gap-1">
                    {[...Array(testimonials[activeIndex].rating)].map((_, i) => (
                      <Star key={i} className="w-5 h-5 text-yellow-400 fill-yellow-400" />
                    ))}
                  </div>

                  {/* Quote Text */}
                  <p className="text-lg lg:text-xl text-[#002a5c]/80 leading-relaxed italic">
                    "{testimonials[activeIndex].text}"
                  </p>

                  {/* Patient Info */}
                  <div className="pt-4 border-t border-[#285fe2]/10">
                    <p className="text-lg font-bold text-[#002a5c]">
                      {testimonials[activeIndex].name}
                    </p>
                    <p className="text-sm text-[#002a5c]/60">
                      {testimonials[activeIndex].role}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Navigation */}
            <div className="flex items-center justify-between mt-8">
              <div className="flex gap-2">
                {testimonials.map((_, index) => (
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

              <div className="flex gap-3">
                <button
                  onClick={prevTestimonial}
                  className="w-12 h-12 rounded-full bg-white border-2 border-[#285fe2]/20 flex items-center justify-center text-[#285fe2] hover:bg-[#285fe2] hover:text-white hover:border-[#285fe2] transition-all duration-300 cursor-pointer"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>
                <button
                  onClick={nextTestimonial}
                  className="w-12 h-12 rounded-full bg-white border-2 border-[#285fe2]/20 flex items-center justify-center text-[#285fe2] hover:bg-[#285fe2] hover:text-white hover:border-[#285fe2] transition-all duration-300 cursor-pointer"
                >
                  <ChevronRight className="w-6 h-6" />
                </button>
              </div>
            </div>
          </div>

          {/* Side Preview Cards */}
          <div className="hidden lg:grid grid-cols-3 gap-6 mt-12">
            {testimonials.map((testimonial, index) => (
              <button
                key={index}
                onClick={() => setActiveIndex(index)}
                className={`glass-card rounded-2xl p-6 text-left transition-all duration-300 cursor-pointer hover:shadow-lg ${
                  index === activeIndex
                    ? 'ring-2 ring-[#285fe2] ring-offset-2 scale-105'
                    : 'opacity-60 hover:opacity-100'
                }`}
              >
                <div className="flex items-center gap-4 mb-4">
                  <img
                    src={testimonial.image}
                    alt={testimonial.name}
                    className="w-12 h-12 rounded-full object-cover"
                  />
                  <div>
                    <p className="font-semibold text-[#002a5c]">{testimonial.name}</p>
                    <p className="text-xs text-[#002a5c]/60">{testimonial.role}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1 mb-2">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                  ))}
                </div>
                <p className="text-sm text-[#002a5c]/70 line-clamp-2">
                  "{testimonial.text}"
                </p>
              </button>
            ))}
          </div>
        </div>

        {/* Stats */}
        <div className={`grid grid-cols-2 lg:grid-cols-4 gap-6 mt-16 transition-all duration-1000 delay-400 ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
          {[
            { value: '10K+', label: 'Happy Patients' },
            { value: '4.9', label: 'Average Rating' },
            { value: '98%', label: 'Satisfaction Rate' },
            { value: '50+', label: 'Awards Won' },
          ].map((stat, index) => (
            <div
              key={index}
              className="glass-card rounded-2xl p-6 text-center hover:shadow-lg transition-shadow duration-300"
            >
              <p className="text-3xl lg:text-4xl font-bold text-[#285fe2] mb-1">
                {stat.value}
              </p>
              <p className="text-sm text-[#002a5c]/60">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Testimonials;
