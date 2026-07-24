import { motion } from 'framer-motion';

export function GoogleMap() {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className="w-full rounded-2xl overflow-hidden border border-gray-100 shadow-sm" 
      style={{ height: '320px' }}
    >
      <iframe
        title="99 Care Office Location"
        width="100%"
        height="100%"
        style={{ border: 0 }}
        loading="lazy"
        allowFullScreen
        referrerPolicy="no-referrer-when-downgrade"
        src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3719.9678!2d72.783688!3d21.192329!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3be04e6e00000001%3A0x6e266a8a5b828854!2sFortune%20Mall!5e0!3m2!1sen!2sin!4v1710430000000"
      />
    </motion.div>
  );
}
