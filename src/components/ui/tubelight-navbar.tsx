"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { Link, useLocation } from "react-router-dom"
import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

interface NavItem {
  name: string
  url: string
  icon: LucideIcon
  /** Optional dropdown content rendered below the nav item */
  dropdown?: React.ReactNode
}

interface NavBarProps {
  items: NavItem[]
  className?: string
}

export function TubelightNavbar({ items, className }: NavBarProps) {
  const location = useLocation()
  
  const [activeTab, setActiveTab] = useState(() => {
    const currentPath = location.pathname;
    const activeItem = items.find(item => 
      item.url === currentPath || 
      (item.url !== '/' && currentPath.startsWith(item.url))
    );
    return activeItem ? activeItem.name : items[0].name;
  })

  useEffect(() => {
    const currentPath = location.pathname;
    const activeItem = items.find(item => 
      item.url === currentPath || 
      (item.url !== '/' && currentPath.startsWith(item.url))
    );
    if(activeItem) {
        setActiveTab(activeItem.name);
    }
  }, [location.pathname, items])

  const [, setIsMobile] = useState(false)

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768)
    }

    handleResize()
    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [])

  return (
    <div
      className={cn(
        "relative",
        className,
      )}
    >
      <div className="flex items-center gap-1 sm:gap-3 py-1 px-1 rounded-full">
        {items.map((item) => {
          const Icon = item.icon
          const isActive = activeTab === item.name

          // If this item has a dropdown, render a group with hover behavior
          if (item.dropdown) {
            return (
              <div key={item.name} className="group relative py-2">
                <Link
                  to={item.url}
                  onClick={() => setActiveTab(item.name)}
                  className={cn(
                    "relative cursor-pointer text-sm font-semibold px-4 sm:px-6 py-2 rounded-full transition-colors flex items-center gap-1",
                    "text-gray-600 dark:text-gray-300 hover:text-brand-blue",
                    isActive && "text-brand-blue font-bold",
                  )}
                >
                  <span className="hidden md:inline">{item.name}</span>
                  <span className="md:hidden">
                    <Icon size={18} strokeWidth={2.5} />
                  </span>
                  {/* Dropdown chevron */}
                  <svg className="hidden md:inline w-3.5 h-3.5 text-gray-400 group-hover:text-brand-blue transition-colors mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                  {isActive && (
                    <motion.div
                      layoutId="lamp"
                      className="absolute inset-0 w-full bg-brand-light-blue/20 rounded-full -z-10"
                      initial={false}
                      transition={{
                        type: "spring",
                        stiffness: 300,
                        damping: 30,
                      }}
                    >
                      <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-8 h-1 bg-brand-blue rounded-t-full">
                        <div className="absolute w-12 h-6 bg-brand-blue/20 rounded-full blur-md -top-2 -left-2" />
                        <div className="absolute w-8 h-6 bg-brand-blue/20 rounded-full blur-md -top-1" />
                        <div className="absolute w-4 h-4 bg-brand-blue/20 rounded-full blur-sm top-0 left-2" />
                      </div>
                    </motion.div>
                  )}
                </Link>
                {/* Dropdown panel */}
                <div className="absolute top-full left-0 mt-0 w-64 opacity-0 translate-y-2 pointer-events-none group-hover:opacity-100 group-hover:translate-y-0 group-hover:pointer-events-auto transition-all duration-200 ease-out delay-0 group-hover:delay-0 [&]:delay-100 z-50">
                  {item.dropdown}
                </div>
              </div>
            )
          }

          return (
            <Link
              key={item.name}
              to={item.url}
              onClick={() => setActiveTab(item.name)}
              className={cn(
                "relative cursor-pointer text-sm font-semibold px-4 sm:px-6 py-2 rounded-full transition-colors",
                "text-gray-600 dark:text-gray-300 hover:text-brand-blue",
                isActive && "text-brand-blue font-bold",
              )}
            >
              <span className="hidden md:inline">{item.name}</span>
              <span className="md:hidden">
                <Icon size={18} strokeWidth={2.5} />
              </span>
              {isActive && (
                <motion.div
                  layoutId="lamp"
                  className="absolute inset-0 w-full bg-brand-light-blue/20 rounded-full -z-10"
                  initial={false}
                  transition={{
                    type: "spring",
                    stiffness: 300,
                    damping: 30,
                  }}
                >
                  <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-8 h-1 bg-brand-blue rounded-t-full">
                    <div className="absolute w-12 h-6 bg-brand-blue/20 rounded-full blur-md -top-2 -left-2" />
                    <div className="absolute w-8 h-6 bg-brand-blue/20 rounded-full blur-md -top-1" />
                    <div className="absolute w-4 h-4 bg-brand-blue/20 rounded-full blur-sm top-0 left-2" />
                  </div>
                </motion.div>
              )}
            </Link>
          )
        })}
      </div>
    </div>
  )
}
