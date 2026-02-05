import { cn } from '../../lib/utils';

const POSITION_COLORS: Record<string, { bg: string; text: string }> = {
  PG: { bg: 'bg-blue-500/15', text: 'text-blue-400' },
  SG: { bg: 'bg-emerald-500/15', text: 'text-emerald-400' },
  SF: { bg: 'bg-orange-500/15', text: 'text-orange-400' },
  PF: { bg: 'bg-red-500/15', text: 'text-red-400' },
  C: { bg: 'bg-purple-500/15', text: 'text-purple-400' },
};

const DEFAULT_COLOR = { bg: 'bg-muted', text: 'text-muted-foreground' };

interface PositionBadgeProps {
  position: string;
  size?: 'sm' | 'md';
  className?: string;
}

export function PositionBadge({ position, size = 'sm', className }: PositionBadgeProps) {
  const colors = POSITION_COLORS[position] ?? DEFAULT_COLOR;

  return (
    <span
      className={cn(
        'inline-flex items-center justify-center font-semibold rounded-md',
        colors.bg,
        colors.text,
        size === 'sm' && 'text-[10px] px-1.5 py-0.5 min-w-[28px]',
        size === 'md' && 'text-xs px-2 py-0.5 min-w-[32px]',
        className,
      )}
    >
      {position}
    </span>
  );
}
