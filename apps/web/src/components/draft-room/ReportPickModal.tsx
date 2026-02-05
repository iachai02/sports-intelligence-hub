import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Search,
  Loader2,
  Trophy,
  DollarSign,
  User,
  Hash,
} from 'lucide-react';
import { searchRoomPlayers, reportPick } from '../../lib/api';
import type { RoomMember, PlayerSearchResult } from '../../lib/types';
import { PositionBadge } from './PositionBadge';
import { cn } from '../../lib/utils';

interface ReportPickModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessionId: number;
  members: RoomMember[];
  onPickReported: () => void;
  preselectedPlayer?: PlayerSearchResult | null;
  defaultMemberId?: number | null;
}

export function ReportPickModal({
  isOpen,
  onClose,
  sessionId,
  members,
  onPickReported,
  preselectedPlayer,
  defaultMemberId,
}: ReportPickModalProps) {
  // Player search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<PlayerSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerSearchResult | null>(null);

  // Form state
  const [selectedMemberId, setSelectedMemberId] = useState<number | null>(null);
  const [price, setPrice] = useState<string>('');
  const [slot, setSlot] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      if (preselectedPlayer) {
        setSearchQuery(preselectedPlayer.name);
        setSearchResults([]);
        setSelectedPlayer(preselectedPlayer);
        setPrice(String(preselectedPlayer.auction_value));
      } else {
        setSearchQuery('');
        setSearchResults([]);
        setSelectedPlayer(null);
        setPrice('');
        // Focus search input after animation
        setTimeout(() => searchInputRef.current?.focus(), 200);
      }
      setSelectedMemberId(defaultMemberId ?? null);
      setSlot('');
      setError(null);
      setIsSubmitting(false);
    }
  }, [isOpen, preselectedPlayer, defaultMemberId]);

  // Debounced player search
  const performSearch = useCallback(
    async (query: string) => {
      if (query.length < 2) {
        setSearchResults([]);
        setIsSearching(false);
        return;
      }

      // Cancel previous request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      const controller = new AbortController();
      abortControllerRef.current = controller;
      setIsSearching(true);

      try {
        const results = await searchRoomPlayers(
          sessionId,
          query,
          false,
          controller.signal,
        );
        setSearchResults(results);
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setSearchResults([]);
      } finally {
        if (!controller.signal.aborted) {
          setIsSearching(false);
        }
      }
    },
    [sessionId],
  );

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => performSearch(searchQuery), 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchQuery, performSearch]);

  // Cleanup abort controller on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) abortControllerRef.current.abort();
    };
  }, []);

  const handleSelectPlayer = (player: PlayerSearchResult) => {
    setSelectedPlayer(player);
    setSearchQuery(player.name);
    setSearchResults([]);
    // Pre-fill price with auction value
    setPrice(String(player.auction_value));
  };

  const handleSubmit = async () => {
    if (!selectedPlayer || selectedMemberId === null || !price) return;

    setIsSubmitting(true);
    setError(null);

    try {
      await reportPick(
        sessionId,
        selectedPlayer.player_id,
        selectedMemberId,
        Number(price),
        slot || undefined,
      );
      onPickReported();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to report pick');
      setIsSubmitting(false);
    }
  };

  const canSubmit =
    selectedPlayer !== null &&
    selectedMemberId !== null &&
    price !== '' &&
    Number(price) >= 0 &&
    !isSubmitting;

  // Filter to real members only (no phantoms) for the dropdown
  const selectableMembers = members.filter((m) => !m.is_phantom);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-border">
                <div className="flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-amber-400" />
                  <h2 className="text-lg font-semibold text-foreground">
                    Report Pick
                  </h2>
                </div>
                <button
                  onClick={onClose}
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
                  aria-label="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Body */}
              <div className="px-5 py-4 space-y-4">
                {/* Error */}
                <AnimatePresence>
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="bg-stat-negative/10 border border-stat-negative/20 rounded-xl px-3 py-2"
                    >
                      <p className="text-sm text-stat-negative">{error}</p>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Player search */}
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-1.5">
                    Player
                  </label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input
                      ref={searchInputRef}
                      type="text"
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        if (selectedPlayer && e.target.value !== selectedPlayer.name) {
                          setSelectedPlayer(null);
                        }
                      }}
                      placeholder="Search player name..."
                      className="w-full pl-10 pr-3 py-2.5 bg-input border border-border rounded-xl text-foreground text-sm placeholder-muted-foreground focus-ring"
                    />
                    {isSearching && (
                      <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                    )}
                  </div>

                  {/* Search results dropdown */}
                  <AnimatePresence>
                    {searchResults.length > 0 && !selectedPlayer && (
                      <motion.div
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        transition={{ duration: 0.15 }}
                        className="mt-1 bg-card border border-border rounded-xl shadow-lg overflow-hidden max-h-48 overflow-y-auto"
                      >
                        {searchResults.map((player) => (
                          <button
                            key={player.player_id}
                            onClick={() => handleSelectPlayer(player)}
                            disabled={!player.is_available}
                            className={cn(
                              'w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors',
                              player.is_available
                                ? 'hover:bg-muted/60'
                                : 'opacity-40 cursor-not-allowed',
                            )}
                          >
                            <PositionBadge position={player.position} />
                            <div className="flex-1 min-w-0">
                              <span className="text-sm font-medium text-foreground truncate block">
                                {player.name}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {player.team}
                              </span>
                            </div>
                            <span className="text-xs font-bold text-stat-positive tabular-nums">
                              ${player.auction_value}
                            </span>
                            {!player.is_available && (
                              <span className="text-[10px] text-stat-negative font-medium">
                                Taken
                              </span>
                            )}
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Selected player indicator */}
                  {selectedPlayer && (
                    <motion.div
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mt-2 flex items-center gap-2 px-3 py-2 bg-accent/10 rounded-lg border border-accent/20"
                    >
                      <PositionBadge position={selectedPlayer.position} />
                      <span className="text-sm font-medium text-foreground">
                        {selectedPlayer.name}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {selectedPlayer.team}
                      </span>
                      <button
                        onClick={() => {
                          setSelectedPlayer(null);
                          setSearchQuery('');
                          searchInputRef.current?.focus();
                        }}
                        className="ml-auto p-0.5 rounded text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </motion.div>
                  )}
                </div>

                {/* Team dropdown */}
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-1.5">
                    Team
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <select
                      value={selectedMemberId ?? ''}
                      onChange={(e) =>
                        setSelectedMemberId(
                          e.target.value ? Number(e.target.value) : null,
                        )
                      }
                      className="w-full pl-10 pr-3 py-2.5 bg-input border border-border rounded-xl text-foreground text-sm focus-ring appearance-none cursor-pointer"
                    >
                      <option value="">Select team...</option>
                      {selectableMembers.map((member) => (
                        <option key={member.id} value={member.id}>
                          {member.team_name}
                          {member.user_name ? ` (${member.user_name})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Price and Slot */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-1.5">
                      Price
                    </label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <input
                        type="number"
                        value={price}
                        onChange={(e) => setPrice(e.target.value)}
                        min={0}
                        placeholder="0"
                        className="w-full pl-10 pr-3 py-2.5 bg-input border border-border rounded-xl text-foreground text-sm focus-ring"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-1.5">
                      Slot
                      <span className="text-muted-foreground/60 font-normal ml-1">
                        (optional)
                      </span>
                    </label>
                    <div className="relative">
                      <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <input
                        type="text"
                        value={slot}
                        onChange={(e) => setSlot(e.target.value)}
                        placeholder="e.g., PG, UTIL"
                        className="w-full pl-10 pr-3 py-2.5 bg-input border border-border rounded-xl text-foreground text-sm focus-ring"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="px-5 py-4 border-t border-border flex gap-3">
                <button
                  onClick={handleSubmit}
                  disabled={!canSubmit}
                  className="flex-1 flex items-center justify-center gap-2 px-5 py-2.5 bg-accent text-accent-foreground rounded-xl font-medium text-sm hover:bg-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trophy className="h-4 w-4" />
                  )}
                  {isSubmitting ? 'Reporting...' : 'Report Pick'}
                </button>
                <button
                  onClick={onClose}
                  className="px-5 py-2.5 bg-muted text-foreground rounded-xl font-medium text-sm hover:bg-muted/80 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
