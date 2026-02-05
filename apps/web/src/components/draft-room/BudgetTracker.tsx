import { motion } from 'framer-motion';
import { DollarSign, TrendingDown, TrendingUp } from 'lucide-react';
import { AnimatedCard } from './AnimatedCard';
import { cn } from '../../lib/utils';

interface BudgetTrackerProps {
  remaining: number;
  total: number;
  spotsRemaining: number;
}

export function BudgetTracker({ remaining, total, spotsRemaining }: BudgetTrackerProps) {
  const spent = total - remaining;
  const percentSpent = (spent / total) * 100;
  const percentRemaining = (remaining / total) * 100;
  const avgPerSpot = spotsRemaining > 0 ? remaining / spotsRemaining : 0;

  const getStatusColor = () => {
    if (avgPerSpot < 5 && spotsRemaining > 3) return 'text-stat-negative';
    if (avgPerSpot < 10 && spotsRemaining > 5) return 'text-yellow-500';
    return 'text-stat-positive';
  };

  const getBarColor = () => {
    if (percentRemaining < 15) return 'bg-stat-negative';
    if (percentRemaining < 35) return 'bg-yellow-500';
    return 'bg-accent';
  };

  const statusColor = getStatusColor();

  return (
    <AnimatedCard className="p-5" delay={0.05}>
      {/* Header */}
      <div className="flex items-center gap-2.5 mb-4">
        <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
          <DollarSign className="h-4 w-4 text-accent" />
        </div>
        <h3 className="text-base font-semibold text-foreground">Budget</h3>
      </div>

      {/* Animated progress bar */}
      <div className="w-full bg-muted rounded-full h-3 mb-4 overflow-hidden">
        <motion.div
          className={cn('h-full rounded-full', getBarColor())}
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(percentSpent, 100)}%` }}
          transition={{ duration: 0.8, ease: 'easeOut', delay: 0.2 }}
        />
      </div>

      {/* Budget label */}
      <div className="flex justify-between items-baseline mb-4">
        <span className="text-xs text-muted-foreground">
          ${spent} spent of ${total}
        </span>
        <span className="text-xs text-muted-foreground">
          {percentSpent.toFixed(0)}%
        </span>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3">
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="bg-muted/50 rounded-lg p-3"
        >
          <div className="flex items-center gap-1.5 mb-1">
            <TrendingUp className="h-3 w-3 text-muted-foreground" />
            <span className="text-[11px] text-muted-foreground font-medium">Remaining</span>
          </div>
          <p className={cn('text-xl font-bold tabular-nums', statusColor)}>
            ${remaining}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-muted/50 rounded-lg p-3"
        >
          <div className="flex items-center gap-1.5 mb-1">
            <TrendingDown className="h-3 w-3 text-muted-foreground" />
            <span className="text-[11px] text-muted-foreground font-medium">Spent</span>
          </div>
          <p className="text-xl font-bold text-foreground tabular-nums">
            ${spent}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="bg-muted/50 rounded-lg p-3"
        >
          <span className="text-[11px] text-muted-foreground font-medium">Spots Left</span>
          <p className="text-lg font-semibold text-foreground tabular-nums">
            {spotsRemaining}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-muted/50 rounded-lg p-3"
        >
          <span className="text-[11px] text-muted-foreground font-medium">Avg / Spot</span>
          <p className={cn('text-lg font-semibold tabular-nums', statusColor)}>
            ${avgPerSpot.toFixed(0)}
          </p>
        </motion.div>
      </div>
    </AnimatedCard>
  );
}
