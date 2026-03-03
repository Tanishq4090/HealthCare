import { useState } from 'react';
import { useScrollReveal } from '@/hooks/useScrollReveal';
import { supabase } from '@/lib/supabase';
import {
  Calendar as CalendarIcon,
  Clock,
  User,
  Mail,
  Phone,
  FileText,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Stethoscope
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const Appointment = () => {
  const { ref: sectionRef, isVisible } = useScrollReveal<HTMLElement>({ threshold: 0.1 });
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [showSuccess, setShowSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    doctor: '',
    reason: '',
  });

  // Generate calendar days
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days = [];

    // Empty cells for days before the first day of the month
    for (let i = 0; i < firstDay; i++) {
      days.push(null);
    }

    // Days of the month
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(i);
    }

    return days;
  };

  // Time slots
  const timeSlots = [
    '09:00 AM', '09:30 AM', '10:00 AM', '10:30 AM',
    '11:00 AM', '11:30 AM', '02:00 PM', '02:30 PM',
    '03:00 PM', '03:30 PM', '04:00 PM', '04:30 PM',
  ];

  // Doctors list
  const doctors = [
    { id: 'sarah', name: 'Dr. Sarah Johnson', specialty: 'Cardiologist' },
    { id: 'michael', name: 'Dr. Michael Chen', specialty: 'General Physician' },
    { id: 'emily', name: 'Dr. Emily Rodriguez', specialty: 'Pediatrician' },
  ];

  const handlePrevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1));
  };

  const handleDateSelect = (day: number) => {
    setSelectedDate(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day));
    setSelectedTime(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (selectedDate && selectedTime && formData.firstName && formData.lastName) {
      setIsSubmitting(true);

      try {
        const { error } = await supabase
          .from('appointments')
          .insert([
            {
              first_name: formData.firstName,
              last_name: formData.lastName,
              email: formData.email,
              phone: formData.phone,
              doctor: formData.doctor,
              reason: formData.reason,
              appointment_date: selectedDate.toISOString().split('T')[0],
              appointment_time: selectedTime,
            }
          ]);

        if (error) throw error;

        setShowSuccess(true);
      } catch (error: any) {
        console.error('Error saving appointment:', error);
        setErrorMessage(error.message || 'Failed to book appointment. Please try again.');
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const isFormValid = () => {
    return (
      selectedDate &&
      selectedTime &&
      formData.firstName &&
      formData.lastName &&
      formData.email &&
      formData.phone &&
      formData.doctor
    );
  };

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <section
      id="appointment"
      ref={sectionRef}
      className="relative py-24 lg:py-32 bg-white overflow-hidden"
    >
      {/* Background Decorations */}
      <div className="absolute inset-0">
        <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-[#f0f4ff] to-transparent" />
        <div className="absolute bottom-0 left-20 w-72 h-72 bg-[#285fe2]/5 rounded-full blur-3xl" />
        <div className="absolute top-20 right-20 w-96 h-96 bg-[#03cd69]/5 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className={`text-center mb-16 transition-all duration-1000 ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
          <span className="inline-block px-4 py-2 bg-[#285fe2]/10 text-[#285fe2] text-sm font-semibold rounded-full mb-4">
            Book Appointment
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-[#002a5c] font-['Plus_Jakarta_Sans'] mb-4">
            Schedule Your <span className="text-[#285fe2]">Visit</span>
          </h2>
          <p className="text-lg text-[#002a5c]/70 max-w-2xl mx-auto">
            Book your appointment online in just a few simple steps.
            Choose your preferred date, time, and doctor.
          </p>
        </div>

        <div className={`grid lg:grid-cols-2 gap-12 items-start transition-all duration-1000 delay-200 ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
          {/* Left - Calendar & Time Selection */}
          <div className="space-y-8">
            {/* Calendar */}
            <div className="glass-card rounded-3xl p-6 shadow-xl">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-[#002a5c] flex items-center gap-2">
                  <CalendarIcon className="w-5 h-5 text-[#285fe2]" />
                  Select Date
                </h3>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handlePrevMonth}
                    className="w-8 h-8 rounded-full bg-[#285fe2]/10 flex items-center justify-center text-[#285fe2] hover:bg-[#285fe2] hover:text-white transition-colors cursor-pointer"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <span className="text-sm font-semibold text-[#002a5c] min-w-[120px] text-center">
                    {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
                  </span>
                  <button
                    onClick={handleNextMonth}
                    className="w-8 h-8 rounded-full bg-[#285fe2]/10 flex items-center justify-center text-[#285fe2] hover:bg-[#285fe2] hover:text-white transition-colors cursor-pointer"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Calendar Grid */}
              <div className="grid grid-cols-7 gap-1">
                {weekDays.map((day) => (
                  <div key={day} className="text-center text-xs font-semibold text-[#002a5c]/50 py-2">
                    {day}
                  </div>
                ))}
                {getDaysInMonth(currentMonth).map((day, index) => {
                  if (day === null) {
                    return <div key={index} className="aspect-square" />;
                  }

                  const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
                  const isToday = new Date().toDateString() === date.toDateString();
                  const isSelected = selectedDate?.toDateString() === date.toDateString();
                  const isPast = date < new Date(new Date().setHours(0, 0, 0, 0));

                  return (
                    <button
                      key={index}
                      onClick={() => !isPast && handleDateSelect(day)}
                      disabled={isPast}
                      className={`
                        aspect-square flex items-center justify-center text-sm font-medium rounded-lg transition-all duration-200 cursor-pointer
                        ${isPast ? 'text-gray-300 cursor-not-allowed' : 'hover:bg-[#285fe2]/10 text-[#002a5c]'}
                        ${isToday ? 'ring-2 ring-[#285fe2] ring-offset-1' : ''}
                        ${isSelected ? 'bg-[#285fe2] text-white hover:bg-[#285fe2]' : ''}
                      `}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Time Slots */}
            {selectedDate && (
              <div className="glass-card rounded-3xl p-6 shadow-xl animate-fade-in">
                <h3 className="text-xl font-bold text-[#002a5c] flex items-center gap-2 mb-4">
                  <Clock className="w-5 h-5 text-[#285fe2]" />
                  Select Time
                </h3>
                <p className="text-sm text-[#002a5c]/60 mb-4">
                  Available slots for {selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                </p>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                  {timeSlots.map((time) => (
                    <button
                      key={time}
                      onClick={() => setSelectedTime(time)}
                      className={`
                        px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer
                        ${selectedTime === time
                          ? 'bg-[#285fe2] text-white'
                          : 'bg-[#285fe2]/10 text-[#285fe2] hover:bg-[#285fe2]/20'
                        }
                      `}
                    >
                      {time}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Illustration */}
            <div className="hidden lg:block relative">
              <img
                src="/hero-doctor.png"
                alt="Book Appointment"
                className="w-64 mx-auto animate-float-slow"
              />
            </div>
          </div>

          {/* Right - Patient Details Form */}
          <div className="glass-card rounded-3xl p-8 shadow-xl">
            <h3 className="text-2xl font-bold text-[#002a5c] mb-6 flex items-center gap-2">
              <User className="w-6 h-6 text-[#285fe2]" />
              Patient Details
            </h3>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Name Fields */}
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName" className="text-[#002a5c]">
                    First Name <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="firstName"
                    placeholder="John"
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    className="form-input-glow border-[#285fe2]/20 focus:border-[#285fe2]"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName" className="text-[#002a5c]">
                    Last Name <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="lastName"
                    placeholder="Doe"
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    className="form-input-glow border-[#285fe2]/20 focus:border-[#285fe2]"
                    required
                  />
                </div>
              </div>

              {/* Contact Fields */}
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-[#002a5c]">
                    Email <span className="text-red-500">*</span>
                  </Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#285fe2]/50" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="john@example.com"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="form-input-glow pl-10 border-[#285fe2]/20 focus:border-[#285fe2]"
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone" className="text-[#002a5c]">
                    Phone Number <span className="text-red-500">*</span>
                  </Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#285fe2]/50" />
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="+1 (555) 000-0000"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="form-input-glow pl-10 border-[#285fe2]/20 focus:border-[#285fe2]"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Doctor Selection */}
              <div className="space-y-2">
                <Label htmlFor="doctor" className="text-[#002a5c]">
                  Select Doctor <span className="text-red-500">*</span>
                </Label>
                <div className="relative">
                  <Stethoscope className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#285fe2]/50 z-10" />
                  <Select
                    value={formData.doctor}
                    onValueChange={(value) => setFormData({ ...formData, doctor: value })}
                  >
                    <SelectTrigger className="form-input-glow pl-10 border-[#285fe2]/20 focus:border-[#285fe2]">
                      <SelectValue placeholder="Choose a doctor" />
                    </SelectTrigger>
                    <SelectContent>
                      {doctors.map((doctor) => (
                        <SelectItem key={doctor.id} value={doctor.id}>
                          <div className="flex flex-col">
                            <span>{doctor.name}</span>
                            <span className="text-xs text-gray-500">{doctor.specialty}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Reason for Visit */}
              <div className="space-y-2">
                <Label htmlFor="reason" className="text-[#002a5c]">
                  Reason for Visit
                </Label>
                <div className="relative">
                  <FileText className="absolute left-3 top-3 w-5 h-5 text-[#285fe2]/50" />
                  <Textarea
                    id="reason"
                    placeholder="Briefly describe your symptoms or reason for visit..."
                    value={formData.reason}
                    onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                    className="form-input-glow pl-10 min-h-[100px] border-[#285fe2]/20 focus:border-[#285fe2]"
                  />
                </div>
              </div>

              {/* Selected Date/Time Summary */}
              {(selectedDate || selectedTime) && (
                <div className="bg-[#285fe2]/5 rounded-xl p-4 space-y-2">
                  <p className="text-sm font-semibold text-[#002a5c]">Appointment Summary</p>
                  {selectedDate && (
                    <div className="flex items-center gap-2 text-sm text-[#002a5c]/70">
                      <CalendarIcon className="w-4 h-4 text-[#285fe2]" />
                      {selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                    </div>
                  )}
                  {selectedTime && (
                    <div className="flex items-center gap-2 text-sm text-[#002a5c]/70">
                      <Clock className="w-4 h-4 text-[#285fe2]" />
                      {selectedTime}
                    </div>
                  )}
                </div>
              )}

              {/* Error Message */}
              {errorMessage && (
                <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm border border-red-100">
                  {errorMessage}
                </div>
              )}

              {/* Submit Button */}
              <Button
                type="submit"
                disabled={!isFormValid() || isSubmitting}
                className={`
                  w-full py-6 text-lg font-semibold rounded-xl transition-all duration-300 cursor-pointer flex items-center justify-center gap-2
                  ${isFormValid() && !isSubmitting
                    ? 'bg-gradient-to-r from-[#285fe2] to-[#1e4fc2] hover:shadow-lg hover:shadow-[#285fe2]/30 hover:scale-[1.02]'
                    : 'bg-gray-300 cursor-not-allowed'
                  }
                `}
              >
                {isSubmitting ? (
                  <>
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Booking...
                  </>
                ) : isFormValid() ? 'Confirm Appointment' : 'Please fill all required fields'}
              </Button>
            </form>
          </div>
        </div>
      </div>

      {/* Success Dialog */}
      <Dialog open={showSuccess} onOpenChange={setShowSuccess}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="mx-auto w-16 h-16 bg-[#03cd69]/10 rounded-full flex items-center justify-center mb-4">
              <CheckCircle2 className="w-10 h-10 text-[#03cd69]" />
            </div>
            <DialogTitle className="text-center text-2xl font-bold text-[#002a5c]">
              Appointment Booked!
            </DialogTitle>
            <DialogDescription className="text-center text-[#002a5c]/70">
              Your appointment has been successfully scheduled. We've sent a confirmation email to {formData.email}.
            </DialogDescription>
          </DialogHeader>
          <div className="bg-[#f0f4ff] rounded-xl p-4 space-y-2 mt-4">
            <div className="flex justify-between text-sm">
              <span className="text-[#002a5c]/60">Date:</span>
              <span className="font-medium text-[#002a5c]">
                {selectedDate?.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-[#002a5c]/60">Time:</span>
              <span className="font-medium text-[#002a5c]">{selectedTime}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-[#002a5c]/60">Doctor:</span>
              <span className="font-medium text-[#002a5c]">
                {doctors.find(d => d.id === formData.doctor)?.name}
              </span>
            </div>
          </div>
          <Button
            onClick={() => {
              setShowSuccess(false);
              setSelectedDate(null);
              setSelectedTime(null);
              setFormData({
                firstName: '',
                lastName: '',
                email: '',
                phone: '',
                doctor: '',
                reason: '',
              });
            }}
            className="w-full mt-4 bg-[#285fe2] hover:bg-[#1e4fc2] cursor-pointer"
          >
            Book Another Appointment
          </Button>
        </DialogContent>
      </Dialog>
    </section>
  );
};

export default Appointment;
