'use client';

import { motion } from 'framer-motion';
import { Card } from './card';
import { cn } from '@/lib/utils';

interface AnimatedCardProps extends React.ComponentProps<typeof Card> {
  children: React.ReactNode;
  delay?: number;
  duration?: number;
}

export function AnimatedCard({ 
  children, 
  className, 
  delay = 0, 
  duration = 0.5,
  ...props 
}: AnimatedCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration, delay }}
    >
      <Card className={cn("transition-shadow hover:shadow-lg", className)} {...props}>
        {children}
      </Card>
    </motion.div>
  );
}