import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Sparkles, X, BarChart3 } from 'lucide-react';
import type {
  CategoryAwareRecommendation,
  RosterCategoryAnalysis,
  AffordabilityTag,
  CategoryStrength,
} from '../../lib/types';
import { AnimatedCard } from './AnimatedCard';
import { PositionBadge } from './PositionBadge';
import { cn } from '../../lib/utils';

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
  affordable: 'bg-stat-positive/15 text-stat-positive',
  stretch: 'bg-yellow-500/15 text-yellow-500',
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
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="bg-muted/50 rounded-xl p-3.5 mb-4">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center justify-between w-full"
      >
        <div className="flex items-center gap-2">
          <BarChart3 className="h-3.5 w-3.5 text-muted-foreground" />
          <h4 className="text-xs font-semibold text-foreground">Category Strengths</h4>
        </div>
        <motion.div
          animate={{ rotate: isExpanded ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        </motion.div>
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="mt-3 pt-3 border-t border-border/50">
              <div className="grid grid-cols-9 gap-1.5">
                {analysis.categories.map((cat, index) => (
                  <motion.div
                    key={cat.category}
                    initial={{ opacity: 0, scaleY: 0 }}
                    animate={{ opacity: 1, scaleY: 1 }}
                    transition={{ delay: 0.05 + index * 0.03 }}
                    className="text-center"
                  >
                    <div
                      className={cn('h-2 rounded-full', STRENGTH_COLORS[cat.strength])}
                      title={`${cat.category}: ${cat.strength} (z=${cat.z_score.toFixed(1)})`}
                    />
                    <span className="text-[9px] text-muted-foreground font-medium mt-0.5 block">
                      {cat.category}
                    </span>
                  </motion.div>
                ))}
              </div>
              <div className="flex gap-4 mt-2.5 text-[11px]">
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
          </motion.div>
        )}
      </AnimatePresence>
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
    <div className="bg-muted/50 rounded-xl p-3.5 mb-4">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center justify-between w-full"
      >
        <span className="text-xs font-semibold text-foreground">
          Filters & Scoring
        </span>
        <div className="flex items-center gap-2">
          {skippedCount > 0 && (
            <span
              onClick={(e) => { e.stopPropagation(); onClearSkipped(); }}
              className="text-[11px] text-accent hover:text-accent/80 transition-colors"
            >
              Clear {skippedCount} skipped
            </span>
          )}
          <motion.div
            animate={{ rotate: isExpanded ? 180 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          </motion.div>
        </div>
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="mt-3 space-y-3 pt-3 border-t border-border/50">
              {/* Scoring Mode Toggle */}
              <div>
                <label className="text-[11px] text-muted-foreground font-medium block mb-1.5">
                  Scoring Mode
                </label>
                <div className="flex gap-1">
                  {(Object.keys(SCORING_MODE_LABELS) as ScoringMode[]).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => onFiltersChange({ ...filters, scoringMode: mode })}
                      className={cn(
                        'flex-1 px-2 py-1.5 text-[11px] rounded-lg font-medium transition-all',
                        filters.scoringMode === mode
                          ? 'bg-accent text-accent-foreground shadow-sm'
                          : 'bg-background text-muted-foreground hover:text-foreground',
                      )}
                      title={SCORING_MODE_LABELS[mode].description}
                    >
                      {SCORING_MODE_LABELS[mode].label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Position Filter */}
              <div>
                <label className="text-[11px] text-muted-foreground font-medium block mb-1.5">
                  Position
                </label>
                <div className="flex gap-1">
                  <button
                    onClick={() => onFiltersChange({ ...filters, position: undefined })}
                    className={cn(
                      'px-2.5 py-1.5 text-[11px] rounded-lg font-medium transition-all',
                      !filters.position
                        ? 'bg-accent text-accent-foreground shadow-sm'
                        : 'bg-background text-muted-foreground hover:text-foreground',
                    )}
                  >
                    All
                  </button>
                  {POSITIONS.map((pos) => (
                    <button
                      key={pos}
                      onClick={() => onFiltersChange({ ...filters, position: pos })}
                      className={cn(
                        'px-2.5 py-1.5 text-[11px] rounded-lg font-medium transition-all',
                        filters.position === pos
                          ? 'bg-accent text-accent-foreground shadow-sm'
                          : 'bg-background text-muted-foreground hover:text-foreground',
                      )}
                    >
                      {pos}
                    </button>
                  ))}
                </div>
              </div>

              {/* Cost Range */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] text-muted-foreground font-medium block mb-1">
                    Min Cost ($)
                  </label>
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
                    className="w-full px-2.5 py-1.5 text-xs border border-border rounded-lg bg-background text-foreground"
                    placeholder="1"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-muted-foreground font-medium block mb-1">
                    Max Cost ($)
                  </label>
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
                    className="w-full px-2.5 py-1.5 text-xs border border-border rounded-lg bg-background text-foreground"
                    placeholder="200"
                  />
                </div>
              </div>

              {/* FPTS Range */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] text-muted-foreground font-medium block mb-1">
                    Min FPTS
                  </label>
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
                    className="w-full px-2.5 py-1.5 text-xs border border-border rounded-lg bg-background text-foreground"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-muted-foreground font-medium block mb-1">
                    Max FPTS
                  </label>
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
                    className="w-full px-2.5 py-1.5 text-xs border border-border rounded-lg bg-background text-foreground"
                    placeholder="70"
                  />
                </div>
              </div>

              {/* Affordability Filter */}
              <div>
                <label className="text-[11px] text-muted-foreground font-medium block mb-1.5">
                  Affordability
                </label>
                <div className="flex gap-2">
                  {(['affordable', 'stretch'] as AffordabilityTag[]).map((tag) => (
                    <label key={tag} className="flex items-center gap-1.5 text-[11px] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={filters.affordability.length === 0 || filters.affordability.includes(tag)}
                        onChange={(e) => {
                          if (filters.affordability.length === 0) {
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
                      <span className={cn('px-1.5 py-0.5 rounded-md text-[10px] font-medium', AFFORDABILITY_COLORS[tag])}>
                        {AFFORDABILITY_LABELS[tag]}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
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
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.2 }}
      className="overflow-hidden"
    >
      <div className="grid grid-cols-3 gap-2 mt-2.5 p-2.5 bg-muted/50 rounded-lg text-xs">
        {stats.map((stat) => (
          <div key={stat.label} className="text-center">
            <div className="text-[10px] text-muted-foreground font-medium">{stat.label}</div>
            <div className="font-semibold text-foreground tabular-nums">{stat.value}</div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

function RecommendationCard({
  rec,
  index,
  onDraft,
  onMarkTaken,
  onSkip,
  budgetRemaining,
  draftCost,
  setDraftCost,
}: {
  rec: CategoryAwareRecommendation;
  index: number;
  onDraft: (playerId: string, cost: number) => void;
  onMarkTaken: (playerId: string) => void;
  onSkip: (playerId: string) => void;
  budgetRemaining: number;
  draftCost: number | undefined;
  setDraftCost: (cost: number) => void;
}) {
  const [showStats, setShowStats] = useState(false);
  const cost = draftCost ?? rec.suggested_max_bid;
  const fptsPerDollar = rec.projected_fpts / Math.max(rec.auction_value, 1);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.2, delay: index * 0.03 }}
      className="p-3.5 border border-border rounded-xl bg-card hover:border-accent/30 hover:shadow-glow/30 transition-all group"
    >
      {/* Player info header */}
      <div className="flex justify-between items-start mb-2.5">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-foreground text-sm">{rec.name}</span>
            <span className="text-xs text-muted-foreground">{rec.team}</span>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <PositionBadge position={rec.position} />
            <span className="text-[10px] text-muted-foreground">
              fills {rec.fills_slot}
            </span>
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="font-bold text-accent tabular-nums">${rec.suggested_max_bid}</div>
          <div className="text-xs text-muted-foreground tabular-nums">
            {rec.projected_fpts.toFixed(1)} FPTS
          </div>
          <div className="text-[10px] text-muted-foreground/60 tabular-nums">
            {fptsPerDollar.toFixed(2)} FPTS/$
          </div>
        </div>
      </div>

      {/* Badges */}
      <div className="flex flex-wrap gap-1 mb-2.5">
        <span
          className={cn('text-[10px] px-2 py-0.5 rounded-md font-medium', AFFORDABILITY_COLORS[rec.affordability])}
        >
          {AFFORDABILITY_LABELS[rec.affordability]}
        </span>
        {rec.target_categories.slice(0, 3).map((cat) => (
          <span
            key={cat}
            className="text-[10px] px-2 py-0.5 rounded-md bg-accent/10 text-accent font-medium"
          >
            {cat}
          </span>
        ))}
        <span className="text-[10px] text-muted-foreground ml-0.5">
          Fit: {rec.category_fit_score.toFixed(0)}%
        </span>
      </div>

      {/* Show Stats toggle */}
      <button
        onClick={() => setShowStats(!showStats)}
        className="text-[11px] text-accent hover:text-accent/80 font-medium mb-2 transition-colors"
      >
        {showStats ? 'Hide Stats' : 'Show Stats'}
      </button>

      {/* Stats grid */}
      <AnimatePresence>
        {showStats && <StatsGrid rec={rec} />}
      </AnimatePresence>

      {/* Actions */}
      <div className="flex items-center gap-1.5 mt-2.5">
        <input
          type="number"
          min={1}
          max={budgetRemaining}
          value={cost}
          onChange={(e) => setDraftCost(Number(e.target.value))}
          className="w-14 px-2 py-1.5 border border-border rounded-lg text-center text-xs bg-background text-foreground tabular-nums"
          placeholder="$"
        />
        <button
          onClick={() => onDraft(rec.player_id, cost)}
          disabled={cost > budgetRemaining}
          className={cn(
            'flex-1 px-3 py-1.5 text-xs font-medium rounded-lg transition-all',
            'bg-accent text-accent-foreground hover:bg-accent/90',
            'disabled:bg-muted disabled:text-muted-foreground disabled:cursor-not-allowed',
          )}
        >
          Draft
        </button>
        <button
          onClick={() => onMarkTaken(rec.player_id)}
          className="px-2.5 py-1.5 text-xs font-medium bg-muted text-foreground rounded-lg hover:bg-muted/80 transition-colors"
        >
          Taken
        </button>
        <button
          onClick={() => onSkip(rec.player_id)}
          className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted/60 transition-colors"
          title="Skip this player"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </motion.div>
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

  const currentRecs = activeTab === 'fill_gap' ? fillGapRecommendations : reinforceRecommendations;

  return (
    <AnimatedCard className="p-5" delay={0.15}>
      {/* Header */}
      <div className="flex items-center gap-2.5 mb-4">
        <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
          <Sparkles className="h-4 w-4 text-accent" />
        </div>
        <h3 className="text-base font-semibold text-foreground">Smart Recommendations</h3>
      </div>

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
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-muted-foreground text-center py-8 text-sm"
        >
          No recommendations available
        </motion.p>
      ) : (
        <>
          {/* Tab buttons with animated underline */}
          <div className="flex border-b border-border mb-4 relative">
            <button
              onClick={() => setActiveTab('fill_gap')}
              className={cn(
                'flex-1 py-2.5 text-xs font-semibold transition-colors relative',
                activeTab === 'fill_gap'
                  ? 'text-stat-negative'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              Fill Gaps ({fillGapRecommendations.length})
              {activeTab === 'fill_gap' && (
                <motion.div
                  layoutId="rec-tab-underline"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-stat-negative rounded-full"
                />
              )}
            </button>
            <button
              onClick={() => setActiveTab('reinforce')}
              className={cn(
                'flex-1 py-2.5 text-xs font-semibold transition-colors relative',
                activeTab === 'reinforce'
                  ? 'text-stat-positive'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              Reinforce ({reinforceRecommendations.length})
              {activeTab === 'reinforce' && (
                <motion.div
                  layoutId="rec-tab-underline"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-stat-positive rounded-full"
                />
              )}
            </button>
          </div>

          {/* Recommendation list with AnimatePresence */}
          <div className="max-h-[500px] overflow-y-auto">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, x: activeTab === 'fill_gap' ? -10 : 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: activeTab === 'fill_gap' ? 10 : -10 }}
                transition={{ duration: 0.2 }}
                className="space-y-3"
              >
                {currentRecs.length > 0 ? (
                  currentRecs.map((rec, index) => (
                    <RecommendationCard
                      key={rec.player_id}
                      rec={rec}
                      index={index}
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
                  <p className="text-muted-foreground text-center py-8 text-sm">
                    {activeTab === 'fill_gap'
                      ? 'No weak categories to fill yet. Draft some players first!'
                      : 'No strong categories to reinforce yet. Draft some players first!'}
                  </p>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </>
      )}
    </AnimatedCard>
  );
}
