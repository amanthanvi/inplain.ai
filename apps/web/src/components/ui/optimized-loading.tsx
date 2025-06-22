'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

interface OptimizedLoadingProps {
  isLoading: boolean;
  delay?: number; // Delay before showing loader
  minDisplay?: number; // Minimum display time
  fallback?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function OptimizedLoading({
  isLoading,
  delay = 200,
  minDisplay = 300,
  fallback,
  children,
  className
}: OptimizedLoadingProps) {
  const [showLoader, setShowLoader] = useState(false);
  const [minTimeElapsed, setMinTimeElapsed] = useState(false);

  useEffect(() => {
    let delayTimer: NodeJS.Timeout | undefined;
    let minTimer: NodeJS.Timeout | undefined;

    if (isLoading) {
      // Delay showing the loader
      delayTimer = setTimeout(() => {
        setShowLoader(true);
        // Start minimum display timer
        minTimer = setTimeout(() => {
          setMinTimeElapsed(true);
        }, minDisplay);
      }, delay);
    } else {
      // Clear delay timer if loading finished before delay
      if (delayTimer) clearTimeout(delayTimer);
      
      // If loader was shown, wait for minimum display time
      if (showLoader && !minTimeElapsed) {
        const waitTime = minDisplay - delay;
        minTimer = setTimeout(() => {
          setShowLoader(false);
          setMinTimeElapsed(false);
        }, waitTime > 0 ? waitTime : 0);
      } else {
        setShowLoader(false);
        setMinTimeElapsed(false);
      }
    }

    return () => {
      if (delayTimer) clearTimeout(delayTimer);
      if (minTimer) clearTimeout(minTimer);
    };
  }, [isLoading, delay, minDisplay, showLoader, minTimeElapsed]);

  return (
    <AnimatePresence mode="wait">
      {showLoader ? (
        <motion.div
          key="loader"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className={className}
        >
          {fallback || <DefaultLoader />}
        </motion.div>
      ) : (
        <motion.div
          key="content"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2 }}
          className={className}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Default loader component
function DefaultLoader() {
  return (
    <div className="flex items-center justify-center p-8">
      <div className="relative">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        <div className="absolute inset-0 rounded-full h-12 w-12 border-2 border-primary/20"></div>
      </div>
    </div>
  );
}

// Skeleton loader components
export function SkeletonText({ 
  lines = 1, 
  className 
}: { 
  lines?: number; 
  className?: string 
}) {
  return (
    <div className={cn("space-y-2", className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className={cn(
            "h-4 bg-muted rounded animate-pulse",
            i === lines - 1 && lines > 1 && "w-3/4"
          )}
        />
      ))}
    </div>
  );
}

export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn("rounded-lg border bg-card p-6 space-y-4", className)}>
      <div className="flex items-center justify-between">
        <div className="h-6 w-1/3 bg-muted rounded animate-pulse" />
        <div className="h-6 w-16 bg-muted rounded animate-pulse" />
      </div>
      <SkeletonText lines={3} />
      <div className="flex gap-2">
        <div className="h-8 w-20 bg-muted rounded animate-pulse" />
        <div className="h-8 w-20 bg-muted rounded animate-pulse" />
      </div>
    </div>
  );
}

// Progressive image loading
export function ProgressiveImage({
  src,
  alt,
  placeholder,
  className
}: {
  src: string;
  alt: string;
  placeholder?: string;
  className?: string;
}) {
  const [imgSrc, setImgSrc] = useState(placeholder || '');
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const img = new Image();
    img.src = src;
    img.onload = () => {
      setImgSrc(src);
      setIsLoaded(true);
    };
  }, [src]);

  return (
    <div className={cn("relative overflow-hidden", className)}>
      <img
        src={imgSrc}
        alt={alt}
        className={cn(
          "transition-all duration-300",
          !isLoaded && placeholder && "filter blur-sm scale-105"
        )}
      />
      {!isLoaded && !placeholder && (
        <div className="absolute inset-0 bg-muted animate-pulse" />
      )}
    </div>
  );
}

// List virtualization for performance
export function VirtualizedList<T>({
  items,
  renderItem,
  itemHeight,
  containerHeight,
  className
}: {
  items: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  itemHeight: number;
  containerHeight: number;
  className?: string;
}) {
  const [scrollTop, setScrollTop] = useState(0);
  
  const startIndex = Math.floor(scrollTop / itemHeight);
  const endIndex = Math.min(
    items.length - 1,
    Math.ceil((scrollTop + containerHeight) / itemHeight)
  );
  
  const visibleItems = items.slice(startIndex, endIndex + 1);
  const totalHeight = items.length * itemHeight;
  const offsetY = startIndex * itemHeight;

  return (
    <div
      className={cn("relative overflow-auto", className)}
      style={{ height: containerHeight }}
      onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
    >
      <div style={{ height: totalHeight }}>
        <div
          style={{
            transform: `translateY(${offsetY}px)`
          }}
        >
          {visibleItems.map((item, index) => (
            <div
              key={startIndex + index}
              style={{ height: itemHeight }}
            >
              {renderItem(item, startIndex + index)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Lazy loading wrapper
export function LazyLoad({
  children,
  threshold = 0.1,
  rootMargin = '50px'
}: {
  children: React.ReactNode;
  threshold?: number;
  rootMargin?: string;
}) {
  const [isVisible, setIsVisible] = useState(false);
  const [ref, setRef] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!ref) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry && entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold, rootMargin }
    );

    observer.observe(ref);

    return () => observer.disconnect();
  }, [ref, threshold, rootMargin]);

  return (
    <div ref={setRef}>
      {isVisible ? children : <div className="min-h-[200px]" />}
    </div>
  );
}