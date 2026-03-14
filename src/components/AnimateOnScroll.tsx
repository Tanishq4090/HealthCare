import { motion, useInView } from 'framer-motion'
import { useRef } from 'react'
import type { ReactNode } from 'react'
import type { Variants } from 'framer-motion'
import { fadeUp } from '@/lib/animations'

interface Props {
  children: ReactNode
  variants?: Variants
  className?: string
  delay?: number
}

export function AnimateOnScroll({ children, variants = fadeUp, className, delay = 0 }: Props) {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: '-80px' })
  return (
    <motion.div
      ref={ref}
      initial="hidden"
      animate={isInView ? 'visible' : 'hidden'}
      variants={variants}
      transition={{ delay }}
      className={className}
    >
      {children}
    </motion.div>
  )
}
