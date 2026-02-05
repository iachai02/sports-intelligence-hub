import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Copy,
  Check,
  Users,
  ArrowLeft,
  Play,
  Clock,
  Loader2,
  Crown,
  User,
} from 'lucide-react';
import type { RoomDetails } from '../../lib/types';
import { AnimatedCard } from './AnimatedCard';
import { cn } from '../../lib/utils';

interface RoomWaitingScreenProps {
  roomId: number;
  room: RoomDetails;
  isCommissioner: boolean;
  onStartDraft: () => void;
  onBackToLobby: () => void;
}

export function RoomWaitingScreen({
  roomId: _roomId,
  room,
  isCommissioner,
  onStartDraft,
  onBackToLobby,
}: RoomWaitingScreenProps) {
  const [copied, setCopied] = useState(false);
  const [isStarting, setIsStarting] = useState(false);

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(room.friend_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Clipboard API may not be available
    }
  };

  const handleStartDraft = async () => {
    setIsStarting(true);
    try {
      onStartDraft();
    } catch {
      setIsStarting(false);
    }
  };

  const realMembers = room.members.filter((m) => !m.is_phantom);
  const phantomSlots = room.num_teams - realMembers.length;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      {/* Back button */}
      <motion.button
        initial={{ opacity: 0, x: -8 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.2 }}
        onClick={onBackToLobby}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Lobby
      </motion.button>

      {/* Room name */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="text-center mb-8"
      >
        <h1 className="text-3xl font-bold text-foreground tracking-tight mb-1">
          {room.name}
        </h1>
        <p className="text-muted-foreground text-sm">
          ${room.budget_total} budget &middot; {room.num_teams} teams &middot;{' '}
          {room.season}
        </p>
      </motion.div>

      {/* Friend code - prominently displayed */}
      <AnimatedCard delay={0.05} className="p-6 mb-6">
        <div className="text-center">
          <p className="text-sm font-medium text-muted-foreground mb-3">
            Share this code to invite friends
          </p>
          <button
            onClick={handleCopyCode}
            className="group inline-flex items-center gap-3 transition-all"
          >
            <span
              className={cn(
                'text-5xl font-bold font-mono tracking-[0.35em] text-foreground',
                'px-6 py-4 rounded-xl border-2 border-dashed transition-all duration-200',
                copied
                  ? 'border-stat-positive bg-stat-positive/5'
                  : 'border-border group-hover:border-accent/50 group-hover:bg-accent/5',
              )}
            >
              {room.friend_code}
            </span>
          </button>
          <div className="mt-3 flex items-center justify-center gap-2">
            <AnimatePresence mode="wait">
              {copied ? (
                <motion.span
                  key="copied"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="flex items-center gap-1.5 text-sm text-stat-positive font-medium"
                >
                  <Check className="h-4 w-4" />
                  Copied to clipboard
                </motion.span>
              ) : (
                <motion.span
                  key="copy"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="flex items-center gap-1.5 text-sm text-muted-foreground"
                >
                  <Copy className="h-4 w-4" />
                  Click to copy
                </motion.span>
              )}
            </AnimatePresence>
          </div>
        </div>
      </AnimatedCard>

      {/* Members list */}
      <AnimatedCard delay={0.1} className="mb-6">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-semibold text-foreground">Members</span>
          </div>
          <span className="text-xs text-muted-foreground">
            {realMembers.length} / {room.num_teams} joined
          </span>
        </div>

        <div className="divide-y divide-border">
          {/* Real members */}
          {realMembers.map((member, idx) => (
            <motion.div
              key={member.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.2, delay: 0.15 + idx * 0.04 }}
              className="flex items-center justify-between px-4 py-3"
            >
              <div className="flex items-center gap-3 min-w-0">
                {/* Online indicator */}
                <span
                  className={cn(
                    'h-2.5 w-2.5 rounded-full shrink-0 transition-colors',
                    member.is_online ? 'bg-stat-positive' : 'bg-muted-foreground/30',
                  )}
                  title={member.is_online ? 'Online' : 'Offline'}
                />

                {/* Avatar */}
                {member.user_avatar ? (
                  <img
                    src={member.user_avatar}
                    alt={member.user_name || member.team_name}
                    className="h-8 w-8 rounded-full object-cover border border-border"
                  />
                ) : (
                  <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center border border-border">
                    <User className="h-4 w-4 text-muted-foreground" />
                  </div>
                )}

                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground text-sm truncate">
                      {member.team_name}
                    </span>
                    {member.user_id === room.commissioner_id && (
                      <Crown className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                    )}
                  </div>
                  {member.user_name && (
                    <span className="text-xs text-muted-foreground">
                      {member.user_name}
                    </span>
                  )}
                </div>
              </div>

              <span
                className={cn(
                  'text-xs px-2 py-0.5 rounded-md font-medium',
                  member.is_online
                    ? 'bg-stat-positive/15 text-stat-positive'
                    : 'bg-muted text-muted-foreground',
                )}
              >
                {member.is_online ? 'Online' : 'Offline'}
              </span>
            </motion.div>
          ))}

          {/* Phantom (unfilled) slots */}
          {Array.from({ length: phantomSlots }, (_, idx) => (
            <motion.div
              key={`phantom-${idx}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{
                duration: 0.2,
                delay: 0.15 + (realMembers.length + idx) * 0.04,
              }}
              className="flex items-center gap-3 px-4 py-3"
            >
              <span className="h-2.5 w-2.5 rounded-full bg-transparent shrink-0" />
              <div className="h-8 w-8 rounded-full border-2 border-dashed border-border flex items-center justify-center">
                <User className="h-3.5 w-3.5 text-muted-foreground/40" />
              </div>
              <span className="text-sm text-muted-foreground/60 italic">
                Waiting for player...
              </span>
            </motion.div>
          ))}
        </div>
      </AnimatedCard>

      {/* Start draft / waiting indicator */}
      <AnimatedCard delay={0.15} className="p-5">
        {isCommissioner ? (
          <div className="text-center">
            <p className="text-sm text-muted-foreground mb-4">
              As commissioner, you can start the draft when everyone is ready.
            </p>
            <button
              onClick={handleStartDraft}
              disabled={isStarting}
              className="flex items-center justify-center gap-2 w-full px-6 py-3 bg-accent text-accent-foreground rounded-xl font-semibold text-sm hover:bg-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isStarting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              {isStarting ? 'Starting...' : 'Start Draft'}
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-3 py-2">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
            >
              <Clock className="h-5 w-5 text-muted-foreground" />
            </motion.div>
            <span className="text-muted-foreground font-medium text-sm">
              Waiting for the commissioner to start the draft...
            </span>
          </div>
        )}
      </AnimatedCard>
    </div>
  );
}
