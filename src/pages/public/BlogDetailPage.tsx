import { useParams, Navigate, Link } from 'react-router-dom';
import { ChevronRight, Calendar, Clock, User, Facebook, Twitter, Linkedin, ThumbsUp, Sparkles, Tag } from 'lucide-react';
import { blogs } from '@/data/blogs';
import { PageTransition } from '@/components/PageTransition';
import { AnimateOnScroll } from '@/components/AnimateOnScroll';
import { fadeUp } from '@/lib/animations';
import { SEOMeta } from '@/components/SEOMeta';

export default function BlogDetailPage() {
  const { slug } = useParams();
  
  // Find the requested blog
  const blog = blogs.find(b => b.slug === slug);
  
  if (!blog) {
    return <Navigate to="/blog" replace />;
  }

  // Get next 2 articles for "More Articles" section
  const currentIndex = blogs.findIndex(b => b.slug === slug);
  const moreArticles = [
    blogs[(currentIndex + 1) % blogs.length],
    blogs[(currentIndex + 2) % blogs.length],
  ];

  return (
    <PageTransition>
      <SEOMeta 
        title={`${blog.title} | 99 Care Healthcare Blog`}
        description={blog.excerpt}
        canonical={`https://99care.org/blog/${blog.slug}`}
        ogImage={`https://99care.org${blog.image}`}
        ogType="article"
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "BlogPosting",
          "headline": blog.title,
          "description": blog.excerpt,
          "image": `https://99care.org${blog.image}`,
          "author": {
            "@type": "Person",
            "name": blog.author || "99 Care Healthcare Team"
          },
          "publisher": {
            "@type": "Organization",
            "name": "99 Care",
            "logo": {
              "@type": "ImageObject",
              "url": "https://99care.org/99care-logo.svg"
            }
          },
          "datePublished": blog.date,
          "mainEntityOfPage": `https://99care.org/blog/${blog.slug}`
        }}
      />
      <div className="w-full bg-slate-50/60 dark:bg-slate-950 min-h-screen pb-32">
        
        {/* SECTION 1 — HERO / TOP */}
        <section className="relative pt-32 pb-16 px-6 bg-gradient-to-b from-blue-50/60 via-white to-slate-50/60 dark:from-slate-900 dark:via-slate-950 dark:to-slate-950 border-b border-gray-200/60 dark:border-slate-800 overflow-hidden">
          <div className="absolute top-10 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-brand-blue/5 blur-[120px] rounded-full pointer-events-none"></div>

          <div className="container mx-auto max-w-4xl relative z-10">
            <AnimateOnScroll variants={{ hidden: { opacity: 0, y: -10 }, visible: { opacity: 1, y: 0, transition: { duration: 0.4 } } }}>
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white dark:bg-slate-900 border border-gray-200/80 dark:border-slate-800 text-xs text-gray-500 dark:text-gray-400 mb-6 shadow-sm">
                <Link to="/" className="hover:text-brand-blue transition-colors">Home</Link>
                <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
                <Link to="/blog" className="hover:text-brand-blue transition-colors">Blog</Link>
                <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
                <span className="text-brand-blue dark:text-teal-400 font-semibold">{blog.tags?.[0] || 'Health & Care'}</span>
              </div>
            </AnimateOnScroll>
            
            <AnimateOnScroll variants={fadeUp} delay={0.05}>
              <span className="inline-flex items-center gap-1.5 px-4 py-1 rounded-full bg-brand-blue/10 text-brand-blue dark:text-teal-400 text-xs font-bold uppercase tracking-wider mb-4">
                <Tag className="w-3.5 h-3.5" /> {blog.tags?.[0] || 'Health & Care'}
              </span>
            </AnimateOnScroll>

            <AnimateOnScroll variants={fadeUp} delay={0.1}>
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-gray-900 dark:text-white mb-8 tracking-tight leading-tight">
                {blog.title}
              </h1>
            </AnimateOnScroll>
            
            <AnimateOnScroll variants={fadeUp} delay={0.2}>
              <div className="flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-gray-600 dark:text-gray-400 font-medium p-4 rounded-2xl bg-white dark:bg-slate-900 border border-gray-200/80 dark:border-slate-800 shadow-sm w-fit">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-brand-blue/10 flex items-center justify-center text-brand-blue">
                    <User className="w-4 h-4" />
                  </div>
                  <span className="font-bold text-gray-900 dark:text-white">{blog.author}</span>
                </div>
                <div className="hidden sm:block w-px h-4 bg-gray-200 dark:bg-slate-800"></div>
                <div className="flex items-center gap-2"><Calendar className="w-4 h-4 text-brand-blue" /> {blog.date}</div>
                <div className="hidden sm:block w-px h-4 bg-gray-200 dark:bg-slate-800"></div>
                <div className="flex items-center gap-2"><Clock className="w-4 h-4 text-brand-blue" /> {blog.readTime}</div>
              </div>
            </AnimateOnScroll>
          </div>
        </section>

        {/* SECTION 2 — ARTICLE IMAGE */}
        <section className="px-6 pt-8">
          <div className="container mx-auto max-w-4xl">
            <div className="p-3 bg-white dark:bg-slate-900 rounded-3xl border border-gray-200/80 dark:border-slate-800 shadow-sm">
              <div className="aspect-[16/9] w-full overflow-hidden rounded-2xl bg-slate-100 dark:bg-slate-800">
                <img 
                  src={blog.image} 
                  alt={blog.title}
                  className="w-full h-full object-cover object-top transition-transform duration-500 hover:scale-105"
                />
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 3 — CONTENT */}
        <section className="pt-12 px-6">
          <div className="container mx-auto max-w-3xl">
            <div className="bg-white dark:bg-slate-900 p-8 sm:p-12 rounded-3xl border border-gray-200/80 dark:border-slate-800 shadow-sm prose prose-lg prose-gray dark:prose-invert max-w-none text-gray-700 dark:text-gray-300 font-light leading-relaxed space-y-10">
              {blog.content.map((item, idx) => (
                <div key={idx} className="space-y-4">
                  {item.heading && (
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight pt-4 border-t border-gray-100 dark:border-slate-800 first:border-none first:pt-0">
                      {item.heading}
                    </h2>
                  )}
                  <p className="whitespace-pre-line text-base sm:text-lg leading-relaxed text-gray-600 dark:text-gray-300 font-light">
                    {item.paragraph}
                  </p>
                </div>
              ))}

              {/* SHARE & HELPFUL ROW */}
              <div className="mt-12 pt-8 border-t border-gray-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-6 not-prose">
                <div className="flex items-center gap-4">
                  <span className="text-sm font-semibold text-gray-900 dark:text-white">Was this article helpful?</span>
                  <button className="flex items-center gap-2 px-5 py-2.5 rounded-full border border-gray-200 dark:border-slate-800 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-brand-blue/10 hover:text-brand-blue hover:border-brand-blue/30 transition-all">
                    <ThumbsUp className="w-4 h-4" /> Yes
                  </button>
                </div>
                
                <div className="flex items-center gap-3 text-gray-400">
                  <span className="text-sm font-semibold text-gray-900 dark:text-white mr-2">Share Article:</span>
                  <button className="w-10 h-10 rounded-2xl border border-gray-200 dark:border-slate-800 flex items-center justify-center hover:bg-[#1877F2] hover:text-white hover:border-[#1877F2] transition-colors"><Facebook className="w-4 h-4" /></button>
                  <button className="w-10 h-10 rounded-2xl border border-gray-200 dark:border-slate-800 flex items-center justify-center hover:bg-[#1DA1F2] hover:text-white hover:border-[#1DA1F2] transition-colors"><Twitter className="w-4 h-4" /></button>
                  <button className="w-10 h-10 rounded-2xl border border-gray-200 dark:border-slate-800 flex items-center justify-center hover:bg-[#0A66C2] hover:text-white hover:border-[#0A66C2] transition-colors"><Linkedin className="w-4 h-4" /></button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 4 — MORE ARTICLES */}
        <section className="pt-16 px-6">
          <div className="container mx-auto max-w-4xl">
            <div className="flex items-center justify-between mb-8">
              <div>
                <span className="text-brand-blue text-xs font-bold uppercase tracking-[0.2em] mb-1 block">Keep Reading</span>
                <h3 className="text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight">More Related Articles</h3>
              </div>
              <Link to="/blog" className="text-sm font-bold text-brand-blue hover:underline flex items-center gap-1">
                View All Articles <ChevronRight className="w-4 h-4" />
              </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {moreArticles.map((relBlog) => (
                <Link key={relBlog.slug} to={`/blog/${relBlog.slug}`} className="group bg-white dark:bg-slate-900 p-5 rounded-3xl border border-gray-200/80 dark:border-slate-800 hover:shadow-md transition-all flex gap-5 items-center">
                  <div className="w-28 h-24 flex-shrink-0 bg-slate-100 dark:bg-slate-800 rounded-2xl overflow-hidden border border-gray-100 dark:border-slate-800">
                    <img 
                      src={relBlog.image} 
                      alt={relBlog.title}
                      className="w-full h-full object-cover object-top transition-transform duration-500 group-hover:scale-105"
                    />
                  </div>
                  <div>
                    <div className="text-xs text-brand-blue font-bold uppercase tracking-wider mb-1.5">{relBlog.readTime}</div>
                    <h4 className="font-bold text-gray-900 dark:text-white text-base leading-snug group-hover:text-brand-blue transition-colors line-clamp-2">{relBlog.title}</h4>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>

      </div>
    </PageTransition>
  );
}
