import { useState, useEffect } from 'react';
import { listDraftSessions, createDraftSession, deleteDraftSession } from '../../lib/api';
import type { DraftSessionListItem } from '../../lib/types';

interface SessionPickerProps {
  onSelectSession: (sessionId: number) => void;
}

export function SessionPicker({ onSelectSession }: SessionPickerProps) {
  const [sessions, setSessions] = useState<DraftSessionListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // New session form state
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [budget, setBudget] = useState(200);
  const [numTeams, setNumTeams] = useState(12);
  const [season, setSeason] = useState('2024-25');

  const loadSessions = async () => {
    setIsLoading(true);
    try {
      const data = await listDraftSessions();
      setSessions(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sessions');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSessions();
  }, []);

  const handleCreate = async () => {
    setIsCreating(true);
    setError(null);
    try {
      const session = await createDraftSession(
        numTeams,
        budget,
        name || 'Draft Session',
        season,
      );
      onSelectSession(session.session_id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create session');
      setIsCreating(false);
    }
  };

  const handleDelete = async (sessionId: number) => {
    try {
      await deleteDraftSession(sessionId);
      setSessions(sessions.filter(s => s.id !== sessionId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete session');
    }
  };

  const formatDate = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  return (
    <div className="max-w-2xl mx-auto">
      <h2 className="text-xl font-bold text-foreground mb-6">Your Draft Sessions</h2>

      {error && (
        <div className="bg-stat-negative/10 border-l-4 border-stat-negative p-3 mb-4">
          <p className="text-stat-negative text-sm">{error}</p>
        </div>
      )}

      {/* Existing sessions */}
      {isLoading ? (
        <div className="text-muted-foreground text-center py-8">Loading sessions...</div>
      ) : sessions.length > 0 ? (
        <div className="space-y-3 mb-6">
          {sessions.map(session => (
            <div
              key={session.id}
              className="bg-card border border-border rounded-lg p-4 flex items-center justify-between"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-foreground">{session.name}</span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded ${
                      session.status === 'active'
                        ? 'bg-stat-positive/10 text-stat-positive'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {session.status}
                  </span>
                </div>
                <div className="text-sm text-muted-foreground mt-1">
                  {session.pick_count} picks &middot; ${session.budget_total} budget &middot;{' '}
                  {session.num_teams} teams &middot; {session.season}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {formatDate(session.updated_at)}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {session.status === 'active' && (
                  <button
                    onClick={() => onSelectSession(session.id)}
                    className="px-4 py-2 bg-accent text-accent-foreground rounded hover:bg-accent/90 text-sm font-medium transition-colors"
                  >
                    Resume
                  </button>
                )}
                <button
                  onClick={() => handleDelete(session.id)}
                  className="px-3 py-2 text-sm text-muted-foreground hover:text-stat-negative transition-colors"
                  title="Delete session"
                >
                  &times;
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center text-muted-foreground py-8 mb-6">
          No draft sessions yet. Create one to get started.
        </div>
      )}

      {/* Create new session */}
      {!showForm ? (
        <button
          onClick={() => setShowForm(true)}
          className="w-full px-6 py-3 bg-accent text-accent-foreground rounded-lg hover:bg-accent/90 font-semibold transition-colors"
        >
          New Draft Session
        </button>
      ) : (
        <div className="bg-card border border-border rounded-lg p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4">New Draft Session</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">
                Session Name
              </label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g., Yahoo League 2026"
                className="w-full px-3 py-2 bg-input border border-border rounded text-foreground placeholder-muted-foreground"
              />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">
                  Budget
                </label>
                <input
                  type="number"
                  value={budget}
                  onChange={e => setBudget(Number(e.target.value))}
                  min={50}
                  max={1000}
                  className="w-full px-3 py-2 bg-input border border-border rounded text-foreground"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">
                  Teams
                </label>
                <input
                  type="number"
                  value={numTeams}
                  onChange={e => setNumTeams(Number(e.target.value))}
                  min={4}
                  max={20}
                  className="w-full px-3 py-2 bg-input border border-border rounded text-foreground"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">
                  Season
                </label>
                <input
                  type="text"
                  value={season}
                  onChange={e => setSeason(e.target.value)}
                  placeholder="2024-25"
                  className="w-full px-3 py-2 bg-input border border-border rounded text-foreground"
                />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                onClick={handleCreate}
                disabled={isCreating}
                className="flex-1 px-4 py-2 bg-accent text-accent-foreground rounded hover:bg-accent/90 disabled:bg-muted disabled:text-muted-foreground font-medium transition-colors"
              >
                {isCreating ? 'Creating...' : 'Create Session'}
              </button>
              <button
                onClick={() => setShowForm(false)}
                className="px-4 py-2 bg-muted text-foreground rounded hover:bg-muted/80 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
