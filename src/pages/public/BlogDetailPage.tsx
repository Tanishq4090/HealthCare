import { useParams, Navigate, Link } from 'react-router-dom';
import { ChevronRight, Calendar, Clock, User, Facebook, Twitter, Linkedin, ThumbsUp } from 'lucide-react';
import { blogs } from '@/data/blogs';
import { PageTransition } from '@/components/PageTransition';
import { AnimateOnScroll } from '@/components/AnimateOnScroll';
import { fadeUp } from '@/lib/animations';

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
      <div className="w-full bg-white dark:bg-slate-950 min-h-screen pb-32">
        
        {/* SECTION 1 — HERO / TOP */}
        <section className="pt-32 pb-12 px-6 border-b border-gray-100 dark:border-slate-800">
        <div className="container mx-auto max-w-3xl">
          <AnimateOnScroll variants={{ hidden: { opacity: 0 }, visible: { opacity: 1, transition: { duration: 0.5 } } }}>
            <div className="text-sm text-gray-400 mb-8 flex items-center gap-2">
              <Link to="/" className="hover:text-brand-blue transition-colors">Home</Link>
              <ChevronRight className="w-4 h-4" />
              <Link to="/blog" className="hover:text-brand-blue transition-colors">Blog</Link>
              <ChevronRight className="w-4 h-4" />
              <span className="text-brand-blue font-medium">Health & Care</span>
            </div>
          </AnimateOnScroll>
          
          <AnimateOnScroll variants={fadeUp} delay={0.1}>
            <h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-8 tracking-tight leading-[1.15]">
              {blog.title}
            </h1>
          </AnimateOnScroll>
          
          <AnimateOnScroll variants={fadeUp} delay={0.2}>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-gray-500 dark:text-gray-400 font-medium">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-brand-blue-light dark:bg-slate-800 flex items-center justify-center text-brand-blue">
                  <User className="w-4 h-4" />
                </div>
                {blog.author}
              </div>
              <div className="hidden sm:block w-px h-4 bg-gray-200 dark:bg-slate-800"></div>
              <div className="flex items-center gap-2"><Calendar className="w-4 h-4" /> {blog.date}</div>
              <div className="hidden sm:block w-px h-4 bg-gray-200 dark:bg-slate-800"></div>
              <div className="flex items-center gap-2"><Clock className="w-4 h-4" /> {blog.readTime}</div>
            </div>
          </AnimateOnScroll>
        </div>
      </section>

      {/* SECTION 2 — ARTICLE IMAGE */}
      <section className="px-6 -mt-6">
        <div className="container mx-auto max-w-4xl">
          <div className="aspect-video w-full overflow-hidden rounded-[2rem] border border-gray-100 shadow-sm">
            <img 
              src={blog.image} 
              alt={blog.title}
              className="w-full h-full object-cover"
            />
          </div>
        </div>
      </section>

      {/* SECTION 3 — CONTENT */}
      <section className="pt-16 px-6">
        <div className="container mx-auto max-w-2xl">
          <div className="prose prose-lg prose-gray dark:prose-invert max-w-none text-gray-700 dark:text-gray-300 font-light leading-relaxed space-y-12">
            {blog.content.map((item, idx) => (
              <div key={idx} className="space-y-4">
                {item.heading && (
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
                    {item.heading}
                  </h2>
                )}
                <p>{item.paragraph}</p>
              </div>
            ))}
          </div>

          {/* SHARE & HELPFUL ROW */}
          <div className="mt-16 pt-8 border-t border-gray-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <span className="text-sm font-semibold text-gray-900 dark:text-white">Was this helpful?</span>
              <button className="flex items-center gap-2 px-4 py-2 rounded-full border border-gray-200 dark:border-slate-800 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-800 hover:text-brand-blue transition-colors">
                <ThumbsUp className="w-4 h-4" /> Yes
              </button>
            </div>
            
            <div className="flex items-center gap-4 text-gray-400">
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400 mr-2">Share:</span>
              <button className="w-10 h-10 rounded-full border border-gray-200 dark:border-slate-800 flex items-center justify-center hover:bg-[#1877F2] hover:text-white hover:border-[#1877F2] transition-colors"><Facebook className="w-4 h-4" /></button>
              <button className="w-10 h-10 rounded-full border border-gray-200 dark:border-slate-800 flex items-center justify-center hover:bg-[#1DA1F2] hover:text-white hover:border-[#1DA1F2] transition-colors"><Twitter className="w-4 h-4" /></button>
              <button className="w-10 h-10 rounded-full border border-gray-200 dark:border-slate-800 flex items-center justify-center hover:bg-[#0A66C2] hover:text-white hover:border-[#0A66C2] transition-colors"><Linkedin className="w-4 h-4" /></button>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 4 — MORE ARTICLES */}
      <section className="pt-24 px-6 mt-24 bg-brand-gray dark:bg-slate-900 border-t border-gray-100 dark:border-slate-800">
        <div className="container mx-auto max-w-5xl">
          <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-10 tracking-tight">More Articles</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {moreArticles.map((relBlog) => (
              <Link key={relBlog.slug} to={`/blog/${relBlog.slug}`} className="group bg-white dark:bg-slate-800 p-6 rounded-2xl border border-gray-100 dark:border-slate-700 hover:shadow-md transition-all flex gap-6 items-center">
                <div className="w-24 h-24 flex-shrink-0 bg-gray-50 dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-700 flex items-center justify-center">
                  <span className="text-brand-blue font-bold text-lg opacity-50">99</span>
                </div>
                <div>
                  <div className="text-xs text-brand-blue font-bold uppercase tracking-wider mb-2">{relBlog.readTime}</div>
                  <h4 className="font-bold text-gray-900 dark:text-white leading-tight group-hover:text-brand-blue transition-colors line-clamp-2">{relBlog.title}</h4>
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
