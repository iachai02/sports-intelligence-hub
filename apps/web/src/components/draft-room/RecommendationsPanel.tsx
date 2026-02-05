import { useState } from 'react';
import type {
  CategoryAwareRecommendation,
  RosterCategoryAnalysis,
  AffordabilityTag,
  CategoryStrength,
} from '../../lib/types';

export type ScoringMode = 'balanced' | 'value' | 'production';

export interface RecommendationFilters {
  position?: string;
  scoringMode: ScoringMode;
  minCost?: number;
  maxCost?: number;
  minFpts?: number;
  maxFpts?: number;
  affordability: string[];
}

interface RecommendationsPanelProps {
  rosterAnalysis: RosterCategoryAnalysis | null;
  fillGapRecommendations: CategoryAwareRecommendation[];
  reinforceRecommendations: CategoryAwareRecommendation[];
  onDraft: (playerId: string, cost: number) => void;
  onMarkTaken: (playerId: string) => void;
  onSkip: (playerId: string) => void;
  budgetRemaining: number;
  filters: RecommendationFilters;
  onFiltersChange: (filters: RecommendationFilters) => void;
  skippedCount: number;
  onClearSkipped: () => void;
}

const AFFORDABILITY_COLORS: Record<AffordabilityTag, string> = {
  affordable: 'bg-stat-positive/20 text-stat-positive',
  stretch: 'bg-yellow-500/20 text-yellow-500',
};

const AFFORDABILITY_LABELS: Record<AffordabilityTag, string> = {
  affordable: 'Affordable',
  stretch: 'Stretch',
};

const STRENGTH_COLORS: Record<CategoryStrength, string> = {
  strong: 'bg-stat-positive',
  average: 'bg-muted-foreground',
  weak: 'bg-stat-negative',
};

const POSITIONS = ['PG', 'SG', 'SF', 'PF', 'C'];

const SCORING_MODE_LABELS: Record<ScoringMode, { label: string; description: string }> = {
  balanced: { label: 'Balanced', description: '25% each: fit, FPTS, value, efficiency' },
  value: { label: 'Value', description: 'Prioritizes FPTS per dollar' },
  production: { label: 'Production', description: 'Prioritizes raw FPTS output' },
};

function CategoryStrengthBar({ analysis }: { analysis: RosterCategoryAnalysis }) {
  return (
    <div className="bg-muted rounded-lg p-3 mb-4">
      <h4 className="text-sm font-medium mb-2 text-foreground">Category Strengths</h4>
      <div className="grid grid-cols-9 gap-1">
        {analysis.categories.map((cat) => (
          <div key={cat.category} className="text-center">
            <div
              className={`h-2 rounded-full ${STRENGTH_COLORS[cat.strength]}`}
              title={`${cat.category}: ${cat.strength} (z=${cat.z_score})`}
            />
            <span className="text-[10px] text-muted-foreground">{cat.category}</span>
          </div>
        ))}
      </div>
      <div className="flex gap-4 mt-2 text-xs">
        {analysis.weak_categories.length > 0 && (
          <span className="text-stat-negative">
            Weak: {analysis.weak_categories.join(', ')}
          </span>
        )}
        {analysis.strong_categories.length > 0 && (
          <span className="text-stat-positive">
            Strong: {analysis.strong_categories.join(', ')}
          </span>
        )}
      </div>
    </div>
  );
}

function FiltersPanel({
  filters,
  onFiltersChange,
  skippedCount,
  onClearSkipped,
}: {
  filters: RecommendationFilters;
  onFiltersChange: (filters: RecommendationFilters) => void;
  skippedCount: number;
  onClearSkipped: () => void;
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="bg-muted rounded-lg p-3 mb-4">
      <div className="flex justify-between items-center">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-sm font-medium flex items-center gap-1 text-foreground"
        >
          Filters & Scoring
          <svg
            className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {skippedCount > 0 && (
          <button
            onClick={onClearSkipped}
            className="text-xs text-accent hover:text-accent/80"
          >
            Clear {skippedCount} skipped
          </button>
        )}
      </div>

      {isExpanded && (
        <div className="mt-3 space-y-3">
          {/* Scoring Mode Toggle */}
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Scoring Mode</label>
            <div className="flex gap-1">
              {(Object.keys(SCORING_MODE_LABELS) as ScoringMode[]).map((mode) => (
                <button
                  key={mode}
                  onClick={() => onFiltersChange({ ...filters, scoringMode: mode })}
                  className={`flex-1 px-2 py-1 text-xs rounded transition ${
                    filters.scoringMode === mode
                      ? 'bg-accent text-accent-foreground'
                      : 'bg-background text-muted-foreground hover:bg-background/80 hover:text-foreground'
                  }`}
                  title={SCORING_MODE_LABELS[mode].description}
                >
                  {SCORING_MODE_LABELS[mode].label}
                </button>
              ))}
            </div>
          </div>

          {/* Position Filter */}
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Position</label>
            <div className="flex gap-1">
              <button
                onClick={() => onFiltersChange({ ...filters, position: undefined })}
                className={`px-2 py-1 text-xs rounded transition ${
                  !filters.position
                    ? 'bg-accent text-accent-foreground'
                    : 'bg-background text-muted-foreground hover:bg-background/80 hover:text-foreground'
                }`}
              >
                All
              </button>
              {POSITIONS.map((pos) => (
                <button
                  key={pos}
                  onClick={() => onFiltersChange({ ...filters, position: pos })}
                  className={`px-2 py-1 text-xs rounded transition ${
                    filters.position === pos
                      ? 'bg-accent text-accent-foreground'
                      : 'bg-background text-muted-foreground hover:bg-background/80 hover:text-foreground'
                  }`}
                >
                  {pos}
                </button>
              ))}
            </div>
          </div>

          {/* Cost Range */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Min Cost ($)</label>
              <input
                type="number"
                min={1}
                value={filters.minCost ?? ''}
                onChange={(e) =>
                  onFiltersChange({
                    ...filters,
                    minCost: e.target.value ? Number(e.target.value) : undefined,
                  })
                }
                className="w-full px-2 py-1 text-sm border border-border rounded bg-background text-foreground"
                placeholder="1"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Max Cost ($)</label>
              <input
                type="number"
                min={1}
                value={filters.maxCost ?? ''}
                onChange={(e) =>
                  onFiltersChange({
                    ...filters,
                    maxCost: e.target.value ? Number(e.target.value) : undefined,
                  })
                }
                className="w-full px-2 py-1 text-sm border border-border rounded bg-background text-foreground"
                placeholder="200"
              />
            </div>
          </div>

          {/* FPTS Range */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Min FPTS</label>
              <input
                type="number"
                min={0}
                value={filters.minFpts ?? ''}
                onChange={(e) =>
                  onFiltersChange({
                    ...filters,
                    minFpts: e.target.value ? Number(e.target.value) : undefined,
                  })
                }
                className="w-full px-2 py-1 text-sm border border-border rounded bg-background text-foreground"
                placeholder="0"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Max FPTS</label>
              <input
                type="number"
                min={0}
                value={filters.maxFpts ?? ''}
                onChange={(e) =>
                  onFiltersChange({
                    ...filters,
                    maxFpts: e.target.value ? Number(e.target.value) : undefined,
                  })
                }
                className="w-full px-2 py-1 text-sm border border-border rounded bg-background text-foreground"
                placeholder="70"
              />
            </div>
          </div>

          {/* Affordability Filter */}
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Affordability</label>
            <div className="flex gap-2">
              {(['affordable', 'stretch'] as AffordabilityTag[]).map((tag) => (
                <label key={tag} className="flex items-center gap-1 text-xs">
                  <input
                    type="checkbox"
                    checked={filters.affordability.length === 0 || filters.affordability.includes(tag)}
                    onChange={(e) => {
                      if (filters.affordability.length === 0) {
                        // Currently showing all, now filter to just this one
                        onFiltersChange({ ...filters, affordability: [tag] });
                      } else if (e.target.checked) {
                        onFiltersChange({
                          ...filters,
                          affordability: [...filters.affordability, tag],
                        });
                      } else {
                        const newAffordability = filters.affordability.filter((t) => t !== tag);
                        onFiltersChange({
                          ...filters,
                          affordability: newAffordability.length === 2 ? [] : newAffordability,
                        });
                      }
                    }}
                    className="rounded"
                  />
                  <span className={`px-1.5 py-0.5 rounded ${AFFORDABILITY_COLORS[tag]}`}>
                    {AFFORDABILITY_LABELS[tag]}
                  </span>
                </label>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatsGrid({ rec }: { rec: CategoryAwareRecommendation }) {
  const stats = [
    { label: 'PPG', value: rec.points.toFixed(1) },
    { label: 'RPG', value: rec.rebounds.toFixed(1) },
    { label: 'APG', value: rec.assists.toFixed(1) },
    { label: 'SPG', value: rec.steals.toFixed(1) },
    { label: 'BPG', value: rec.blocks.toFixed(1) },
    { label: 'TOV', value: rec.turnovers.toFixed(1) },
    { label: 'FG%', value: (rec.fg_pct * 100).toFixed(1) },
    { label: 'FT%', value: (rec.ft_pct * 100).toFixed(1) },
    { label: '3PM', value: rec.three_made.toFixed(1) },
  ];

  return (
    <div className="grid grid-cols-3 gap-2 mt-2 p-2 bg-muted rounded text-xs">
      {stats.map((stat) => (
        <div key={stat.label} className="text-center">
          <div className="text-muted-foreground">{stat.label}</div>
          <div className="font-semibold text-foreground">{stat.value}</div>
        </div>
      ))}
    </div>
  );
}

function RecommendationCard({
  rec,
  onDraft,
  onMarkTaken,
  onSkip,
  budgetRemaining,
  draftCost,
  setDraftCost,
}: {
  rec: CategoryAwareRecommendation;
  onDraft: (playerId: string, cost: number) => void;
  onMarkTaken: (playerId: string) => void;
  onSkip: (playerId: string) => void;
  budgetRemaining: number;
  draftCost: number | undefined;
  setDraftCost: (cost: number) => void;
}) {
  const [showStats, setShowStats] = useState(false);
  const cost = draftCost ?? rec.suggested_max_bid;

  // Calculate FPTS per dollar for display
  const fptsPerDollar = rec.projected_fpts / Math.max(rec.auction_value, 1);

  return (
    <div className="p-3 border border-border rounded-lg hover:border-accent/50 transition bg-card">
      {/* Player info */}
      <div className="flex justify-between items-start mb-2">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-foreground">{rec.name}</span>
            <span className="text-sm text-muted-foreground">{rec.team}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="bg-muted px-2 py-0.5 rounded text-muted-foreground">{rec.position}</span>
            <span className="text-muted-foreground">→ {rec.fills_slot}</span>
          </div>
        </div>
        <div className="text-right">
          <div className="font-bold text-accent">${rec.suggested_max_bid}</div>
          <div className="text-sm text-muted-foreground">{rec.projected_fpts.toFixed(1)} FPTS</div>
          <div className="text-xs text-muted-foreground/70">{fptsPerDollar.toFixed(2)} FPTS/$</div>
        </div>
      </div>

      {/* Affordability + Category badges */}
      <div className="flex flex-wrap gap-1 mb-2">
        <span
          className={`text-xs px-2 py-0.5 rounded ${AFFORDABILITY_COLORS[rec.affordability]}`}
        >
          {AFFORDABILITY_LABELS[rec.affordability]}
        </span>
        {rec.target_categories.slice(0, 3).map((cat) => (
          <span
            key={cat}
            className="text-xs px-2 py-0.5 rounded bg-accent/20 text-accent"
          >
            {cat}
          </span>
        ))}
        <span className="text-xs text-muted-foreground ml-1">
          Fit: {rec.category_fit_score.toFixed(0)}%
        </span>
      </div>

      {/* Show Stats toggle */}
      <button
        onClick={() => setShowStats(!showStats)}
        className="text-xs text-accent hover:text-accent/80 mb-2"
      >
        {showStats ? 'Hide Stats' : 'Show Stats'}
      </button>

      {/* Expandable stats grid */}
      {showStats && <StatsGrid rec={rec} />}

      {/* Actions */}
      <div className="flex items-center gap-2 mt-2">
        <input
          type="number"
          min={1}
          max={budgetRemaining}
          value={cost}
          onChange={(e) => setDraftCost(Number(e.target.value))}
          className="w-16 px-2 py-1 border border-border rounded text-center text-sm bg-background text-foreground"
          placeholder="$"
        />
        <button
          onClick={() => onDraft(rec.player_id, cost)}
          disabled={cost > budgetRemaining}
          className="flex-1 px-3 py-1 text-sm bg-accent text-accent-foreground rounded hover:bg-accent/90 disabled:bg-muted disabled:text-muted-foreground disabled:cursor-not-allowed transition-colors"
        >
          Draft
        </button>
        <button
          onClick={() => onMarkTaken(rec.player_id)}
          className="px-3 py-1 text-sm bg-muted text-foreground rounded hover:bg-muted/80 transition-colors"
        >
          Taken
        </button>
        <button
          onClick={() => onSkip(rec.player_id)}
          className="px-2 py-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
          title="Skip this player"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}

export function RecommendationsPanel({
  rosterAnalysis,
  fillGapRecommendations,
  reinforceRecommendations,
  onDraft,
  onMarkTaken,
  onSkip,
  budgetRemaining,
  filters,
  onFiltersChange,
  skippedCount,
  onClearSkipped,
}: RecommendationsPanelProps) {
  const [draftCosts, setDraftCosts] = useState<Record<string, number>>({});
  const [activeTab, setActiveTab] = useState<'fill_gap' | 'reinforce'>('fill_gap');

  const handleDraft = (rec: CategoryAwareRecommendation) => {
    const cost = draftCosts[rec.player_id] ?? rec.suggested_max_bid;
    onDraft(rec.player_id, cost);
    setDraftCosts((prev) => {
      const next = { ...prev };
      delete next[rec.player_id];
      return next;
    });
  };

  const hasNoRecommendations =
    fillGapRecommendations.length === 0 && reinforceRecommendations.length === 0;

  return (
    <div className="bg-card border border-border rounded-lg shadow p-4">
      <h3 className="text-lg font-semibold mb-4 text-foreground">Smart Recommendations</h3>

      {/* Filters */}
      <FiltersPanel
        filters={filters}
        onFiltersChange={onFiltersChange}
        skippedCount={skippedCount}
        onClearSkipped={onClearSkipped}
      />

      {/* Category strength bar */}
      {rosterAnalysis && rosterAnalysis.categories.length > 0 && (
        <CategoryStrengthBar analysis={rosterAnalysis} />
      )}

      {hasNoRecommendations ? (
        <p className="text-muted-foreground text-center py-4">No recommendations available</p>
      ) : (
        <>
          {/* Tab buttons */}
          <div className="flex border-b border-border mb-4">
            <button
              onClick={() => setActiveTab('fill_gap')}
              className={`flex-1 py-2 text-sm font-medium border-b-2 transition ${
                activeTab === 'fill_gap'
                  ? 'border-stat-negative text-stat-negative'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              Fill Gaps ({fillGapRecommendations.length})
            </button>
            <button
              onClick={() => setActiveTab('reinforce')}
              className={`flex-1 py-2 text-sm font-medium border-b-2 transition ${
                activeTab === 'reinforce'
                  ? 'border-stat-positive text-stat-positive'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              Reinforce ({reinforceRecommendations.length})
            </button>
          </div>

          {/* Recommendation list */}
          <div className="space-y-3 max-h-[500px] overflow-y-auto">
            {activeTab === 'fill_gap' ? (
              fillGapRecommendations.length > 0 ? (
                fillGapRecommendations.map((rec) => (
                  <RecommendationCard
                    key={rec.player_id}
                    rec={rec}
                    onDraft={() => handleDraft(rec)}
                    onMarkTaken={onMarkTaken}
                    onSkip={onSkip}
                    budgetRemaining={budgetRemaining}
                    draftCost={draftCosts[rec.player_id]}
                    setDraftCost={(cost) =>
                      setDraftCosts((prev) => ({ ...prev, [rec.player_id]: cost }))
                    }
                  />
                ))
              ) : (
                <p className="text-muted-foreground text-center py-4">
                  No weak categories to fill yet. Draft some players first!
                </p>
              )
            ) : reinforceRecommendations.length > 0 ? (
              reinforceRecommendations.map((rec) => (
                <RecommendationCard
                  key={rec.player_id}
                  rec={rec}
                  onDraft={() => handleDraft(rec)}
                  onMarkTaken={onMarkTaken}
                  onSkip={onSkip}
                  budgetRemaining={budgetRemaining}
                  draftCost={draftCosts[rec.player_id]}
                  setDraftCost={(cost) =>
                    setDraftCosts((prev) => ({ ...prev, [rec.player_id]: cost }))
                  }
                />
              ))
            ) : (
              <p className="text-muted-foreground text-center py-4">
                No strong categories to reinforce yet. Draft some players first!
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
