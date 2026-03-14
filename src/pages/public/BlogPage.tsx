import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, Clock, ChevronRight, Search, X } from 'lucide-react';
import { blogs } from '@/data/blogs';
import { motion, AnimatePresence } from 'framer-motion';
import { PageTransition } from '@/components/PageTransition';
import { AnimateOnScroll } from '@/components/AnimateOnScroll';
import { fadeUp, staggerContainer, staggerItem } from '@/lib/animations';
import { useDebounce } from '@/hooks/useDebounce';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

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
      <div className="w-full bg-white dark:bg-slate-950 min-h-screen pb-32">
        {/* SECTION 1 — HERO */}
        <section className="pt-32 pb-16 px-6 text-center border-b border-gray-100 dark:border-slate-800">
          <div className="max-w-3xl mx-auto">
            <AnimateOnScroll variants={{ hidden: { opacity: 0 }, visible: { opacity: 1, transition: { duration: 0.5 } } }}>
              <span className="text-brand-blue text-xs font-bold uppercase tracking-[0.2em] mb-4 block">Health & Care</span>
            </AnimateOnScroll>
            <AnimateOnScroll variants={fadeUp} delay={0.1}>
              <h1 className="text-4xl md:text-5xl font-extrabold text-gray-900 dark:text-white mb-6 tracking-tight">
                Insights & Articles
              </h1>
            </AnimateOnScroll>
            <AnimateOnScroll variants={fadeUp} delay={0.2}>
              <p className="text-lg text-gray-500 dark:text-gray-400 font-light max-w-2xl mx-auto mb-10">
                Expert advice, health tips, and stories to help you navigate home healthcare with confidence.
              </p>
            </AnimateOnScroll>

            {/* SEARCH & FILTERS */}
            <div className="flex flex-col items-center gap-8 mt-4">
              {/* Search Bar */}
              <div className="relative w-full max-w-md group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-brand-blue transition-colors" />
                <Input
                  type="text"
                  placeholder="Search articles..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-11 pr-11 h-12 rounded-full border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-900 focus-visible:ring-brand-blue"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-4 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-gray-200 dark:hover:bg-slate-800 text-gray-400 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
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
                      className={`relative px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-300 border ${
                        isSelected
                          ? 'bg-brand-blue text-white border-brand-blue shadow-sm'
                          : 'bg-gray-100 dark:bg-slate-900 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-slate-800 hover:border-brand-blue/30'
                      }`}
                    >
                      {isSelected && (
                        <motion.span
                          layoutId="activeTag"
                          className="absolute inset-0 bg-brand-blue rounded-full -z-10"
                          transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
                        />
                      )}
                      {tag}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 2 — BLOG GRID */}
        <section className="pt-12 px-6">
          <div className="container mx-auto max-w-5xl">
            {/* Results Count */}
            {(searchQuery || activeTag !== 'All') && (
              <div className="mb-8 text-center md:text-left">
                <p className="text-sm text-gray-400 dark:text-gray-500">
                  Showing <span className="text-gray-900 dark:text-white font-semibold">{filteredBlogs.length}</span> of {blogs.length} articles
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
                  className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-16"
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
                      className="group cursor-pointer"
                    >
                      <motion.div 
                        whileHover={{ y: -6, boxShadow: '0 20px 40px rgba(27, 108, 168, 0.10)' }}
                        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                        className="h-full rounded-2xl p-4 -m-4 transition-all"
                      >
                        <Link to={`/blog/${blog.slug}`} className="block h-full flex flex-col">
                          {/* Blog Image */}
                          <div className="aspect-video bg-gray-50 dark:bg-slate-900 rounded-2xl overflow-hidden mb-6 relative border border-gray-100 dark:border-slate-800 group-hover:shadow-md transition-all duration-300">
                            <img 
                              src={blog.image} 
                              alt={blog.title}
                              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                          </div>
                          
                          {/* Meta Tags */}
                          <div className="flex items-center gap-4 text-xs font-medium text-gray-400 dark:text-gray-500 mb-4 tracking-wide uppercase mt-4">
                            <div className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" /> {blog.date}</div>
                            <div className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> {blog.readTime}</div>
                          </div>
                          
                          {/* Title & Excerpt */}
                          <h2 className="text-2xl font-bold text-gray-900 dark:text-white leading-snug mb-3 group-hover:text-brand-blue transition-colors">
                            {blog.title}
                          </h2>
                          <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed mb-5 flex-1 line-clamp-2">
                            {blog.excerpt}
                          </p>
                          
                          {/* Read More Link */}
                          <div className="text-brand-blue font-semibold text-sm flex items-center gap-1 group-hover:gap-2 transition-all mt-auto w-fit">
                            <motion.span whileHover={{ x: 4 }} transition={{ duration: 0.2 }} className="flex items-center gap-1">Read Article <ChevronRight className="w-4 h-4" /></motion.span>
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
                  className="flex flex-col items-center justify-center py-20 text-center"
                >
                  <div className="w-20 h-20 bg-gray-50 dark:bg-slate-900 rounded-full flex items-center justify-center mb-6 text-gray-300 dark:text-gray-700">
                    <Search className="w-10 h-10" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">No articles found</h3>
                  <p className="text-gray-500 dark:text-gray-400 max-w-xs mb-8">
                    Try a different search term or browse all articles by clearing filters.
                  </p>
                  <Button 
                    onClick={clearFilters}
                    variant="outline"
                    className="rounded-full px-8 dark:border-slate-800"
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
