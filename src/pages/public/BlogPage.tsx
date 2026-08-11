import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, Clock, ChevronRight, Search, X, Sparkles } from 'lucide-react';
import { blogs } from '@/data/blogs';
import { motion, AnimatePresence } from 'framer-motion';
import { PageTransition } from '@/components/PageTransition';
import { AnimateOnScroll } from '@/components/AnimateOnScroll';
import { fadeUp, staggerContainer, staggerItem } from '@/lib/animations';
import { useDebounce } from '@/hooks/useDebounce';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { SEOMeta } from '@/components/SEOMeta';

export default function BlogPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTag, setActiveTag] = useState('All');
  const debouncedQuery = useDebounce(searchQuery, 200);

  // Extract all unique tags
  const allTags = useMemo(() => {
    const tags = new Set<string>();
    blogs.forEach(blog => blog.tags.forEach(tag => tags.add(tag)));
    return ['All', ...Array.from(tags).sort()];
  }, []);

  const filteredBlogs = useMemo(() => {
    return blogs.filter((blog) => {
      const matchesSearch = debouncedQuery === '' ||
        blog.title.toLowerCase().includes(debouncedQuery.toLowerCase()) ||
        blog.excerpt.toLowerCase().includes(debouncedQuery.toLowerCase());
      
      const matchesTag = activeTag === 'All' || blog.tags.includes(activeTag);
      
      return matchesSearch && matchesTag;
    });
  }, [debouncedQuery, activeTag]);

  const clearFilters = () => {
    setSearchQuery('');
    setActiveTag('All');
  };

  return (
    <PageTransition>
      <SEOMeta
        title="Home Healthcare Blog | Tips & Guides by 99 Care Surat"
        description="Read expert articles on home nursing, wound care, maternity care, and elderly care in Surat. Healthcare tips from the 99 Care team."
        canonical="https://99care.org/blog"
      />
      <div className="w-full bg-slate-50/60 dark:bg-slate-950 min-h-screen pb-32">
        {/* SECTION 1 — HERO HEADER */}
        <section className="relative pt-32 pb-20 px-6 text-center bg-gradient-to-b from-blue-50/60 via-white to-slate-50/60 dark:from-slate-900 dark:via-slate-950 dark:to-slate-950 border-b border-gray-200/60 dark:border-slate-800 overflow-hidden">
          <div className="absolute top-10 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-brand-blue/5 blur-[120px] rounded-full pointer-events-none"></div>

          <div className="max-w-4xl mx-auto relative z-10">
            <AnimateOnScroll variants={{ hidden: { opacity: 0, y: -10 }, visible: { opacity: 1, y: 0, transition: { duration: 0.4 } } }}>
              <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-brand-blue/10 text-brand-blue dark:text-teal-400 text-xs font-bold uppercase tracking-wider mb-4">
                <Sparkles className="w-3.5 h-3.5" /> Health & Care Knowledge Base
              </span>
            </AnimateOnScroll>
            <AnimateOnScroll variants={fadeUp} delay={0.1}>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-gray-900 dark:text-white mb-6 tracking-tight leading-tight">
                Insights & Healthcare Articles
              </h1>
            </AnimateOnScroll>
            <AnimateOnScroll variants={fadeUp} delay={0.2}>
              <p className="text-lg sm:text-xl text-gray-600 dark:text-gray-300 font-light max-w-2xl mx-auto mb-10 leading-relaxed">
                Expert advice, health tips, and guides to help you navigate home healthcare with complete confidence.
              </p>
            </AnimateOnScroll>

            {/* SEARCH & FILTERS */}
            <div className="flex flex-col items-center gap-8 mt-4">
              {/* Search Bar */}
              <div className="relative w-full max-w-lg group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-brand-blue transition-colors" />
                <Input
                  type="text"
                  placeholder="Search health guides & care tips..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-12 pr-12 h-14 rounded-full border-gray-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 text-base shadow-sm focus-visible:ring-brand-blue focus-visible:ring-2"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-4 top-1/2 -translate-y-1/2 p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-400 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Tag Pills */}
              <div className="flex flex-wrap justify-center gap-2 max-w-4xl">
                {allTags.map((tag) => {
                  const isSelected = activeTag === tag;
                  return (
                    <button
                      key={tag}
                      onClick={() => setActiveTag(tag)}
                      className={`px-5 py-2 rounded-full text-xs font-bold transition-all duration-200 ${
                        isSelected
                          ? 'bg-brand-blue text-white shadow-md'
                          : 'bg-white dark:bg-slate-900 border border-gray-200/80 dark:border-slate-800 text-gray-600 dark:text-gray-300 hover:border-brand-blue/40 shadow-sm'
                      }`}
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 2 — BLOG GRID */}
        <section className="pt-16 px-6">
          <div className="container mx-auto max-w-6xl">
            {/* Results Count */}
            {(searchQuery || activeTag !== 'All') && (
              <div className="mb-10 text-center md:text-left">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Showing <span className="text-gray-900 dark:text-white font-bold">{filteredBlogs.length}</span> of {blogs.length} articles
                </p>
              </div>
            )}

            <AnimatePresence mode="popLayout">
              {filteredBlogs.length > 0 ? (
                <motion.div 
                  key="grid"
                  variants={staggerContainer} 
                  initial="hidden" 
                  animate="visible" 
                  className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-10"
                >
                  {filteredBlogs.map((blog) => (
                    <motion.article 
                      key={blog.slug} 
                      layout
                      variants={staggerItem} 
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.2 }}
                      className="group cursor-pointer h-full"
                    >
                      <motion.div 
                        whileHover={{ y: -6, boxShadow: '0 20px 40px rgba(27, 108, 168, 0.12)' }}
                        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                        className="bg-white dark:bg-slate-900 rounded-3xl border border-gray-200/80 dark:border-slate-800 overflow-hidden h-full flex flex-col shadow-sm hover:shadow-md transition-all"
                      >
                        <Link to={`/blog/${blog.slug}`} className="block h-full flex flex-col">
                          {/* Blog Image */}
                          <div className="aspect-[16/10] bg-slate-100 dark:bg-slate-800 overflow-hidden relative border-b border-gray-100 dark:border-slate-800">
                            <img 
                              src={blog.image} 
                              alt={blog.title}
                              className="w-full h-full object-cover object-top transition-transform duration-500 group-hover:scale-105"
                            />
                          </div>
                          
                          <div className="p-7 flex flex-col flex-1">
                            {/* Meta Tags */}
                            <div className="flex items-center gap-4 text-xs font-semibold text-brand-blue dark:text-teal-400 mb-3 tracking-wide uppercase">
                              <div className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" /> {blog.date}</div>
                              <div className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> {blog.readTime}</div>
                            </div>
                            
                            {/* Title & Excerpt */}
                            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white leading-snug mb-3 group-hover:text-brand-blue transition-colors">
                              {blog.title}
                            </h2>
                            <p className="text-gray-600 dark:text-gray-400 text-sm sm:text-base leading-relaxed mb-6 flex-1 font-light">
                              {blog.excerpt}
                            </p>
                            
                            {/* Read More Link */}
                            <div className="text-brand-blue font-semibold text-sm flex items-center gap-1 group-hover:gap-2 transition-all mt-auto pt-4 border-t border-gray-100 dark:border-slate-800">
                              <span>Read Full Article</span>
                              <ChevronRight className="w-4 h-4" />
                            </div>
                          </div>
                        </Link>
                      </motion.div>
                    </motion.article>
                  ))}
                </motion.div>
              ) : (
                <motion.div 
                  key="empty"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="flex flex-col items-center justify-center py-20 text-center bg-white dark:bg-slate-900 rounded-3xl border border-gray-200/80 dark:border-slate-800"
                >
                  <div className="w-20 h-20 bg-brand-blue/10 rounded-full flex items-center justify-center mb-6 text-brand-blue">
                    <Search className="w-10 h-10" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">No articles found</h3>
                  <p className="text-gray-500 dark:text-gray-400 max-w-xs mb-8">
                    Try a different search term or browse all articles by clearing filters.
                  </p>
                  <Button 
                    onClick={clearFilters}
                    className="rounded-full px-8 bg-brand-blue hover:bg-brand-blue/90 text-white"
                  >
                    Clear all filters
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </section>
      </div>
    </PageTransition>
  );
}
