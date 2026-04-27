import { Link } from 'react-router-dom';
import { ChevronRight, ShieldCheck } from 'lucide-react';
import { PageTransition } from '@/components/PageTransition';
import { AnimateOnScroll } from '@/components/AnimateOnScroll';
import { fadeUp } from '@/lib/animations';
import { SEOMeta } from '@/components/SEOMeta';

export default function PrivacyPolicyPage() {
  return (
    <PageTransition>
      <SEOMeta
        title="Privacy Policy | 99 Care Home Healthcare"
        description="Read our privacy policy to understand how 99 Care handles your personal information with respect and care."
        canonical="https://99care.org/privacy"
      />
      <div className="w-full">
        {/* HERO SECTION */}
        <section className="pt-32 pb-16 px-6 text-center bg-white dark:bg-slate-950 border-b border-gray-100 dark:border-slate-800">
          <div className="max-w-3xl mx-auto">
            <AnimateOnScroll variants={{ hidden: { opacity: 0 }, visible: { opacity: 1, transition: { duration: 0.5 } } }}>
              <div className="text-sm text-gray-400 mb-6 flex justify-center items-center gap-2">
                <Link to="/" className="hover:text-brand-blue transition-colors">Home</Link>
                <ChevronRight className="w-4 h-4" />
                <span className="text-gray-900 dark:text-white font-medium">Privacy Policy</span>
              </div>
              <ShieldCheck className="w-12 h-12 text-brand-blue mx-auto mb-6" />
            </AnimateOnScroll>
            <AnimateOnScroll variants={fadeUp} delay={0.1}>
              <h1 className="text-4xl md:text-5xl font-extrabold text-gray-900 dark:text-white mb-6 tracking-tight">
                Privacy Policy
              </h1>
            </AnimateOnScroll>
            <AnimateOnScroll variants={fadeUp} delay={0.2}>
              <p className="text-lg text-gray-500 dark:text-gray-400 font-light">
                Your privacy is important to us. Learn how we protect and manage your data.
              </p>
            </AnimateOnScroll>
          </div>
        </section>

        {/* CONTENT SECTION */}
        <section className="py-20 bg-white dark:bg-slate-950">
          <div className="container mx-auto px-6 max-w-4xl">
            <div className="prose prose-slate dark:prose-invert max-w-none">
              <p className="text-gray-600 dark:text-gray-400 leading-relaxed mb-8">
                Your privacy is important to us. It is the policy of 99CARE Helping Hand to respect your privacy regarding any information we may collect from you across our website, <a href="https://www.99care.org" className="text-brand-blue hover:underline">https://www.99care.org</a>, and other sites we own and operate.
              </p>

              <div className="space-y-12">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Information Collection</h2>
                  <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
                    We only request personal information when it is genuinely needed to provide a service to you. Information is collected by fair and lawful means, with your knowledge and consent. We will always explain why we are collecting it and how it will be used.
                  </p>
                </div>

                <div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Data Retention & Protection</h2>
                  <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
                    We retain collected information only for as long as necessary to deliver the requested service. Any data we store is protected by commercially acceptable measures to prevent loss, theft, unauthorized access, disclosure, copying, use, or modification.
                  </p>
                </div>

                <div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Information Sharing</h2>
                  <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
                    We do not share personally identifiable information publicly or with third parties, except when required by law.
                  </p>
                </div>

                <div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Third‑Party Links</h2>
                  <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
                    Our website may contain links to external sites not operated by us. Please note that we have no control over the content and practices of these sites and cannot accept responsibility or liability for their privacy policies.
                  </p>
                </div>

                <div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Your Choices</h2>
                  <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
                    You are free to decline our request for personal information, with the understanding that we may be unable to provide some services you desire.
                  </p>
                </div>

                <div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Acceptance of Policy</h2>
                  <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
                    Continued use of our website will be regarded as acceptance of our practices regarding privacy and personal information. If you have any questions about how we handle user data, please contact us.
                  </p>
                </div>

                <div className="pt-8 border-t border-gray-100 dark:border-slate-800">
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    This policy is effective from February 2, 2023.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </PageTransition>
  );
}
