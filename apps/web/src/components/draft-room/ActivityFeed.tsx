import { useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Trophy,
  Undo2,
  UserPlus,
  UserMinus,
  Play,
  CheckCircle,
  MessageSquare,
  Loader2,
  Activity,
  PlusCircle,
} from 'lucide-react';
import type { ActivityLogEntry } from '../../lib/types';
import { cn } from '../../lib/utils';

interface ActivityFeedProps {
  activities: ActivityLogEntry[];
  isLoading: boolean;
}

const ACTION_CONFIG: Record<
  string,
  { icon: typeof Trophy; color: string; bg: string; label: string }
> = {
  pick_reported: {
    icon: Trophy,
    color: 'text-amber-400',
    bg: 'bg-amber-500/15',
    label: 'Pick',
  },
  pick_undone: {
    icon: Undo2,
    color: 'text-stat-negative',
    bg: 'bg-stat-negative/15',
    label: 'Undo',
  },
  member_joined: {
    icon: UserPlus,
    color: 'text-stat-positive',
    bg: 'bg-stat-positive/15',
    label: 'Joined',
  },
  member_left: {
    icon: UserMinus,
    color: 'text-muted-foreground',
    bg: 'bg-muted',
    label: 'Left',
  },
  draft_started: {
    icon: Play,
    color: 'text-accent',
    bg: 'bg-accent/15',
    label: 'Started',
  },
  draft_completed: {
    icon: CheckCircle,
    color: 'text-stat-positive',
    bg: 'bg-stat-positive/15',
    label: 'Completed',
  },
  room_created: {
    icon: PlusCircle,
    color: 'text-accent',
    bg: 'bg-accent/15',
    label: 'Created',
  },
};

const DEFAULT_ACTION_CONFIG = {
  icon: MessageSquare,
  color: 'text-muted-foreground',
  bg: 'bg-muted',
  label: 'Event',
};

function formatRelativeTime(isoString: string): string {
  const now = Date.now();
  const then = new Date(isoString).getTime();
  const diffMs = now - then;
  const diffSec = Math.floor(diffMs / 1000);

  if (diffSec < 5) return 'just now';
  if (diffSec < 60) return `${diffSec}s ago`;

  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;

  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}h ago`;

  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 7) return `${diffDay}d ago`;

  return new Date(isoString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

function getActivityDescription(entry: ActivityLogEntry): string {
  const payload = entry.payload || {};
  const user = entry.user_name || 'Someone';

  switch (entry.action_type) {
    case 'pick_reported': {
      const playerName = (payload.player_name as string) || 'a player';
      const teamName = (payload.team_name as string) || '';
      const price = payload.price as number | undefined;
      if (teamName && price !== undefined) {
        return `${user} reported ${playerName} to ${teamName} for $${price}`;
      }
      return `${user} reported a pick: ${playerName}`;
    }
    case 'pick_undone': {
      const playerName = (payload.player_name as string) || 'a player';
      return `${user} undid pick: ${playerName}`;
    }
    case 'member_joined':
      return `${(payload.user_name as string) || user} joined the room`;
    case 'member_left':
      return `${(payload.user_name as string) || user} left the room`;
    case 'draft_started':
      return `${user} started the draft`;
    case 'draft_completed':
      return 'Draft completed';
    case 'room_created':
      return `${user} created the room`;
    default:
      return `${user}: ${entry.action_type}`;
  }
}

export function ActivityFeed({ activities, isLoading }: ActivityFeedProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const prevCountRef = useRef<number>(0);

  // Auto-scroll to bottom when new entries arrive
  useEffect(() => {
    if (activities.length > prevCountRef.current && scrollContainerRef.current) {
      const container = scrollContainerRef.current;
      requestAnimationFrame(() => {
        container.scrollTop = container.scrollHeight;
      });
    }
    prevCountRef.current = activities.length;
  }, [activities.length]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-accent" />
        <span className="ml-2 text-sm text-muted-foreground">Loading activity...</span>
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center px-4">
        <Activity className="h-8 w-8 text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground">
          No activity yet. Events will appear here as the draft progresses.
        </p>
      </div>
    );
  }

  return (
    <div
      ref={scrollContainerRef}
      className="overflow-y-auto max-h-[calc(100vh-280px)] space-y-0.5 pr-1"
    >
      <AnimatePresence initial={false}>
        {activities.map((entry, idx) => {
          const config = ACTION_CONFIG[entry.action_type] || DEFAULT_ACTION_CONFIG;
          const Icon = config.icon;
          const description = getActivityDescription(entry);
          const relativeTime = formatRelativeTime(entry.created_at);

          return (
            <motion.div
              key={entry.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2, delay: idx === activities.length - 1 ? 0 : 0 }}
              className="flex items-start gap-2.5 px-3 py-2 rounded-lg hover:bg-muted/40 transition-colors"
            >
              {/* Icon */}
              <div
                className={cn(
                  'shrink-0 h-6 w-6 rounded-md flex items-center justify-center mt-0.5',
                  config.bg,
                )}
              >
                <Icon className={cn('h-3.5 w-3.5', config.color)} />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <p className="text-xs text-foreground leading-relaxed">
                  {description}
                </p>
                <span className="text-[10px] text-muted-foreground">
                  {relativeTime}
                </span>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
