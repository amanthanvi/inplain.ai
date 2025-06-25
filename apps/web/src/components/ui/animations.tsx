'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'

export const fadeIn = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 }
}

export const slideIn = {
  initial: { x: -20, opacity: 0 },
  animate: { x: 0, opacity: 1 },
  exit: { x: 20, opacity: 0 }
}

export const slideUp = {
  initial: { y: 20, opacity: 0 },
  animate: { y: 0, opacity: 1 },
  exit: { y: -20, opacity: 0 }
}

export const scaleIn = {
  initial: { scale: 0.9, opacity: 0 },
  animate: { scale: 1, opacity: 1 },
  exit: { scale: 0.9, opacity: 0 }
}

export const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.1
    }
  }
}

interface AnimatedContainerProps {
  children: React.ReactNode
  className?: string
  delay?: number
  animation?: 'fade' | 'slide' | 'slideUp' | 'scale'
}

export function AnimatedContainer({ 
  children, 
  className, 
  delay = 0,
  animation = 'fade' 
}: AnimatedContainerProps) {
  const animations = {
    fade: fadeIn,
    slide: slideIn,
    slideUp: slideUp,
    scale: scaleIn
  }

  return (
    <motion.div
      className={className}
      initial={animations[animation].initial}
      animate={animations[animation].animate}
      exit={animations[animation].exit}
      transition={{ duration: 0.3, delay }}
    >
      {children}
    </motion.div>
  )
}

interface AnimatedListProps {
  children: React.ReactNode[]
  className?: string
  itemClassName?: string
  staggerDelay?: number
}

export function AnimatedList({ 
  children, 
  className, 
  itemClassName,
  staggerDelay = 0.1 
}: AnimatedListProps) {
  return (
    <motion.div 
      className={className}
      variants={staggerContainer}
      initial="initial"
      animate="animate"
    >
      {children.map((child, i) => (
        <motion.div
          key={i}
          className={itemClassName}
          variants={slideUp}
          transition={{ delay: i * staggerDelay }}
        >
          {child}
        </motion.div>
      ))}
    </motion.div>
  )
}

interface PulseProps {
  children: React.ReactNode
  className?: string
  duration?: number
}

export function Pulse({ children, className, duration = 2 }: PulseProps) {
  return (
    <motion.div
      className={className}
      animate={{
        scale: [1, 1.05, 1],
        opacity: [1, 0.8, 1]
      }}
      transition={{
        duration,
        repeat: Infinity,
        ease: "easeInOut"
      }}
    >
      {children}
    </motion.div>
  )
}

interface ShimmerProps {
  className?: string
}

export function Shimmer({ className }: ShimmerProps) {
  return (
    <div className={cn("relative overflow-hidden", className)}>
      <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/20 to-transparent" />
    </div>
  )
}

export function SuccessAnimation() {
  return (
    <motion.div
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      transition={{
        type: "spring",
        stiffness: 260,
        damping: 20
      }}
    >
      <motion.svg
        className="w-16 h-16 text-green-600"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <motion.path
          d="M20 6L9 17l-5-5"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        />
      </motion.svg>
    </motion.div>
  )
}

export function ErrorAnimation() {
  return (
    <motion.div
      initial={{ scale: 0, rotate: 0 }}
      animate={{ scale: 1, rotate: 180 }}
      transition={{
        type: "spring",
        stiffness: 260,
        damping: 20
      }}
    >
      <svg
        className="w-16 h-16 text-red-600"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <circle cx="12" cy="12" r="10" />
        <line x1="15" y1="9" x2="9" y2="15" />
        <line x1="9" y1="9" x2="15" y2="15" />
      </svg>
    </motion.div>
  )
}

interface PageTransitionProps {
  children: React.ReactNode
  className?: string
}

export function PageTransition({ children, className }: PageTransitionProps) {
  return (
    <AnimatePresence mode="wait">
      <motion.div
        className={className}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        transition={{ duration: 0.3 }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  )
}

// Add shimmer animation to tailwind.config.js:
// animation: {
//   shimmer: "shimmer 2s linear infinite",
// },
// keyframes: {
//   shimmer: {
//     from: { transform: "translateX(-100%)" },
//     to: { transform: "translateX(100%)" },
//   },
// }