import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { PositionBadge } from './PositionBadge';
import { cn } from '../../lib/utils';

interface PlayerRowProps {
  name: string;
  team: string;
  position: string;
  cost?: number;
  projectedFpts?: number;
  slot?: string;
  index?: number;
  isAvailable?: boolean;
  rightContent?: ReactNode;
  className?: string;
}

export function PlayerRow({
  name,
  team,
  position,
  cost,
  projectedFpts,
  slot,
  index = 0,
  isAvailable = true,
  rightContent,
  className,
}: PlayerRowProps) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 8 }}
      transition={{ duration: 0.2, delay: index * 0.02 }}
      className={cn(
        'flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg transition-colors',
        isAvailable
          ? 'hover:bg-muted/60'
          : 'opacity-50',
        className,
      )}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <PositionBadge position={position} />
        {slot && slot !== position && (
          <span className="text-[10px] text-muted-foreground font-medium">
            {slot}
          </span>
        )}
        <span className="font-medium text-foreground truncate">{name}</span>
        <span className="text-xs text-muted-foreground shrink-0">{team}</span>
      </div>

      {rightContent ? (
        rightContent
      ) : (
        <div className="flex items-center gap-3 shrink-0 text-right">
          {cost !== undefined && (
            <span className="font-bold text-stat-positive tabular-nums text-sm">
              ${cost}
            </span>
          )}
          {projectedFpts !== undefined && (
            <span className="text-xs text-muted-foreground tabular-nums">
              {projectedFpts.toFixed(1)} FPTS
            </span>
          )}
        </div>
      )}
    </motion.div>
  );
}
