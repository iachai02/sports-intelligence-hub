import { useState } from 'react';
import { motion } from 'framer-motion';
import { Copy, Check, Users, Wifi, WifiOff, ArrowLeft } from 'lucide-react';
import { cn } from '../../lib/utils';

interface RoomMember {
  id: string;
  name: string;
  avatarUrl?: string;
  isOnline: boolean;
}

interface RoomHeaderProps {
  roomName?: string;
  friendCode?: string;
  members?: RoomMember[];
  isConnected?: boolean;
  playersAvailable?: number;
  playersTaken?: number;
  onBackToSessions: () => void;
}

export function RoomHeader({
  roomName = 'Draft Room',
  friendCode,
  members = [],
  isConnected = true,
  playersAvailable,
  playersTaken,
  onBackToSessions,
}: RoomHeaderProps) {
  const [copied, setCopied] = useState(false);

  const handleCopyCode = async () => {
    if (!friendCode) return;
    try {
      await navigator.clipboard.writeText(friendCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API may not be available
    }
  };

  const onlineCount = members.filter((m) => m.isOnline).length;

  return (
    <motion.header
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="bg-card border-b border-border"
    >
      <div className="max-w-7xl mx-auto px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          {/* Left: Back + Room name */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={onBackToSessions}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
              aria-label="Back to sessions"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>

            <div className="min-w-0">
              <h1 className="text-lg font-bold text-foreground truncate">
                {roomName}
              </h1>
              {(playersAvailable !== undefined || playersTaken !== undefined) && (
                <p className="text-xs text-muted-foreground">
                  {playersAvailable !== undefined && (
                    <span>{playersAvailable} available</span>
                  )}
                  {playersAvailable !== undefined && playersTaken !== undefined && (
                    <span className="mx-1">&middot;</span>
                  )}
                  {playersTaken !== undefined && (
                    <span>{playersTaken} taken</span>
                  )}
                </p>
              )}
            </div>
          </div>

          {/* Center: Friend code + Members */}
          <div className="hidden md:flex items-center gap-4">
            {/* Friend code */}
            {friendCode && (
              <button
                onClick={handleCopyCode}
                className={cn(
                  'flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-mono transition-all',
                  'bg-muted/60 border border-border hover:border-accent/40',
                  copied && 'border-stat-positive/40 bg-stat-positive/10',
                )}
              >
                <span className="text-muted-foreground">Code:</span>
                <span className="text-foreground font-semibold">{friendCode}</span>
                {copied ? (
                  <Check className="h-3 w-3 text-stat-positive" />
                ) : (
                  <Copy className="h-3 w-3 text-muted-foreground" />
                )}
              </button>
            )}

            {/* Member avatars */}
            {members.length > 0 && (
              <div className="flex items-center gap-2">
                <div className="flex -space-x-2">
                  {members.slice(0, 5).map((member) => (
                    <div
                      key={member.id}
                      className="relative"
                      title={`${member.name}${member.isOnline ? ' (online)' : ''}`}
                    >
                      {member.avatarUrl ? (
                        <img
                          src={member.avatarUrl}
                          alt={member.name}
                          className="h-7 w-7 rounded-full border-2 border-card object-cover"
                        />
                      ) : (
                        <div className="h-7 w-7 rounded-full border-2 border-card bg-muted flex items-center justify-center">
                          <span className="text-[10px] font-semibold text-muted-foreground">
                            {member.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                      )}
                      <span
                        className={cn(
                          'absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-card',
                          member.isOnline ? 'bg-stat-positive' : 'bg-muted-foreground/40',
                        )}
                      />
                    </div>
                  ))}
                </div>
                {members.length > 5 && (
                  <span className="text-xs text-muted-foreground">
                    +{members.length - 5}
                  </span>
                )}
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Users className="h-3 w-3" />
                  <span>{onlineCount}/{members.length}</span>
                </div>
              </div>
            )}
          </div>

          {/* Right: Connection status */}
          <div className="flex items-center gap-2">
            <div
              className={cn(
                'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium',
                isConnected
                  ? 'bg-stat-positive/10 text-stat-positive'
                  : 'bg-stat-negative/10 text-stat-negative',
              )}
            >
              {isConnected ? (
                <Wifi className="h-3 w-3" />
              ) : (
                <WifiOff className="h-3 w-3" />
              )}
              <span className="hidden sm:inline">
                {isConnected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </motion.header>
  );
}
