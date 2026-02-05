import { motion } from 'framer-motion';
import type { ReactNode } from 'react';
import { cn } from '../../lib/utils';

interface AnimatedCardProps {
  children: ReactNode;
  className?: string;
  delay?: number;
  hover?: boolean;
}

export function AnimatedCard({
  children,
  className,
  delay = 0,
  hover = false,
}: AnimatedCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.25, delay, ease: 'easeOut' }}
      whileHover={hover ? { scale: 1.01, transition: { duration: 0.15 } } : undefined}
      className={cn(
        'bg-card border border-border rounded-xl overflow-hidden',
        className,
      )}
    >
      {children}
    </motion.div>
  );
}
