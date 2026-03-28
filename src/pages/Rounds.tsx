import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  createColumnHelper,
  type Column,
  type SortingState,
} from '@tanstack/react-table';
import { getAllRounds, getRoundById, getRoundsCounts, getScoreTypes } from '../api/mongodb';
import { useAuth } from '../contexts/AuthContext';
import type { RoundSummary, HoleScore } from '../types';

type HoleRangeValue = '' | '1-9' | '10-18' | '18';
type RoundSortField =
  | 'roundDate'
  | 'startTime'
  | 'golferName'
  | 'golflinkNo'
  | 'clubName'
  | 'state'
  | 'compType'
  | 'dailyHandicap'
  | 'holeCount'
  | 'isSubmitted';

type RoundsFilterState = {
  roundDateFrom: string;
  roundDateTo: string;
  startTimeFrom: string;
  startTimeTo: string;
  golferName: string;
  golflinkNo: string;
  clubName: string;
  state: string;
  compType: string;
  handicapMin: string;
  handicapMax: string;
  holeRange: HoleRangeValue;
  isSubmitted: string;
};

// Debounce hook
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

const columnHelper = createColumnHelper<RoundSummary>();

const stateOptions = ['NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'NT', 'ACT'];
const submittedOptions = [
  { value: '', label: 'All' },
  { value: 'true', label: 'Yes' },
  { value: 'false', label: 'No' },
];

const holeRangeOptions: { value: HoleRangeValue; label: string }[] = [
  { value: '', label: 'All' },
  { value: '1-9', label: '1-9 holes' },
  { value: '10-18', label: '10-18 holes' },
  { value: '18', label: '18 holes' },
];

const DEFAULT_FILTERS: RoundsFilterState = {
  roundDateFrom: '',
  roundDateTo: '',
  startTimeFrom: '',
  startTimeTo: '',
  golferName: '',
  golflinkNo: '',
  clubName: '',
  state: '',
  compType: '',
  handicapMin: '',
  handicapMax: '',
  holeRange: '',
  isSubmitted: '',
};

const ADVANCED_FILTER_KEYS: Array<keyof RoundsFilterState> = [
  'startTimeFrom',
  'startTimeTo',
  'clubName',
  'state',
  'compType',
  'handicapMin',
  'handicapMax',
  'holeRange',
  'isSubmitted',
];

const SORTABLE_COLUMN_IDS: RoundSortField[] = [
  'roundDate',
  'startTime',
  'golferName',
  'golflinkNo',
  'clubName',
  'state',
  'compType',
  'dailyHandicap',
  'holeCount',
  'isSubmitted',
];

const DEFAULT_SORTING: SortingState = [{ id: 'startTime', desc: true }];
const STORAGE_KEY = 'rounds-view-state-v2';
const FILTER_INPUT_CLASSES =
  'w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400';
const FILTER_LABEL_CLASSES = 'mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400';

function getHoleRangeBounds(holeRange: HoleRangeValue): { min?: number; max?: number } {
  switch (holeRange) {
    case '1-9':
      return { min: 1, max: 9 };
    case '10-18':
      return { min: 10, max: 18 };
    case '18':
      return { min: 18, max: 18 };
    default:
      return {};
  }
}

// Scorecard table component for displaying hole-by-hole scores
function ScorecardTable({ holeScores }: { holeScores: HoleScore[] }) {
  const sortedHoles = [...holeScores].sort((a, b) => a.holeNumber - b.holeNumber);
  const is18Hole = sortedHoles.length >= 18;

  const front9 = sortedHoles.filter(h => h.holeNumber <= 9);
  const back9 = sortedHoles.filter(h => h.holeNumber > 9 && h.holeNumber <= 18);

  const sumField = (holes: HoleScore[], field: keyof HoleScore) => {
    return holes.reduce((sum, h) => sum + (Number(h[field]) || 0), 0);
  };

  const SubtotalRow = ({ label, holes }: { label: string; holes: HoleScore[] }) => (
    <tr className="bg-gray-200 dark:bg-gray-600 font-semibold">
      <td className="px-2 py-1 text-xs text-gray-900 dark:text-gray-100">{label}</td>
      <td className="px-2 py-1 text-xs text-right text-gray-900 dark:text-gray-100">{sumField(holes, 'par')}</td>
      <td className="px-2 py-1 text-xs text-right text-gray-900 dark:text-gray-100">{sumField(holes, 'meters')}</td>
      <td className="px-2 py-1 text-xs text-right text-gray-900 dark:text-gray-100">-</td>
      <td className="px-2 py-1 text-xs text-right text-gray-900 dark:text-gray-100">-</td>
      <td className="px-2 py-1 text-xs text-right text-gray-900 dark:text-gray-100">-</td>
      <td className="px-2 py-1 text-xs text-right text-gray-900 dark:text-gray-100">{sumField(holes, 'strokes')}</td>
      <td className="px-2 py-1 text-xs text-right text-gray-900 dark:text-gray-100">{sumField(holes, 'score')}</td>
    </tr>
  );

  return (
    <table className="text-xs border border-gray-300 dark:border-gray-600">
      <thead className="bg-gray-100 dark:bg-gray-700">
        <tr>
          <th className="px-2 py-1 text-left font-medium text-gray-600 dark:text-gray-300">Hole</th>
          <th className="px-2 py-1 text-right font-medium text-gray-600 dark:text-gray-300">Par</th>
          <th className="px-2 py-1 text-right font-medium text-gray-600 dark:text-gray-300">Meters</th>
          <th className="px-2 py-1 text-right font-medium text-gray-600 dark:text-gray-300">Idx 1</th>
          <th className="px-2 py-1 text-right font-medium text-gray-600 dark:text-gray-300">Idx 2</th>
          <th className="px-2 py-1 text-right font-medium text-gray-600 dark:text-gray-300">Idx 3</th>
          <th className="px-2 py-1 text-right font-medium text-gray-600 dark:text-gray-300">Strokes</th>
          <th className="px-2 py-1 text-right font-medium text-gray-600 dark:text-gray-300">Points</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-200 dark:divide-gray-600 bg-white dark:bg-gray-800">
        {is18Hole ? (
          <>
            {front9.map((hole) => (
              <tr key={hole.holeNumber} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                <td className="px-2 py-1 text-gray-900 dark:text-gray-100">{hole.holeNumber}</td>
                <td className="px-2 py-1 text-right text-gray-900 dark:text-gray-100">{hole.par ?? '-'}</td>
                <td className="px-2 py-1 text-right text-gray-900 dark:text-gray-100">{hole.meters ?? '-'}</td>
                <td className="px-2 py-1 text-right text-gray-900 dark:text-gray-100">{hole.index1 ?? '-'}</td>
                <td className="px-2 py-1 text-right text-gray-900 dark:text-gray-100">{hole.index2 ?? '-'}</td>
                <td className="px-2 py-1 text-right text-gray-900 dark:text-gray-100">{hole.index3 ?? '-'}</td>
                <td className="px-2 py-1 text-right text-gray-900 dark:text-gray-100">{hole.strokes ?? '-'}</td>
                <td className="px-2 py-1 text-right text-gray-900 dark:text-gray-100">{hole.score ?? '-'}</td>
              </tr>
            ))}
            <SubtotalRow label="Front 9" holes={front9} />
            {back9.map((hole) => (
              <tr key={hole.holeNumber} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                <td className="px-2 py-1 text-gray-900 dark:text-gray-100">{hole.holeNumber}</td>
                <td className="px-2 py-1 text-right text-gray-900 dark:text-gray-100">{hole.par ?? '-'}</td>
                <td className="px-2 py-1 text-right text-gray-900 dark:text-gray-100">{hole.meters ?? '-'}</td>
                <td className="px-2 py-1 text-right text-gray-900 dark:text-gray-100">{hole.index1 ?? '-'}</td>
                <td className="px-2 py-1 text-right text-gray-900 dark:text-gray-100">{hole.index2 ?? '-'}</td>
                <td className="px-2 py-1 text-right text-gray-900 dark:text-gray-100">{hole.index3 ?? '-'}</td>
                <td className="px-2 py-1 text-right text-gray-900 dark:text-gray-100">{hole.strokes ?? '-'}</td>
                <td className="px-2 py-1 text-right text-gray-900 dark:text-gray-100">{hole.score ?? '-'}</td>
              </tr>
            ))}
            <SubtotalRow label="Back 9" holes={back9} />
            <SubtotalRow label="Total" holes={sortedHoles} />
          </>
        ) : (
          <>
            {sortedHoles.map((hole) => (
              <tr key={hole.holeNumber} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                <td className="px-2 py-1 text-gray-900 dark:text-gray-100">{hole.holeNumber}</td>
                <td className="px-2 py-1 text-right text-gray-900 dark:text-gray-100">{hole.par ?? '-'}</td>
                <td className="px-2 py-1 text-right text-gray-900 dark:text-gray-100">{hole.meters ?? '-'}</td>
                <td className="px-2 py-1 text-right text-gray-900 dark:text-gray-100">{hole.index1 ?? '-'}</td>
                <td className="px-2 py-1 text-right text-gray-900 dark:text-gray-100">{hole.index2 ?? '-'}</td>
                <td className="px-2 py-1 text-right text-gray-900 dark:text-gray-100">{hole.index3 ?? '-'}</td>
                <td className="px-2 py-1 text-right text-gray-900 dark:text-gray-100">{hole.strokes ?? '-'}</td>
                <td className="px-2 py-1 text-right text-gray-900 dark:text-gray-100">{hole.score ?? '-'}</td>
              </tr>
            ))}
            <SubtotalRow label="Total" holes={sortedHoles} />
          </>
        )}
      </tbody>
    </table>
  );
}

// Check if round is from today (local time)
function isToday(dateString?: string | null): boolean {
  if (!dateString) return false;
  const roundDate = new Date(dateString);
  const today = new Date();
  return (
    roundDate.getFullYear() === today.getFullYear() &&
    roundDate.getMonth() === today.getMonth() &&
    roundDate.getDate() === today.getDate()
  );
}

function formatRoundValue(value?: string | null): string {
  if (!value) return '-';
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

function parseOptionalNumber(value: string): number | undefined {
  if (!value.trim()) return undefined;

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function getTodayDateValue(): string {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseDateInputValue(value: string): Date | null {
  if (!value) return null;

  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return null;

  return new Date(year, month - 1, day);
}

function formatDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addDays(date: Date, days: number): Date {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
}

function isRoundSortField(value: string): value is RoundSortField {
  return SORTABLE_COLUMN_IDS.includes(value as RoundSortField);
}

function getInitialViewState(): { filters: RoundsFilterState; sorting: SortingState } {
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return { filters: DEFAULT_FILTERS, sorting: DEFAULT_SORTING };
    }

    const parsed = JSON.parse(stored) as {
      filters?: Partial<Record<keyof RoundsFilterState, unknown>>;
      sorting?: unknown;
    };

    const filters: RoundsFilterState = { ...DEFAULT_FILTERS };

    for (const key of Object.keys(DEFAULT_FILTERS) as Array<keyof RoundsFilterState>) {
      const value = parsed.filters?.[key];
      if (typeof value !== 'string') continue;

      if (key === 'holeRange') {
        const holeRangeValue = holeRangeOptions.some((option) => option.value === value)
          ? (value as HoleRangeValue)
          : '';
        filters[key] = holeRangeValue;
        continue;
      }

      filters[key] = value;
    }

    const sorting = Array.isArray(parsed.sorting)
      ? parsed.sorting
          .filter(
            (sort): sort is SortingState[number] =>
              typeof sort === 'object' &&
              sort !== null &&
              'id' in sort &&
              typeof sort.id === 'string' &&
              isRoundSortField(sort.id) &&
              'desc' in sort &&
              typeof sort.desc === 'boolean'
          )
          .slice(0, 1)
      : [];

    return {
      filters,
      sorting: sorting.length > 0 ? sorting : DEFAULT_SORTING,
    };
  } catch {
    return { filters: DEFAULT_FILTERS, sorting: DEFAULT_SORTING };
  }
}

function FilterField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className={FILTER_LABEL_CLASSES}>{label}</label>
      {children}
    </div>
  );
}

function SortIndicator({ direction }: { direction: false | 'asc' | 'desc' }) {
  const upClass =
    direction === 'asc'
      ? 'text-blue-600 dark:text-blue-400'
      : 'text-gray-400 dark:text-gray-500';
  const downClass =
    direction === 'desc'
      ? 'text-blue-600 dark:text-blue-400'
      : 'text-gray-400 dark:text-gray-500';

  return (
    <span className="inline-flex flex-col leading-none">
      <svg className={`h-2.5 w-2.5 ${upClass}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 5l-5 5m5-5l5 5m-5-5v14" />
      </svg>
      <svg className={`-mt-0.5 h-2.5 w-2.5 ${downClass}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 19l5-5m-5 5l-5-5m5 5V5" />
      </svg>
    </span>
  );
}

function SortableHeader({
  column,
  label,
}: {
  column: Column<RoundSummary, unknown>;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={column.getToggleSortingHandler()}
      className="flex items-center gap-2 text-left hover:text-gray-700 dark:hover:text-gray-100"
    >
      <span>{label}</span>
      <SortIndicator direction={column.getIsSorted()} />
    </button>
  );
}

// Expandable row content that fetches round details
function ExpandedRoundDetails({ roundId }: { roundId: string }) {
  const { data: round, isLoading, isError } = useQuery({
    queryKey: ['round', roundId],
    queryFn: () => getRoundById(roundId),
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-4">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (isError || !round) {
    return <div className="text-red-600 dark:text-red-400 py-4">Failed to load round details</div>;
  }

  if (!round.holeScores || round.holeScores.length === 0) {
    return <div className="text-gray-500 dark:text-gray-400 py-4">No hole scores available</div>;
  }

  return (
    <div className="flex flex-col lg:flex-row gap-8">
      {/* Golfer's scorecard */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
            {round.golferFirstName || ''} {round.golferLastName || 'Golfer'}
          </h4>
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200">
            App: {round.sogoAppVersion || 'Unknown'}
          </span>
        </div>
        <ScorecardTable holeScores={round.holeScores} />
      </div>

      {/* Playing partner's scorecard */}
      {round.playingPartnerRound?.holeScores && round.playingPartnerRound.holeScores.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
            {round.playingPartnerRound.golferFirstName || ''} {round.playingPartnerRound.golferLastName || 'Playing Partner'}
          </h4>
          <ScorecardTable holeScores={round.playingPartnerRound.holeScores} />
        </div>
      )}
    </div>
  );
}

// Mobile card component for round display
function RoundCard({
  round,
  isExpanded,
  onToggle
}: {
  round: RoundSummary;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const name = `${round.golferFirstName || ''} ${round.golferLastName || ''}`.trim() || '-';
  const inProgress = isToday(round.roundDate) && !round.isSubmitted;
  const percentComplete = round.holeCount > 0 ? Math.round((round.completedHoleCount / round.holeCount) * 100) : 0;

  const formatDate = (dateString?: string | null) => {
    if (!dateString) return '-';
    try {
      return new Date(dateString).toLocaleDateString();
    } catch {
      return '-';
    }
  };

  const formatTime = (timeString?: string | null) => {
    if (!timeString) return '';
    try {
      return new Date(timeString).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
    } catch {
      return '';
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 space-y-2">
      {/* Header row with name and status */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          {round.golflinkNo ? (
            <Link
              to={`/golfers/${round.golflinkNo}`}
              className="text-blue-600 hover:text-blue-800 dark:text-cyan-400 dark:hover:text-cyan-300 hover:underline font-medium"
            >
              {name}
            </Link>
          ) : (
            <span className="font-medium text-gray-900 dark:text-white">{name}</span>
          )}
          {isToday(round.roundDate) && round.isSubmitted && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-500 text-white">
              Submitted
            </span>
          )}
          {inProgress && (
            <span className="relative inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 overflow-hidden">
              <span
                className="absolute left-0 top-0 bottom-0 bg-green-400 opacity-50"
                style={{ width: `${percentComplete}%` }}
              />
              <span className="relative">In Progress</span>
            </span>
          )}
        </div>
        <button
          onClick={onToggle}
          className="text-blue-600 hover:text-blue-800 dark:text-cyan-400 dark:hover:text-cyan-300 text-sm font-medium"
        >
          {isExpanded ? 'Hide' : 'Details'}
        </button>
      </div>

      {/* Date and time */}
      <div className="text-sm text-gray-600 dark:text-gray-400">
        {formatDate(round.roundDate)}
        {round.startTime && ` • ${formatTime(round.startTime)}`}
      </div>

      {/* Details row */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
        <span className="text-gray-500 dark:text-gray-400">
          GA: <span className="font-mono text-gray-900 dark:text-gray-100">{round.golflinkNo || '-'}</span>
        </span>
        <span className="text-gray-500 dark:text-gray-400">
          Club: <span className="text-gray-900 dark:text-gray-100">{round.clubName || '-'}</span>
        </span>
        {round.clubState && (
          <span className="text-gray-500 dark:text-gray-400">
            State: <span className="text-gray-900 dark:text-gray-100">{round.clubState.toUpperCase()}</span>
          </span>
        )}
      </div>

      {/* Stats row */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
        {round.compType && (
          <span className="text-gray-500 dark:text-gray-400">
            Type: <span className="text-gray-900 dark:text-gray-100">{formatRoundValue(round.compType)}</span>
          </span>
        )}
        <span className="text-gray-500 dark:text-gray-400">
          HCP: <span className="text-gray-900 dark:text-gray-100">{round.dailyHandicap?.toFixed(1) ?? '-'}</span>
        </span>
        <span className="text-gray-500 dark:text-gray-400">
          Holes: <span className="text-gray-900 dark:text-gray-100">{round.holeCount || 0}</span>
        </span>
      </div>

      {/* Expanded details */}
      {isExpanded && (
        <div className="pt-3 border-t border-gray-200 dark:border-gray-700 mt-3">
          <ExpandedRoundDetails roundId={round.id} />
        </div>
      )}
    </div>
  );
}

export function Rounds() {
  const { adminUser } = useAuth();
  const queryClient = useQueryClient();
  const pageSize = 20;
  const [initialViewState] = useState(getInitialViewState);

  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<RoundsFilterState>(initialViewState.filters);
  const [sorting, setSorting] = useState<SortingState>(initialViewState.sorting);
  const [isAdvancedFiltersOpen, setIsAdvancedFiltersOpen] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [knownCounts, setKnownCounts] = useState<{ inProgress: number; submitted: number } | null>(null);
  const [newRoundsAvailable, setNewRoundsAvailable] = useState(false);

  const toggleRow = (id: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const debouncedFilters = useDebounce(filters, 500);
  const activeSort = sorting[0] ?? DEFAULT_SORTING[0];
  const todayDateValue = useMemo(() => getTodayDateValue(), []);
  const scoreTypeFallbacks = useMemo(() => ['stableford', 'stroke', 'par'], []);
  const { data: scoreTypes } = useQuery({
    queryKey: ['scoreTypes'],
    queryFn: getScoreTypes,
    staleTime: 1000 * 60 * 60,
  });
  const scoreTypeOptions = useMemo(() => {
    const values = (scoreTypes ?? [])
      .map((scoreType) => scoreType.name?.trim())
      .filter((value): value is string => Boolean(value));

    const uniqueValues = values.length > 0 ? values : scoreTypeFallbacks;
    return Array.from(new Set(uniqueValues)).sort((left, right) => left.localeCompare(right));
  }, [scoreTypeFallbacks, scoreTypes]);

  const holeBounds = useMemo(() => getHoleRangeBounds(debouncedFilters.holeRange), [debouncedFilters.holeRange]);

  // Get clubIds from admin user for multi-tenant filtering
  const clubIds = adminUser?.clubIds;

  const { data, isLoading, isFetching, isError, error } = useQuery({
    queryKey: ['rounds', page, pageSize, debouncedFilters, activeSort, clubIds],
    queryFn: () => getAllRounds({
      page,
      pageSize,
      roundDateFrom: debouncedFilters.roundDateFrom || undefined,
      roundDateTo: debouncedFilters.roundDateTo || undefined,
      startTimeFrom: debouncedFilters.startTimeFrom || undefined,
      startTimeTo: debouncedFilters.startTimeTo || undefined,
      golferName: debouncedFilters.golferName || undefined,
      golflinkNo: debouncedFilters.golflinkNo || undefined,
      clubName: debouncedFilters.clubName || undefined,
      state: debouncedFilters.state || undefined,
      compType: debouncedFilters.compType || undefined,
      handicapMin: parseOptionalNumber(debouncedFilters.handicapMin),
      handicapMax: parseOptionalNumber(debouncedFilters.handicapMax),
      holeCountMin: holeBounds.min,
      holeCountMax: holeBounds.max,
      isSubmitted:
        debouncedFilters.isSubmitted === 'true'
          ? true
          : debouncedFilters.isSubmitted === 'false'
            ? false
            : undefined,
      sortBy: activeSort?.id,
      sortDirection: activeSort?.desc ? 'desc' : 'asc',
      clubIds,
    }),
    placeholderData: keepPreviousData,
  });

  // Poll for counts every 30 seconds to detect new rounds
  // Only start polling after initial data has loaded
  const { data: polledCounts } = useQuery({
    queryKey: ['roundsCounts', clubIds],
    queryFn: () => getRoundsCounts(clubIds),
    refetchInterval: 30000, // Poll every 30 seconds
    refetchIntervalInBackground: false, // Don't poll when tab is hidden
    enabled: !!knownCounts, // Only poll after we have baseline counts
    staleTime: 0, // Always consider stale - we want fresh counts
    gcTime: 0, // Don't cache polling results
  });

  // Update known counts when main data loads (only once on initial load)
  useEffect(() => {
    if (data && !knownCounts) {
      setKnownCounts({
        inProgress: data.todayInProgressCount,
        submitted: data.todaySubmittedCount,
      });
    }
  }, [data, knownCounts]);

  // Detect when polled counts differ from known counts
  useEffect(() => {
    if (polledCounts && knownCounts) {
      const hasNewRounds =
        polledCounts.todayInProgressCount !== knownCounts.inProgress ||
        polledCounts.todaySubmittedCount !== knownCounts.submitted;
      setNewRoundsAvailable(hasNewRounds);
    }
  }, [polledCounts, knownCounts]);

  // Refresh data and update known counts
  const handleRefreshRounds = useCallback(() => {
    setNewRoundsAvailable(false);
    if (polledCounts) {
      setKnownCounts({
        inProgress: polledCounts.todayInProgressCount,
        submitted: polledCounts.todaySubmittedCount,
      });
    }
    queryClient.invalidateQueries({ queryKey: ['rounds'] });
  }, [polledCounts, queryClient]);

  useEffect(() => {
    setPage(1);
  }, [debouncedFilters, sorting]);

  useEffect(() => {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ filters, sorting }));
  }, [filters, sorting]);

  const handleFilterChange = <K extends keyof RoundsFilterState>(key: K, value: RoundsFilterState[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const shiftRoundDateRange = (days: number) => {
    const fallbackDate = parseDateInputValue(todayDateValue) ?? new Date();
    const currentFrom = parseDateInputValue(filters.roundDateFrom);
    const currentTo = parseDateInputValue(filters.roundDateTo);

    let startDate = currentFrom ?? currentTo ?? fallbackDate;
    let endDate = currentTo ?? currentFrom ?? fallbackDate;

    if (startDate > endDate) {
      [startDate, endDate] = [endDate, startDate];
    }

    handleFilterChange('roundDateFrom', formatDateInputValue(addDays(startDate, days)));
    handleFilterChange('roundDateTo', formatDateInputValue(addDays(endDate, days)));
  };

  const clearAllFilters = () => {
    setFilters(DEFAULT_FILTERS);
    setIsAdvancedFiltersOpen(false);
    setPage(1);
  };

  const formatDate = (dateString?: string | null) => {
    if (!dateString) return '-';
    try {
      return new Date(dateString).toLocaleDateString();
    } catch {
      return '-';
    }
  };

  const formatHandicap = (handicap?: number | null) => {
    if (handicap === null || handicap === undefined) return '-';
    return handicap.toFixed(1);
  };

  const columns = useMemo(
    () => [
      columnHelper.display({
        id: 'actions',
        header: '',
        enableSorting: false,
        cell: (info) => (
          <button
            onClick={() => toggleRow(info.row.original.id)}
            className="text-blue-600 hover:text-blue-800 dark:text-cyan-400 dark:hover:text-cyan-300 hover:underline text-xs font-medium"
          >
            {expandedRows.has(info.row.original.id) ? 'Hide' : 'Details'}
          </button>
        ),
      }),
      columnHelper.accessor('roundDate', {
        header: 'Date',
        enableSorting: true,
        cell: (info) => formatDate(info.getValue()),
      }),
      columnHelper.accessor('startTime', {
        header: 'Start Time',
        enableSorting: true,
        cell: (info) => {
          const value = info.getValue();
          if (!value) return '-';
          try {
            return new Date(value).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
          } catch {
            return '-';
          }
        },
      }),
      columnHelper.accessor((row) => `${row.golferFirstName || ''} ${row.golferLastName || ''}`.trim(), {
        id: 'golferName',
        header: 'Golfer',
        enableSorting: true,
        cell: (info) => {
          const row = info.row.original;
          const name = info.getValue() || '-';
          const inProgress = isToday(row.roundDate) && !row.isSubmitted;
          const isSubmitted = row.isSubmitted;
          const percentComplete = row.holeCount > 0 ? Math.round((row.completedHoleCount / row.holeCount) * 100) : 0;
          return (
            <span className="flex items-center justify-between gap-2 min-w-[200px]">
              <span>
                {row.golflinkNo ? (
                  <Link
                    to={`/golfers/${row.golflinkNo}`}
                    className="text-blue-600 hover:text-blue-800 dark:text-cyan-400 dark:hover:text-cyan-300 hover:underline"
                  >
                    {name}
                  </Link>
                ) : (
                  name
                )}
              </span>
              {isToday(row.roundDate) && isSubmitted && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-500 text-white">
                  Submitted
                </span>
              )}
              {inProgress && (
                <span className="relative inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 overflow-hidden">
                  <span
                    className="absolute left-0 top-0 bottom-0 bg-green-400 opacity-50"
                    style={{ width: `${percentComplete}%` }}
                  />
                  <span className="relative">In Progress</span>
                </span>
              )}
            </span>
          );
        },
      }),
      columnHelper.accessor('golflinkNo', {
        header: 'GA Number',
        enableSorting: true,
        cell: (info) => (
          <span className="font-mono">{info.getValue() || '-'}</span>
        ),
      }),
      columnHelper.accessor('clubName', {
        header: 'Club',
        enableSorting: true,
        cell: (info) => info.getValue() || '-',
      }),
      columnHelper.accessor('clubState', {
        id: 'state',
        header: 'State',
        enableSorting: true,
        cell: (info) => info.getValue()?.toUpperCase() || '-',
      }),
      columnHelper.accessor('compType', {
        header: 'Type',
        enableSorting: true,
        cell: (info) => {
          const value = info.getValue();
          return formatRoundValue(value);
        },
      }),
      columnHelper.accessor('dailyHandicap', {
        header: 'HCP',
        enableSorting: true,
        cell: (info) => formatHandicap(info.getValue()),
      }),
      columnHelper.accessor('holeCount', {
        header: 'Holes',
        enableSorting: true,
        cell: (info) => info.getValue() || 0,
      }),
      columnHelper.accessor('isSubmitted', {
        header: 'Submitted',
        enableSorting: true,
        cell: (info) => {
          const submitted = info.getValue();
          return (
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                submitted ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
              }`}
            >
              {submitted ? 'Yes' : 'No'}
            </span>
          );
        },
      }),
    ],
    [expandedRows]
  );

  const table = useReactTable({
    data: data?.data ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    manualSorting: true,
    enableMultiSort: false,
    enableSortingRemoval: true,
    state: {
      sorting,
    },
    onSortingChange: setSorting,
  });

  const hasActiveFilters = Object.values(filters).some((value) => value !== '');
  const advancedFiltersActiveCount = ADVANCED_FILTER_KEYS.reduce(
    (count, key) => count + (filters[key] !== '' ? 1 : 0),
    0
  );
  const isTodayQuickFilterActive =
    filters.roundDateFrom === todayDateValue && filters.roundDateTo === todayDateValue;
  const hasRoundDateFilter = filters.roundDateFrom !== '' || filters.roundDateTo !== '';

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Rounds</h1>
          {data && (
            <div className="mt-1 text-sm text-gray-700 dark:text-gray-300">
              <div>In Progress for today: {data.todayInProgressCount}</div>
              <div>Submitted today: {data.todaySubmittedCount}</div>
            </div>
          )}
        </div>
      </div>

      {/* New rounds notification */}
      {newRoundsAvailable && (
        <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg p-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-blue-600 dark:text-blue-400 text-lg">●</span>
            <span className="text-blue-800 dark:text-blue-200 font-medium">Round updates available</span>
          </div>
          <button
            onClick={handleRefreshRounds}
            className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            Refresh
          </button>
        </div>
      )}

      {isLoading && !data && (
        <div className="fixed inset-0 flex flex-col justify-center items-center bg-gray-100/80 dark:bg-gray-900/80 z-50">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading rounds...</p>
        </div>
      )}

      {isError && !data && (
        <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-700 dark:text-red-400">
            Error loading rounds: {error instanceof Error ? error.message : 'Unknown error'}
          </p>
        </div>
      )}

      <div className="rounded-lg bg-white p-4 shadow dark:bg-gray-800">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Filters</h2>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          <div>
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <span className={FILTER_LABEL_CLASSES}>Round Date</span>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => shiftRoundDateRange(-1)}
                  className="rounded-full bg-gray-200 px-3 py-0.5 text-xs font-semibold text-gray-700 transition-colors hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
                >
                  -1 day
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleFilterChange('roundDateFrom', todayDateValue);
                    handleFilterChange('roundDateTo', todayDateValue);
                  }}
                  className={`rounded-full px-3 py-0.5 text-xs font-semibold transition-colors ${
                    isTodayQuickFilterActive
                      ? 'bg-blue-600 text-white'
                      : 'bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900/40 dark:text-blue-300 dark:hover:bg-blue-900/60'
                  }`}
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={() => shiftRoundDateRange(1)}
                  className="rounded-full bg-gray-200 px-3 py-0.5 text-xs font-semibold text-gray-700 transition-colors hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
                >
                  +1 day
                </button>
                {hasRoundDateFilter && (
                  <button
                    type="button"
                    onClick={() => {
                      handleFilterChange('roundDateFrom', '');
                      handleFilterChange('roundDateTo', '');
                    }}
                    className="rounded-full bg-gray-200 px-3 py-0.5 text-xs font-semibold text-gray-700 transition-colors hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="date"
                value={filters.roundDateFrom}
                onChange={(event) => handleFilterChange('roundDateFrom', event.target.value)}
                className={FILTER_INPUT_CLASSES}
              />
              <input
                type="date"
                value={filters.roundDateTo}
                onChange={(event) => handleFilterChange('roundDateTo', event.target.value)}
                className={FILTER_INPUT_CLASSES}
              />
            </div>
          </div>

          <div>
            <FilterField label="Golfer Name">
              <input
                type="text"
                value={filters.golferName}
                onChange={(event) => handleFilterChange('golferName', event.target.value)}
                placeholder="Search golfer"
                className={FILTER_INPUT_CLASSES}
              />
            </FilterField>
          </div>

          <div>
            <FilterField label="GA Number">
              <input
                type="text"
                value={filters.golflinkNo}
                onChange={(event) => handleFilterChange('golflinkNo', event.target.value)}
                placeholder="Search GA number"
                className={FILTER_INPUT_CLASSES}
              />
            </FilterField>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-stretch">
          <button
            type="button"
            aria-expanded={isAdvancedFiltersOpen}
            aria-controls="rounds-advanced-filters"
            onClick={() => setIsAdvancedFiltersOpen((open) => !open)}
            className="flex w-full items-center justify-between rounded-lg border border-gray-300 bg-gray-50 px-4 py-3 text-left transition-colors hover:bg-gray-100 dark:border-gray-600 dark:bg-gray-700/60 dark:hover:bg-gray-700"
          >
            <div>
              <div className="text-sm font-semibold text-gray-900 dark:text-white">
                {isAdvancedFiltersOpen ? 'Hide More Filters' : 'Show More Filters'}
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400">
                Start time, club, state, type, handicap, holes and submitted status
              </div>
            </div>

            <div className="ml-4 flex items-center gap-3">
              {advancedFiltersActiveCount > 0 && (
                <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                  {advancedFiltersActiveCount} active
                </span>
              )}
              <svg
                className={`h-5 w-5 text-gray-500 transition-transform duration-300 dark:text-gray-300 ${
                  isAdvancedFiltersOpen ? 'rotate-180' : ''
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </button>

          {hasActiveFilters && (
            <button
              onClick={clearAllFilters}
              className="inline-flex items-center justify-center rounded-md bg-gray-200 px-4 py-3 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
            >
              Clear Filters
            </button>
          )}
        </div>

        <div
          id="rounds-advanced-filters"
          className={`grid transition-all duration-300 ease-in-out ${
            isAdvancedFiltersOpen ? 'mt-4 grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
          }`}
        >
          <div className="overflow-hidden">
            <div className="grid grid-cols-1 gap-4 pt-1 md:grid-cols-2 xl:grid-cols-4">
              <FilterField label="Start Time">
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="time"
                    value={filters.startTimeFrom}
                    onChange={(event) => handleFilterChange('startTimeFrom', event.target.value)}
                    className={FILTER_INPUT_CLASSES}
                  />
                  <input
                    type="time"
                    value={filters.startTimeTo}
                    onChange={(event) => handleFilterChange('startTimeTo', event.target.value)}
                    className={FILTER_INPUT_CLASSES}
                  />
                </div>
              </FilterField>

              <FilterField label="Club Name">
                <input
                  type="text"
                  value={filters.clubName}
                  onChange={(event) => handleFilterChange('clubName', event.target.value)}
                  placeholder="Search club"
                  className={FILTER_INPUT_CLASSES}
                />
              </FilterField>

              <FilterField label="State">
                <select
                  value={filters.state}
                  onChange={(event) => handleFilterChange('state', event.target.value)}
                  className={FILTER_INPUT_CLASSES}
                >
                  <option value="">All states</option>
                  {stateOptions.map((state) => (
                    <option key={state} value={state}>
                      {state}
                    </option>
                  ))}
                </select>
              </FilterField>

              <FilterField label="Type">
                <select
                  value={filters.compType}
                  onChange={(event) => handleFilterChange('compType', event.target.value)}
                  className={FILTER_INPUT_CLASSES}
                >
                  <option value="">All types</option>
                  {scoreTypeOptions.map((type) => (
                    <option key={type} value={type}>
                      {formatRoundValue(type)}
                    </option>
                  ))}
                </select>
              </FilterField>

              <FilterField label="Handicap">
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.1"
                    value={filters.handicapMin}
                    onChange={(event) => handleFilterChange('handicapMin', event.target.value)}
                    placeholder="Min"
                    className={FILTER_INPUT_CLASSES}
                  />
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.1"
                    value={filters.handicapMax}
                    onChange={(event) => handleFilterChange('handicapMax', event.target.value)}
                    placeholder="Max"
                    className={FILTER_INPUT_CLASSES}
                  />
                </div>
              </FilterField>

              <FilterField label="Holes">
                <select
                  value={filters.holeRange}
                  onChange={(event) => handleFilterChange('holeRange', event.target.value as HoleRangeValue)}
                  className={FILTER_INPUT_CLASSES}
                >
                  {holeRangeOptions.map((option) => (
                    <option key={option.value || 'all'} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </FilterField>

              <FilterField label="Submitted">
                <select
                  value={filters.isSubmitted}
                  onChange={(event) => handleFilterChange('isSubmitted', event.target.value)}
                  className={FILTER_INPUT_CLASSES}
                >
                  {submittedOptions.map((option) => (
                    <option key={option.value || 'all'} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </FilterField>
            </div>
          </div>
        </div>
      </div>

      {data && (
        <>
          <div className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-2">
            <span>
              Showing {data.data.length} of {data.totalCount.toLocaleString()} rounds
              {hasActiveFilters && <span className="ml-1 text-blue-600 dark:text-blue-400">(filtered)</span>}
              {isFetching && (
                <span className="ml-1 text-orange-500 inline-flex items-center gap-1">
                  (fetching latest...
                  <span className="animate-spin inline-block h-3 w-3 border-2 border-orange-500 border-t-transparent rounded-full"></span>
                  )
                </span>
              )}
            </span>
          </div>

          {/* Mobile card view */}
          <div className="lg:hidden space-y-3 relative">
            {isFetching && (
              <div className="absolute inset-0 bg-white/60 dark:bg-gray-800/60 flex items-center justify-center z-10 rounded-lg">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
              </div>
            )}
            {data.data.map((round) => (
              <RoundCard
                key={round.id}
                round={round}
                isExpanded={expandedRows.has(round.id)}
                onToggle={() => toggleRow(round.id)}
              />
            ))}
          </div>

          {/* Desktop table view */}
          <div className="hidden lg:block bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden relative">
            {isFetching && (
              <div className="absolute inset-0 bg-white/60 dark:bg-gray-800/60 flex items-center justify-center z-10">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
              </div>
            )}
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  {table.getHeaderGroups().map((headerGroup) => (
                    <tr key={headerGroup.id}>
                      {headerGroup.headers.map((header) => (
                        <th
                          key={header.id}
                          className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
                        >
                          {header.isPlaceholder ? null : header.column.getCanSort() ? (
                            <SortableHeader
                              column={header.column}
                              label={String(flexRender(header.column.columnDef.header, header.getContext()))}
                            />
                          ) : (
                            flexRender(header.column.columnDef.header, header.getContext())
                          )}
                        </th>
                      ))}
                    </tr>
                  ))}
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {table.getRowModel().rows.map((row) => (
                    <React.Fragment key={row.id}>
                      <tr className="hover:bg-gray-50 dark:hover:bg-gray-700">
                        {row.getVisibleCells().map((cell) => (
                          <td key={cell.id} className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </td>
                        ))}
                      </tr>
                      {expandedRows.has(row.original.id) && (
                        <tr className="bg-gray-50 dark:bg-gray-700">
                          <td colSpan={columns.length} className="px-4 py-4">
                            <ExpandedRoundDetails roundId={row.original.id} />
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Page {data.page} of {data.totalPages}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(1)}
                disabled={page === 1}
                className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800"
              >
                First
              </button>
              <button
                onClick={() => setPage((p: number) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800"
              >
                Previous
              </button>
              <button
                onClick={() => setPage((p: number) => Math.min(data.totalPages, p + 1))}
                disabled={page >= data.totalPages}
                className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800"
              >
                Next
              </button>
              <button
                onClick={() => setPage(data.totalPages)}
                disabled={page >= data.totalPages}
                className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800"
              >
                Last
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
