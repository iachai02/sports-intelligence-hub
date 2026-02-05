import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Loader2,
  AlertCircle,
  LayoutGrid,
  BarChart3,
  Calculator,
  Users,
  Trophy,
  Undo2,
  UserPlus,
  UserMinus,
  Play,
  CheckCircle,
  MessageSquare,
  ClipboardList,
  Copy,
  Check,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { AuthButton } from '../components/AuthButton';
import { listRooms, getRoomActivity } from '../lib/api';
import type { RoomListItem, ActivityLogEntry } from '../lib/types';
import { cn } from '../lib/utils';

const STATUS_STYLES: Record<string, { label: string; className: string }> = {
  waiting: { label: 'Waiting', className: 'bg-amber-500/15 text-amber-400' },
  active: { label: 'Active', className: 'bg-stat-positive/15 text-stat-positive' },
  completed: { label: 'Completed', className: 'bg-muted text-muted-foreground' },
  archived: { label: 'Archived', className: 'bg-muted text-muted-foreground' },
};

const ACTIVITY_ICONS: Record<string, { icon: typeof Trophy; color: string }> = {
  pick_reported: { icon: Trophy, color: 'text-amber-400' },
  pick_undone: { icon: Undo2, color: 'text-stat-negative' },
  member_joined: { icon: UserPlus, color: 'text-stat-positive' },
  member_left: { icon: UserMinus, color: 'text-muted-foreground' },
  draft_started: { icon: Play, color: 'text-accent' },
  draft_completed: { icon: CheckCircle, color: 'text-stat-positive' },
};

function formatRelativeTime(isoString: string): string {
  const diffMs = Date.now() - new Date(isoString).getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 5) return 'just now';
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}h ago`;
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return new Date(isoString).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
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
    case 'pick_undone':
      return `${user} undid pick: ${(payload.player_name as string) || 'a player'}`;
    case 'member_joined':
      return `${(payload.user_name as string) || user} joined`;
    case 'member_left':
      return `${(payload.user_name as string) || user} left`;
    case 'draft_started':
      return `${user} started the draft`;
    case 'draft_completed':
      return 'Draft completed';
    default:
      return `${user}: ${entry.action_type}`;
  }
}

export function DashboardPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [rooms, setRooms] = useState<RoomListItem[]>([]);
  const [activities, setActivities] = useState<ActivityLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated) return;

    const loadData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const roomList = await listRooms();
        setRooms(roomList);

        // Fetch activity for active rooms
        const activeRooms = roomList.filter((r) => r.status === 'active');
        if (activeRooms.length > 0) {
          const activityPromises = activeRooms.slice(0, 5).map((r) =>
            getRoomActivity(r.id, 10).catch(() => [] as ActivityLogEntry[]),
          );
          const allActivities = await Promise.all(activityPromises);
          const merged = allActivities
            .flat()
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
            .slice(0, 20);
          setActivities(merged);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load dashboard data');
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [isAuthenticated]);

  const handleCopyCode = async (code: string) => {
    await navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  if (authLoading) {
    return (
      <div className="min-h-[calc(100vh-3rem)] bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 text-accent animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-[calc(100vh-3rem)] bg-background flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card border border-border p-8 rounded-xl shadow-soft text-center max-w-md"
        >
          <div className="w-14 h-14 rounded-xl bg-accent/10 flex items-center justify-center mx-auto mb-5">
            <ClipboardList className="h-7 w-7 text-accent" />
          </div>
          <h1 className="text-2xl font-bold mb-3 text-foreground">Sports Intelligence Hub</h1>
          <p className="text-muted-foreground mb-6 text-sm leading-relaxed">
            Sign in to access your draft rooms, player stats, and optimization tools.
          </p>
          <AuthButton />
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-3rem)] bg-background">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-2xl font-bold text-foreground mb-1">Dashboard</h1>
          <p className="text-muted-foreground text-sm mb-8">
            Your draft rooms and quick access to all features.
          </p>
        </motion.div>

        {error && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="bg-stat-negative/10 border border-stat-negative/20 rounded-xl p-4 mb-6 flex items-start gap-3"
          >
            <AlertCircle className="h-5 w-5 text-stat-negative shrink-0 mt-0.5" />
            <p className="text-stat-negative text-sm">{error}</p>
          </motion.div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Rooms section - takes 2 columns */}
          <motion.section
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="lg:col-span-2"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                <Users className="h-5 w-5 text-accent" />
                Your Rooms
              </h2>
              <Link
                to="/draft-room"
                className="text-xs font-medium text-accent hover:underline"
              >
                View all
              </Link>
            </div>

            {isLoading ? (
              <div className="bg-card border border-border rounded-xl p-12 flex flex-col items-center justify-center">
                <Loader2 className="h-6 w-6 text-accent animate-spin mb-3" />
                <p className="text-sm text-muted-foreground">Loading rooms...</p>
              </div>
            ) : rooms.length === 0 ? (
              <div className="bg-card border border-border rounded-xl p-8 flex flex-col items-center justify-center text-center">
                <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center mb-4">
                  <LayoutGrid className="h-6 w-6 text-accent/60" />
                </div>
                <h3 className="text-base font-semibold text-foreground mb-2">No rooms yet</h3>
                <p className="text-sm text-muted-foreground mb-4 max-w-sm">
                  Create or join a draft room to start drafting with friends.
                </p>
                <Link
                  to="/draft-room"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-accent text-accent-foreground rounded-lg text-sm font-medium hover:bg-accent/90 transition-colors"
                >
                  <LayoutGrid className="h-4 w-4" />
                  Go to Draft Room
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {rooms.map((room) => {
                  const status = STATUS_STYLES[room.status] || STATUS_STYLES.waiting;
                  return (
                    <button
                      key={room.id}
                      onClick={() => navigate('/draft-room', { state: { roomId: room.id } })}
                      className="bg-card border border-border rounded-xl p-4 text-left hover:border-accent/40 hover:shadow-md transition-all group"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <h3 className="text-sm font-semibold text-foreground group-hover:text-accent transition-colors truncate pr-2">
                          {room.name}
                        </h3>
                        <span className={cn('text-[10px] font-medium px-2 py-0.5 rounded-full shrink-0', status.className)}>
                          {status.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {room.member_count}/{room.num_teams}
                        </span>
                        <span>${room.budget_total}</span>
                        <span>{room.season}</span>
                      </div>
                      {room.friend_code && (
                        <div className="mt-2 flex items-center gap-1.5">
                          <code className="text-[10px] text-muted-foreground font-mono bg-muted px-1.5 py-0.5 rounded">
                            {room.friend_code}
                          </code>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCopyCode(room.friend_code);
                            }}
                            className="p-0.5 text-muted-foreground hover:text-foreground transition-colors"
                            aria-label="Copy friend code"
                          >
                            {copiedCode === room.friend_code ? (
                              <Check className="h-3 w-3 text-stat-positive" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                          </button>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </motion.section>

          {/* Right column: Activity + Quick Links */}
          <div className="space-y-6">
            {/* Activity Feed */}
            {activities.length > 0 && (
              <motion.section
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-amber-400" />
                  Recent Activity
                </h2>
                <div className="bg-card border border-border rounded-xl overflow-hidden">
                  <div className="max-h-64 overflow-y-auto">
                    {activities.map((entry) => {
                      const config = ACTIVITY_ICONS[entry.action_type] || {
                        icon: MessageSquare,
                        color: 'text-muted-foreground',
                      };
                      const Icon = config.icon;
                      return (
                        <div
                          key={entry.id}
                          className="flex items-start gap-2.5 px-3 py-2 border-b border-border last:border-b-0"
                        >
                          <Icon className={cn('h-3.5 w-3.5 mt-0.5 shrink-0', config.color)} />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-foreground leading-relaxed">
                              {getActivityDescription(entry)}
                            </p>
                            <span className="text-[10px] text-muted-foreground">
                              {formatRelativeTime(entry.created_at)}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </motion.section>
            )}

            {/* Quick Links */}
            <motion.section
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <h2 className="text-lg font-semibold text-foreground mb-4">Quick Links</h2>
              <div className="space-y-3">
                <Link
                  to="/draft-room"
                  className="flex items-center gap-3 p-3 bg-card border border-border rounded-xl hover:border-accent/40 hover:shadow-md transition-all group"
                >
                  <div className="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
                    <LayoutGrid className="h-5 w-5 text-accent" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-foreground group-hover:text-accent transition-colors">
                      Draft Room
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Live auction draft assistant
                    </p>
                  </div>
                </Link>

                <Link
                  to="/stats"
                  className="flex items-center gap-3 p-3 bg-card border border-border rounded-xl hover:border-accent/40 hover:shadow-md transition-all group"
                >
                  <div className="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
                    <BarChart3 className="h-5 w-5 text-accent" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-foreground group-hover:text-accent transition-colors">
                      Player Stats
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Browse and compare NBA stats
                    </p>
                  </div>
                </Link>

                <Link
                  to="/optimizer"
                  className="flex items-center gap-3 p-3 bg-card border border-border rounded-xl hover:border-accent/40 hover:shadow-md transition-all group"
                >
                  <div className="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
                    <Calculator className="h-5 w-5 text-accent" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-foreground group-hover:text-accent transition-colors">
                      Optimizer
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Optimal roster with LP solver
                    </p>
                  </div>
                </Link>
              </div>
            </motion.section>
          </div>
        </div>
      </div>
    </div>
  );
}
