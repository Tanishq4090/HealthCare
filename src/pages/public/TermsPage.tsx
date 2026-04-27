import { Link } from 'react-router-dom';
import { ChevronRight, FileText, CheckCircle2 } from 'lucide-react';
import { PageTransition } from '@/components/PageTransition';
import { AnimateOnScroll } from '@/components/AnimateOnScroll';
import { fadeUp } from '@/lib/animations';
import { SEOMeta } from '@/components/SEOMeta';

export default function TermsPage() {
  const sections = [
    {
      id: "eligibility",
      title: "1. Eligibility",
      content: [
        "Only adults (18+) who can legally contract under Indian law may use the website.",
        "Minors, insolvents, or those legally incompetent cannot register or transact."
      ]
    },
    {
      id: "services",
      title: "2. Services Offered",
      content: [
        "Nursing Care",
        "Trained Attendant Care",
        "Doctor on Call",
        "Physiotherapy",
        "Pathology Sample Collection",
        "Pharmacy Delivery",
        "Medical Equipment (rental & purchase, installation, monitoring)",
        "Critical Care at Home (including ICU setups)",
        "Elderly Care (special plans for dementia, Alzheimer’s, chronic ailments)"
      ]
    },
    {
      id: "consent",
      title: "3. Consent & Responsibilities",
      content: [
        "Patients must provide written consent before services begin.",
        "Respect and cooperation with staff (nurses, attendants, doctors) is required.",
        "Security of staff and medical equipment at home is the responsibility of the patient party.",
        "Any changes in care plans must be communicated promptly."
      ]
    },
    {
      id: "refunds",
      title: "4. Medical Equipment & Refunds",
      content: [
        "Security deposits are mandatory and refundable after quality checks.",
        "Refunds are processed via NEFT within 30 working days after service ends.",
        "Patients are responsible for equipment safety at home."
      ]
    },
    {
      id: "pharmacy",
      title: "5. Pharmacy & Pathology",
      content: [
        "Only prescribed medicines are delivered.",
        "Prescription handover is mandatory.",
        "Pathology samples are collected as per doctor’s advice, with applicable charges."
      ]
    },
    {
      id: "conduct",
      title: "6. User Account & Conduct",
      content: [
        "Users must provide accurate registration details and safeguard their account credentials.",
        "Misuse, impersonation, spamming, or uploading unlawful/obscene content is strictly prohibited.",
        "Violations can lead to immediate termination of access."
      ]
    },
    {
      id: "privacy",
      title: "7. Privacy & Data Protection",
      content: [
        "By using the website, users consent to 99CARE’s Privacy Policy.",
        "Personal data is collected, stored, and processed in compliance with Indian IT laws.",
        "Users indemnify 99CARE against breaches of data protection obligations."
      ]
    },
    {
      id: "ip",
      title: "8. Intellectual Property",
      content: [
        "All content, software, and materials on the website belong to 99CARE Helping Hand.",
        "Unauthorized copying, reproduction, or distribution is prohibited.",
        "Trademarks of third-party products remain with their respective owners."
      ]
    },
    {
      id: "liability",
      title: "9. Liability & Disclaimer",
      content: [
        "Product images are for reference; actual items may differ.",
        "99CARE does not guarantee product quality or suitability.",
        "They are not liable for damages, losses, or service interruptions beyond their control."
      ]
    }
  ];

  return (
    <PageTransition>
      <SEOMeta
        title="Terms & Conditions | 99 Care Home Healthcare"
        description="Review the terms and conditions for using 99 Care services and our website."
        canonical="https://99care.org/terms"
      />
      <div className="w-full">
        {/* HERO SECTION */}
        <section className="pt-32 pb-16 px-6 text-center bg-white dark:bg-slate-950 border-b border-gray-100 dark:border-slate-800">
          <div className="max-w-3xl mx-auto">
            <AnimateOnScroll variants={{ hidden: { opacity: 0 }, visible: { opacity: 1, transition: { duration: 0.5 } } }}>
              <div className="text-sm text-gray-400 mb-6 flex justify-center items-center gap-2">
                <Link to="/" className="hover:text-brand-blue transition-colors">Home</Link>
                <ChevronRight className="w-4 h-4" />
                <span className="text-gray-900 dark:text-white font-medium">Terms & Conditions</span>
              </div>
              <FileText className="w-12 h-12 text-brand-blue mx-auto mb-6" />
            </AnimateOnScroll>
            <AnimateOnScroll variants={fadeUp} delay={0.1}>
              <h1 className="text-4xl md:text-5xl font-extrabold text-gray-900 dark:text-white mb-6 tracking-tight">
                Terms & Conditions
              </h1>
            </AnimateOnScroll>
            <AnimateOnScroll variants={fadeUp} delay={0.2}>
              <p className="text-lg text-gray-500 dark:text-gray-400 font-light">
                Please read these terms carefully before using our services.
              </p>
            </AnimateOnScroll>
          </div>
        </section>

        {/* CONTENT SECTION */}
        <section className="py-20 bg-white dark:bg-slate-950">
          <div className="container mx-auto px-6 max-w-4xl">
            <div className="bg-brand-gray/30 dark:bg-slate-900/50 p-8 rounded-3xl mb-12 border border-gray-100 dark:border-slate-800">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">🔑 Key Highlights</h2>
              <p className="text-gray-600 dark:text-gray-400 leading-relaxed italic">
                99CARE Helping Hand provides a wide range of home healthcare services, but patients must give consent, respect staff, ensure security, and comply with laws. Refunds and services follow strict policies, and 99CARE limits its liability for product/service outcomes.
              </p>
            </div>

            <div className="space-y-16">
              {sections.map((section) => (
                <div key={section.id}>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">{section.title}</h2>
                  <ul className="space-y-4">
                    {section.content.map((item, idx) => (
                      <li key={idx} className="flex gap-3 text-gray-600 dark:text-gray-400 leading-relaxed">
                        <CheckCircle2 className="w-5 h-5 text-brand-blue shrink-0 mt-1" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            <div className="mt-20 pt-10 border-t border-gray-100 dark:border-slate-800 text-center">
              <p className="text-gray-500 dark:text-gray-400 text-sm">
                If you have any questions about these terms, please <Link to="/contact" className="text-brand-blue hover:underline">contact us</Link>.
              </p>
            </div>
          </div>
        </section>
      </div>
    </PageTransition>
  );
}
