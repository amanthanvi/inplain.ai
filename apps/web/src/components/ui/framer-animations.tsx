'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { ReactNode } from 'react'

// Animation variants
export const fadeIn = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 }
}

export const slideUp = {
  initial: { y: 20, opacity: 0 },
  animate: { y: 0, opacity: 1 },
  exit: { y: -20, opacity: 0 }
}

export const slideDown = {
  initial: { y: -20, opacity: 0 },
  animate: { y: 0, opacity: 1 },
  exit: { y: 20, opacity: 0 }
}

export const slideLeft = {
  initial: { x: 20, opacity: 0 },
  animate: { x: 0, opacity: 1 },
  exit: { x: -20, opacity: 0 }
}

export const slideRight = {
  initial: { x: -20, opacity: 0 },
  animate: { x: 0, opacity: 1 },
  exit: { x: 20, opacity: 0 }
}

export const scaleIn = {
  initial: { scale: 0.9, opacity: 0 },
  animate: { scale: 1, opacity: 1 },
  exit: { scale: 0.9, opacity: 0 }
}

export const rotateIn = {
  initial: { rotate: -180, scale: 0.5, opacity: 0 },
  animate: { rotate: 0, scale: 1, opacity: 1 },
  exit: { rotate: 180, scale: 0.5, opacity: 0 }
}

// Stagger container for children animations
export const staggerContainer = {
  initial: {},
  animate: {
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.1
    }
  }
}

// Spring configurations
export const springConfig = {
  type: "spring",
  stiffness: 300,
  damping: 30
}

export const smoothSpring = {
  type: "spring",
  stiffness: 100,
  damping: 20
}

// Component wrappers
interface AnimatedProps {
  children: ReactNode
  className?: string
  delay?: number
  duration?: number
}

export function FadeIn({ children, className, delay = 0, duration = 0.5 }: AnimatedProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration, delay }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

export function SlideIn({ 
  children, 
  className, 
  delay = 0, 
  duration = 0.5,
  direction = 'up' 
}: AnimatedProps & { direction?: 'up' | 'down' | 'left' | 'right' }) {
  const variants = {
    up: slideUp,
    down: slideDown,
    left: slideLeft,
    right: slideRight
  }
  
  return (
    <motion.div
      variants={variants[direction]}
      initial="initial"
      animate="animate"
      transition={{ duration, delay, ...smoothSpring }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

export function ScaleIn({ children, className, delay = 0, duration = 0.5 }: AnimatedProps) {
  return (
    <motion.div
      variants={scaleIn}
      initial="initial"
      animate="animate"
      transition={{ duration, delay, ...springConfig }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

export function StaggerChildren({ children, className }: AnimatedProps) {
  return (
    <motion.div
      variants={staggerContainer}
      initial="initial"
      animate="animate"
      className={className}
    >
      {children}
    </motion.div>
  )
}

// Hover animations
export function HoverScale({ children, className, scale = 1.05 }: AnimatedProps & { scale?: number }) {
  return (
    <motion.div
      whileHover={{ scale }}
      whileTap={{ scale: 0.95 }}
      transition={springConfig}
      className={className}
    >
      {children}
    </motion.div>
  )
}

export function HoverGlow({ children, className }: AnimatedProps) {
  return (
    <motion.div
      whileHover={{
        boxShadow: "0 0 25px rgba(59, 130, 246, 0.5)",
        transition: { duration: 0.3 }
      }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

// Page transitions
export function PageTransition({ children }: { children: ReactNode }) {
  return (
    <AnimatePresence mode="wait">
      <motion.div
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

// Loading skeleton animation
export function SkeletonLoader({ className }: { className?: string }) {
  return (
    <motion.div
      animate={{
        backgroundPosition: ["0% 0%", "100% 0%", "0% 0%"]
      }}
      transition={{
        duration: 1.5,
        repeat: Infinity,
        ease: "linear"
      }}
      className={`bg-gradient-to-r from-muted via-muted-foreground/10 to-muted bg-[length:200%_100%] ${className}`}
    />
  )
}

// Floating animation for decorative elements
export function FloatingElement({ children, className, delay = 0 }: AnimatedProps) {
  return (
    <motion.div
      animate={{
        y: [0, -10, 0],
      }}
      transition={{
        duration: 3,
        repeat: Infinity,
        delay,
        ease: "easeInOut"
      }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

// Pulse animation for attention
export function PulseAnimation({ children, className }: AnimatedProps) {
  return (
    <motion.div
      animate={{
        scale: [1, 1.05, 1],
        opacity: [1, 0.8, 1]
      }}
      transition={{
        duration: 2,
        repeat: Infinity,
        ease: "easeInOut"
      }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

// Reveal on scroll
export function RevealOnScroll({ children, className }: AnimatedProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 50 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.6, ...smoothSpring }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

// Number counter animation
interface CounterProps {
  from?: number
  to: number
  duration?: number
  className?: string
}

export function Counter({ from = 0, to, duration = 2, className }: CounterProps) {
  return (
    <motion.span
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className={className}
    >
      <motion.span
        initial={{ count: from }}
        animate={{ count: to }}
        transition={{ duration, ease: "easeOut" }}
      >
        {(props: any) => Math.floor(props.count)}
      </motion.span>
    </motion.span>
  )
}

// Gradient background animation
export function GradientBackground({ children, className }: AnimatedProps) {
  return (
    <motion.div
      animate={{
        background: [
          "linear-gradient(to right, hsl(var(--primary)), hsl(var(--secondary)))",
          "linear-gradient(to right, hsl(var(--secondary)), hsl(var(--accent)))",
          "linear-gradient(to right, hsl(var(--accent)), hsl(var(--primary)))"
        ]
      }}
      transition={{
        duration: 10,
        repeat: Infinity,
        ease: "linear"
      }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

// Spotlight effect
export function Spotlight({ children, className }: AnimatedProps) {
  return (
    <motion.div
      className={`relative overflow-hidden ${className}`}
      onMouseMove={(e) => {
        const rect = e.currentTarget.getBoundingClientRect()
        const x = e.clientX - rect.left
        const y = e.clientY - rect.top
        e.currentTarget.style.setProperty('--spotlight-x', `${x}px`)
        e.currentTarget.style.setProperty('--spotlight-y', `${y}px`)
      }}
      style={{
        background: `radial-gradient(circle at var(--spotlight-x, 50%) var(--spotlight-y, 50%), rgba(59, 130, 246, 0.15), transparent 60%)`
      }}
    >
      {children}
    </motion.div>
  )
}

// Parallax scroll effect
export function ParallaxScroll({ children, className, offset = 50 }: AnimatedProps & { offset?: number }) {
  return (
    <motion.div
      initial={{ y: -offset }}
      animate={{ y: offset }}
      transition={{
        repeat: Infinity,
        repeatType: "mirror",
        duration: 20,
        ease: "linear"
      }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

// Text reveal animation
export function TextReveal({ text, className }: { text: string; className?: string }) {
  const words = text.split(' ')
  
  return (
    <motion.div className={className}>
      {words.map((word, index) => (
        <motion.span
          key={index}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: 0.5,
            delay: index * 0.1,
            ease: "easeOut"
          }}
          className="inline-block mr-1"
        >
          {word}
        </motion.span>
      ))}
    </motion.div>
  )
}

// Marquee animation
export function Marquee({ children, className, duration = 20 }: AnimatedProps & { duration?: number }) {
  return (
    <div className={`overflow-hidden ${className}`}>
      <motion.div
        animate={{ x: ["0%", "-100%"] }}
        transition={{
          duration,
          repeat: Infinity,
          ease: "linear"
        }}
        className="flex gap-4"
      >
        {children}
        {children}
      </motion.div>
    </div>
  )
}