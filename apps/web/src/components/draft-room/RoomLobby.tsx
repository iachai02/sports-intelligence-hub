import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  Users,
  DoorOpen,
  Play,
  LogOut,
  Loader2,
  AlertCircle,
  Hash,
  DollarSign,
  Calendar,
  Shield,
  UserPlus,
  Copy,
  Check,
} from 'lucide-react';
import { listRooms, createRoom, joinRoom, leaveRoom } from '../../lib/api';
import type { RoomListItem } from '../../lib/types';
import { AnimatedCard } from './AnimatedCard';
import { cn } from '../../lib/utils';

interface RoomLobbyProps {
  onSelectRoom: (roomId: number) => void;
}

type LobbyTab = 'rooms' | 'create' | 'join';

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  waiting: { label: 'Waiting', bg: 'bg-amber-500/15', text: 'text-amber-400' },
  active: { label: 'Active', bg: 'bg-stat-positive/15', text: 'text-stat-positive' },
  completed: { label: 'Completed', bg: 'bg-muted', text: 'text-muted-foreground' },
  archived: { label: 'Archived', bg: 'bg-muted', text: 'text-muted-foreground' },
};

export function RoomLobby({ onSelectRoom }: RoomLobbyProps) {
  const [rooms, setRooms] = useState<RoomListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<LobbyTab>('rooms');

  // Create room form state
  const [createName, setCreateName] = useState('');
  const [createBudget, setCreateBudget] = useState(200);
  const [createNumTeams, setCreateNumTeams] = useState(12);
  const [createSeason, setCreateSeason] = useState('2024-25');
  const [createTeamName, setCreateTeamName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  // Join room form state
  const [joinCode, setJoinCode] = useState('');
  const [joinTeamName, setJoinTeamName] = useState('');
  const [isJoining, setIsJoining] = useState(false);

  // Leaving state
  const [leavingRoomId, setLeavingRoomId] = useState<number | null>(null);

  // Copied friend code
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const loadRooms = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await listRooms();
      setRooms(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load rooms');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRooms();
  }, [loadRooms]);

  const handleCreate = async () => {
    setIsCreating(true);
    setError(null);
    try {
      const result = await createRoom(
        createName || 'Draft Room',
        createBudget,
        createNumTeams,
        createSeason,
        createTeamName || 'My Team',
      );
      onSelectRoom(result.room_id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create room');
      setIsCreating(false);
    }
  };

  const handleJoin = async () => {
    if (joinCode.length !== 6) return;
    setIsJoining(true);
    setError(null);
    try {
      await joinRoom(joinCode.toUpperCase(), joinTeamName || 'My Team');
      await loadRooms();
      setJoinCode('');
      setJoinTeamName('');
      setActiveTab('rooms');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join room');
    } finally {
      setIsJoining(false);
    }
  };

  const handleLeave = async (roomId: number) => {
    setLeavingRoomId(roomId);
    setError(null);
    try {
      await leaveRoom(roomId);
      setRooms((prev) => prev.filter((r) => r.id !== roomId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to leave room');
    } finally {
      setLeavingRoomId(null);
    }
  };

  const handleCopyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(null), 2000);
    } catch {
      // Clipboard API may not be available
    }
  };

  const formatDate = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const tabs: { key: LobbyTab; label: string; icon: typeof Plus }[] = [
    { key: 'rooms', label: 'My Rooms', icon: DoorOpen },
    { key: 'create', label: 'Create Room', icon: Plus },
    { key: 'join', label: 'Join Room', icon: UserPlus },
  ];

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="text-center mb-8"
      >
        <h1 className="text-3xl font-bold text-foreground tracking-tight">
          Draft Rooms
        </h1>
        <p className="text-muted-foreground mt-2">
          Create or join a multi-user auction draft room
        </p>
      </motion.div>

      {/* Error banner */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-4"
          >
            <div className="flex items-center gap-2 bg-stat-negative/10 border border-stat-negative/20 rounded-xl px-4 py-3">
              <AlertCircle className="h-4 w-4 text-stat-negative shrink-0" />
              <p className="text-sm text-stat-negative">{error}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tabs */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, delay: 0.1 }}
        className="flex gap-1 bg-muted/60 rounded-xl p-1 mb-6"
      >
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => {
                setActiveTab(tab.key);
                setError(null);
              }}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200',
                activeTab === tab.key
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <Icon className="h-4 w-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </motion.div>

      {/* Tab content */}
      <AnimatePresence mode="wait">
        {/* My Rooms */}
        {activeTab === 'rooms' && (
          <motion.div
            key="rooms"
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 16 }}
            transition={{ duration: 0.2 }}
          >
            {isLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-6 w-6 animate-spin text-accent" />
                <span className="ml-3 text-muted-foreground">Loading rooms...</span>
              </div>
            ) : rooms.length === 0 ? (
              <AnimatedCard className="p-12 text-center">
                <DoorOpen className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-foreground font-medium mb-1">No rooms yet</p>
                <p className="text-sm text-muted-foreground mb-4">
                  Create a new room or join one with a friend code
                </p>
                <div className="flex gap-3 justify-center">
                  <button
                    onClick={() => setActiveTab('create')}
                    className="px-5 py-2.5 bg-accent text-accent-foreground rounded-xl font-medium text-sm hover:bg-accent/90 transition-colors"
                  >
                    Create Room
                  </button>
                  <button
                    onClick={() => setActiveTab('join')}
                    className="px-5 py-2.5 bg-muted text-foreground rounded-xl font-medium text-sm hover:bg-muted/80 transition-colors"
                  >
                    Join Room
                  </button>
                </div>
              </AnimatedCard>
            ) : (
              <div className="space-y-3">
                {rooms.map((room, idx) => {
                  const status = STATUS_CONFIG[room.status] ?? STATUS_CONFIG.archived;
                  const canResume =
                    room.status === 'active' || room.status === 'waiting';

                  return (
                    <AnimatedCard
                      key={room.id}
                      delay={idx * 0.04}
                      hover
                      className="p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-foreground truncate">
                              {room.name}
                            </span>
                            <span
                              className={cn(
                                'text-xs px-2 py-0.5 rounded-md font-medium',
                                status.bg,
                                status.text,
                              )}
                            >
                              {status.label}
                            </span>
                          </div>

                          <div className="flex items-center gap-3 mt-2 text-sm text-muted-foreground flex-wrap">
                            <span className="flex items-center gap-1">
                              <Users className="h-3.5 w-3.5" />
                              {room.member_count}/{room.num_teams}
                            </span>
                            <span className="flex items-center gap-1">
                              <DollarSign className="h-3.5 w-3.5" />
                              {room.budget_total}
                            </span>
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3.5 w-3.5" />
                              {room.season}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 mt-2">
                            <button
                              onClick={() => handleCopyCode(room.friend_code)}
                              className={cn(
                                'flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono transition-all',
                                'bg-muted/60 border border-border hover:border-accent/40',
                                copiedCode === room.friend_code &&
                                  'border-stat-positive/40 bg-stat-positive/10',
                              )}
                            >
                              <span className="text-muted-foreground">Code:</span>
                              <span className="text-foreground font-semibold tracking-widest">
                                {room.friend_code}
                              </span>
                              {copiedCode === room.friend_code ? (
                                <Check className="h-3 w-3 text-stat-positive" />
                              ) : (
                                <Copy className="h-3 w-3 text-muted-foreground" />
                              )}
                            </button>
                            <span className="text-xs text-muted-foreground">
                              {formatDate(room.created_at)}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {canResume && (
                            <button
                              onClick={() => onSelectRoom(room.id)}
                              className="flex items-center gap-1.5 px-4 py-2 bg-accent text-accent-foreground rounded-xl text-sm font-medium hover:bg-accent/90 transition-colors"
                            >
                              <Play className="h-3.5 w-3.5" />
                              Resume
                            </button>
                          )}
                          <button
                            onClick={() => handleLeave(room.id)}
                            disabled={leavingRoomId === room.id}
                            className="flex items-center gap-1.5 px-3 py-2 text-sm text-muted-foreground hover:text-stat-negative rounded-xl hover:bg-stat-negative/10 transition-colors disabled:opacity-50"
                            title="Leave room"
                          >
                            {leavingRoomId === room.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <LogOut className="h-3.5 w-3.5" />
                            )}
                          </button>
                        </div>
                      </div>
                    </AnimatedCard>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}

        {/* Create Room */}
        {activeTab === 'create' && (
          <motion.div
            key="create"
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 16 }}
            transition={{ duration: 0.2 }}
          >
            <AnimatedCard className="p-6">
              <h3 className="text-lg font-semibold text-foreground mb-5">
                Create a New Draft Room
              </h3>

              <div className="space-y-4">
                {/* Room name */}
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-1.5">
                    Room Name
                  </label>
                  <div className="relative">
                    <Shield className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input
                      type="text"
                      value={createName}
                      onChange={(e) => setCreateName(e.target.value)}
                      placeholder="e.g., Yahoo League 2025"
                      className="w-full pl-10 pr-3 py-2.5 bg-input border border-border rounded-xl text-foreground placeholder-muted-foreground focus-ring text-sm"
                    />
                  </div>
                </div>

                {/* Your team name */}
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-1.5">
                    Your Team Name
                  </label>
                  <div className="relative">
                    <Users className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input
                      type="text"
                      value={createTeamName}
                      onChange={(e) => setCreateTeamName(e.target.value)}
                      placeholder="My Team"
                      className="w-full pl-10 pr-3 py-2.5 bg-input border border-border rounded-xl text-foreground placeholder-muted-foreground focus-ring text-sm"
                    />
                  </div>
                </div>

                {/* Budget + Teams + Season grid */}
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-1.5">
                      Budget
                    </label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <input
                        type="number"
                        value={createBudget}
                        onChange={(e) => setCreateBudget(Number(e.target.value))}
                        min={50}
                        max={1000}
                        className="w-full pl-10 pr-3 py-2.5 bg-input border border-border rounded-xl text-foreground text-sm focus-ring"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-1.5">
                      Teams
                    </label>
                    <div className="relative">
                      <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <input
                        type="number"
                        value={createNumTeams}
                        onChange={(e) => setCreateNumTeams(Number(e.target.value))}
                        min={4}
                        max={20}
                        className="w-full pl-10 pr-3 py-2.5 bg-input border border-border rounded-xl text-foreground text-sm focus-ring"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-1.5">
                      Season
                    </label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <input
                        type="text"
                        value={createSeason}
                        onChange={(e) => setCreateSeason(e.target.value)}
                        placeholder="2024-25"
                        className="w-full pl-10 pr-3 py-2.5 bg-input border border-border rounded-xl text-foreground text-sm focus-ring"
                      />
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={handleCreate}
                    disabled={isCreating}
                    className="flex-1 flex items-center justify-center gap-2 px-5 py-2.5 bg-accent text-accent-foreground rounded-xl font-medium text-sm hover:bg-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isCreating ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Plus className="h-4 w-4" />
                    )}
                    {isCreating ? 'Creating...' : 'Create Room'}
                  </button>
                  <button
                    onClick={() => setActiveTab('rooms')}
                    className="px-5 py-2.5 bg-muted text-foreground rounded-xl font-medium text-sm hover:bg-muted/80 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </AnimatedCard>
          </motion.div>
        )}

        {/* Join Room */}
        {activeTab === 'join' && (
          <motion.div
            key="join"
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 16 }}
            transition={{ duration: 0.2 }}
          >
            <AnimatedCard className="p-6">
              <h3 className="text-lg font-semibold text-foreground mb-5">
                Join a Draft Room
              </h3>

              <div className="space-y-4">
                {/* Friend code */}
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-1.5">
                    Friend Code
                  </label>
                  <input
                    type="text"
                    value={joinCode}
                    onChange={(e) =>
                      setJoinCode(e.target.value.toUpperCase().slice(0, 6))
                    }
                    placeholder="ABC123"
                    maxLength={6}
                    className="w-full px-4 py-3 bg-input border border-border rounded-xl text-foreground text-center text-2xl font-mono font-bold tracking-[0.3em] placeholder-muted-foreground focus-ring uppercase"
                  />
                  <p className="text-xs text-muted-foreground mt-1.5">
                    Enter the 6-character code shared by the room commissioner
                  </p>
                </div>

                {/* Team name */}
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-1.5">
                    Your Team Name
                  </label>
                  <div className="relative">
                    <Users className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input
                      type="text"
                      value={joinTeamName}
                      onChange={(e) => setJoinTeamName(e.target.value)}
                      placeholder="My Team"
                      className="w-full pl-10 pr-3 py-2.5 bg-input border border-border rounded-xl text-foreground placeholder-muted-foreground focus-ring text-sm"
                    />
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={handleJoin}
                    disabled={isJoining || joinCode.length !== 6}
                    className="flex-1 flex items-center justify-center gap-2 px-5 py-2.5 bg-accent text-accent-foreground rounded-xl font-medium text-sm hover:bg-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isJoining ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <UserPlus className="h-4 w-4" />
                    )}
                    {isJoining ? 'Joining...' : 'Join Room'}
                  </button>
                  <button
                    onClick={() => setActiveTab('rooms')}
                    className="px-5 py-2.5 bg-muted text-foreground rounded-xl font-medium text-sm hover:bg-muted/80 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </AnimatedCard>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
