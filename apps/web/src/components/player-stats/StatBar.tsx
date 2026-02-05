import { cn } from '../../lib/utils';
import { motion } from 'framer-motion';

interface StatBarProps {
  label: string;
  value: number;
  maxValue: number;
  isPercentage?: boolean;
  showLabel?: boolean;
  size?: 'sm' | 'md';
  className?: string;
}

export function StatBar({
  label,
  value,
  maxValue,
  isPercentage = false,
  showLabel = true,
  size = 'md',
  className,
}: StatBarProps) {
  const percentage = Math.min((value / maxValue) * 100, 100);
  const displayValue = isPercentage ? `${(value * 100).toFixed(1)}%` : value.toFixed(1);

  return (
    <div className={cn('flex items-center gap-3', className)}>
      {showLabel && (
        <span className={cn(
          'text-muted-foreground font-medium uppercase tracking-wide',
          size === 'sm' ? 'w-8 text-[10px]' : 'w-10 text-stat-label'
        )}>
          {label}
        </span>
      )}
      <div className={cn(
        'flex-1 bg-muted rounded-full overflow-hidden',
        size === 'sm' ? 'h-1.5' : 'h-2'
      )}>
        <motion.div
          className="h-full bg-accent rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
        />
      </div>
      <span className={cn(
        'font-mono font-medium tabular-nums',
        size === 'sm' ? 'w-10 text-xs' : 'w-12 text-stat'
      )}>
        {displayValue}
      </span>
    </div>
  );
}

interface ComparisonStatBarProps {
  label: string;
  values: { playerId: string; value: number; color: string }[];
  maxValue: number;
  isPercentage?: boolean;
}

export function ComparisonStatBar({
  label,
  values,
  maxValue,
  isPercentage = false,
}: ComparisonStatBarProps) {
  return (
    <div className="py-2">
      <span className="text-stat-label text-muted-foreground uppercase tracking-wide mb-1.5 block">
        {label}
      </span>
      <div className="space-y-1.5">
        {values.map(({ playerId, value, color }, index) => {
          const percentage = Math.min((value / maxValue) * 100, 100);
          const displayValue = isPercentage ? `${(value * 100).toFixed(1)}%` : value.toFixed(1);

          return (
            <div key={playerId} className="flex items-center gap-2">
              <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                <motion.div
                  className="h-full rounded-full"
                  style={{ backgroundColor: color }}
                  initial={{ width: 0 }}
                  animate={{ width: `${percentage}%` }}
                  transition={{ duration: 0.4, ease: 'easeOut', delay: index * 0.05 }}
                />
              </div>
              <span className="w-12 text-xs font-mono font-medium tabular-nums text-right">
                {displayValue}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
