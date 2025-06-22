'use client';

import { motion, AnimatePresence, Variants } from 'framer-motion';
import { ReactNode, useState } from 'react';
import { cn } from '@/lib/utils';

// Animation variants
const fadeInUp: Variants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 }
};

const fadeInScale: Variants = {
  initial: { opacity: 0, scale: 0.9 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.9 }
};

const slideInLeft: Variants = {
  initial: { opacity: 0, x: -20 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: 20 }
};

const slideInRight: Variants = {
  initial: { opacity: 0, x: 20 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -20 }
};

const staggerContainer: Variants = {
  initial: {},
  animate: {
    transition: {
      staggerChildren: 0.1
    }
  }
};

// Animated Card Component
export function AnimatedCard({
  children,
  className,
  delay = 0,
  hover = true
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  hover?: boolean;
}) {
  return (
    <motion.div
      variants={fadeInScale}
      initial="initial"
      animate="animate"
      transition={{ duration: 0.3, delay }}
      whileHover={hover ? { scale: 1.02, transition: { duration: 0.2 } } : undefined}
      className={cn(
        'rounded-xl border bg-card p-6 shadow-sm transition-shadow hover:shadow-lg',
        className
      )}
    >
      {children}
    </motion.div>
  );
}

// Animated Button Component
export function AnimatedButton({
  children,
  className,
  onClick,
  variant = 'primary',
  size = 'medium',
  disabled = false
}: {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'small' | 'medium' | 'large';
  disabled?: boolean;
}) {
  const variants = {
    primary: 'bg-primary text-primary-foreground hover:bg-primary/90',
    secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
    ghost: 'hover:bg-accent hover:text-accent-foreground',
    danger: 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
  };

  const sizes = {
    small: 'px-3 py-1.5 text-sm',
    medium: 'px-4 py-2',
    large: 'px-6 py-3 text-lg'
  };

  return (
    <motion.button
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 400, damping: 17 }}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'inline-flex items-center justify-center rounded-lg font-medium transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
        'disabled:pointer-events-none disabled:opacity-50',
        variants[variant],
        sizes[size],
        className
      )}
    >
      {children}
    </motion.button>
  );
}

// Animated List Component
export function AnimatedList({
  children,
  className
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      variants={staggerContainer}
      initial="initial"
      animate="animate"
      className={className}
    >
      {children}
    </motion.div>
  );
}

// Animated List Item Component
export function AnimatedListItem({
  children,
  className
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      variants={fadeInUp}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// Animated Badge Component
export function AnimatedBadge({
  children,
  variant = 'default',
  className,
  pulse = false
}: {
  children: ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info';
  className?: string;
  pulse?: boolean;
}) {
  const variants = {
    default: 'bg-secondary text-secondary-foreground',
    success: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400',
    warning: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400',
    error: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400',
    info: 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400'
  };

  return (
    <motion.span
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      transition={{ type: 'spring', stiffness: 500, damping: 25 }}
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold',
        variants[variant],
        pulse && 'animate-pulse',
        className
      )}
    >
      {children}
    </motion.span>
  );
}

// Animated Progress Bar Component
export function AnimatedProgress({
  value,
  max = 100,
  className,
  showLabel = false,
  variant = 'default'
}: {
  value: number;
  max?: number;
  className?: string;
  showLabel?: boolean;
  variant?: 'default' | 'success' | 'warning' | 'error';
}) {
  const percentage = (value / max) * 100;
  
  const variants = {
    default: 'bg-primary',
    success: 'bg-green-500',
    warning: 'bg-yellow-500',
    error: 'bg-red-500'
  };

  return (
    <div className={cn('relative w-full overflow-hidden rounded-full bg-secondary', className)}>
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${percentage}%` }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className={cn('h-full rounded-full', variants[variant])}
      />
      {showLabel && (
        <span className="absolute inset-0 flex items-center justify-center text-xs font-medium">
          {Math.round(percentage)}%
        </span>
      )}
    </div>
  );
}

// Animated Skeleton Component
export function AnimatedSkeleton({
  className,
  variant = 'default'
}: {
  className?: string;
  variant?: 'default' | 'text' | 'circular' | 'rectangular';
}) {
  const variants = {
    default: 'h-4 w-full',
    text: 'h-4 w-3/4',
    circular: 'h-12 w-12 rounded-full',
    rectangular: 'h-32 w-full'
  };

  return (
    <motion.div
      animate={{
        backgroundPosition: ['200% 0', '-200% 0']
      }}
      transition={{
        duration: 1.5,
        ease: 'linear',
        repeat: Infinity
      }}
      className={cn(
        'rounded-md bg-gradient-to-r from-transparent via-gray-200 to-transparent dark:via-gray-800',
        'bg-[length:200%_100%] bg-gray-100 dark:bg-gray-900',
        variants[variant],
        className
      )}
    />
  );
}

// Animated Tooltip Component
export function AnimatedTooltip({
  children,
  content,
  side = 'top'
}: {
  children: ReactNode;
  content: string;
  side?: 'top' | 'right' | 'bottom' | 'left';
}) {
  const positions = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2'
  };

  return (
    <div className="group relative inline-block">
      {children}
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          transition={{ duration: 0.15 }}
          className={cn(
            'absolute z-50 hidden rounded-lg bg-gray-900 px-3 py-1.5 text-xs text-white dark:bg-gray-100 dark:text-gray-900',
            'group-hover:block',
            positions[side]
          )}
        >
          {content}
          <div
            className={cn(
              'absolute h-2 w-2 rotate-45 bg-gray-900 dark:bg-gray-100',
              side === 'top' && 'bottom-[-4px] left-1/2 -translate-x-1/2',
              side === 'right' && 'left-[-4px] top-1/2 -translate-y-1/2',
              side === 'bottom' && 'top-[-4px] left-1/2 -translate-x-1/2',
              side === 'left' && 'right-[-4px] top-1/2 -translate-y-1/2'
            )}
          />
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

// Animated Modal Component
export function AnimatedModal({
  isOpen,
  onClose,
  children,
  className
}: {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className={cn(
              'fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2',
              'rounded-xl bg-background p-6 shadow-xl',
              className
            )}
          >
            {children}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// Animated Tabs Component
export function AnimatedTabs({
  tabs,
  defaultTab,
  className
}: {
  tabs: { id: string; label: string; content: ReactNode }[];
  defaultTab?: string;
  className?: string;
}) {
  const [activeTab, setActiveTab] = useState(defaultTab || tabs[0]?.id);

  return (
    <div className={className}>
      <div className="flex space-x-1 rounded-lg bg-muted p-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'relative rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              activeTab === tab.id
                ? 'text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {activeTab === tab.id && (
              <motion.div
                layoutId="activeTab"
                className="absolute inset-0 rounded-md bg-background shadow-sm"
                transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
              />
            )}
            <span className="relative z-10">{tab.label}</span>
          </button>
        ))}
      </div>
      <div className="mt-4">
        <AnimatePresence mode="wait">
          {tabs.map((tab) =>
            tab.id === activeTab ? (
              <motion.div
                key={tab.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                {tab.content}
              </motion.div>
            ) : null
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// Animated Floating Action Button
export function AnimatedFAB({
  icon,
  onClick,
  className
}: {
  icon: ReactNode;
  onClick: () => void;
  className?: string;
}) {
  return (
    <motion.button
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.9 }}
      transition={{ type: 'spring', stiffness: 400, damping: 17 }}
      onClick={onClick}
      className={cn(
        'fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center',
        'rounded-full bg-primary text-primary-foreground shadow-lg',
        'hover:shadow-xl focus:outline-none focus:ring-4 focus:ring-primary/20',
        className
      )}
    >
      {icon}
    </motion.button>
  );
}