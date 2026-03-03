import { useEffect } from 'react';
import CustomCursor from './components/cursor/CustomCursor';
import Navigation from './components/Navigation';
import Hero from './components/sections/Hero';
import About from './components/sections/About';
import Services from './components/sections/Services';
import Doctors from './components/sections/Doctors';
import Testimonials from './components/sections/Testimonials';
import Appointment from './components/sections/Appointment';
import Contact from './components/sections/Contact';
import Footer from './components/sections/Footer';
import Chatbot from './components/chatbot/Chatbot';

export default function LandingPage() {
    useEffect(() => {
        document.documentElement.style.scrollBehavior = 'smooth';
        return () => {
            document.documentElement.style.scrollBehavior = 'auto';
        };
    }, []);

    return (
        <div className="relative cursor-none">
            <CustomCursor />
            <Navigation />

            <main>
                <Hero />
                <About />
                <Services />
                <Doctors />
                <Testimonials />
                <Appointment />
                <Contact />
            </main>

            <Footer />
            <Chatbot />
        </div>
    );
}
