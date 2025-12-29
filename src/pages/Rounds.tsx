import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  createColumnHelper,
} from '@tanstack/react-table';
import { getAllRounds, getRoundById } from '../api/mongodb';
import type { RoundSummary, HoleScore } from '../types';

type ColumnFilter = { id: string; value: unknown };
type ColumnFiltersState = ColumnFilter[];

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

function ColumnFilter({
  columnId,
  value,
  onChange,
  placeholder,
  type = 'text',
  options,
  inputRef,
}: {
  columnId: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  type?: 'text' | 'select';
  options?: { value: string; label: string }[] | string[];
  inputRef?: React.RefObject<HTMLInputElement | null>;
}) {
  if (type === 'select' && options) {
    const normalizedOptions = options.map((opt) =>
      typeof opt === 'string' ? { value: opt, label: opt } : opt
    );
    return (
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
      >
        {normalizedOptions[0]?.value !== '' && <option value="">All</option>}
        {normalizedOptions.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    );
  }

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        data-filter-id={columnId}
        className="w-full px-2 py-1 pr-6 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          className="absolute right-1 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
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
    <tr className="bg-gray-200 font-semibold">
      <td className="px-2 py-1 text-xs">{label}</td>
      <td className="px-2 py-1 text-xs text-right">{sumField(holes, 'par')}</td>
      <td className="px-2 py-1 text-xs text-right">{sumField(holes, 'meters')}</td>
      <td className="px-2 py-1 text-xs text-right">-</td>
      <td className="px-2 py-1 text-xs text-right">-</td>
      <td className="px-2 py-1 text-xs text-right">-</td>
      <td className="px-2 py-1 text-xs text-right">{sumField(holes, 'strokes')}</td>
      <td className="px-2 py-1 text-xs text-right">{sumField(holes, 'score')}</td>
    </tr>
  );

  return (
    <table className="text-xs border border-gray-300">
      <thead className="bg-gray-100">
        <tr>
          <th className="px-2 py-1 text-left font-medium text-gray-600">Hole</th>
          <th className="px-2 py-1 text-right font-medium text-gray-600">Par</th>
          <th className="px-2 py-1 text-right font-medium text-gray-600">Meters</th>
          <th className="px-2 py-1 text-right font-medium text-gray-600">Idx 1</th>
          <th className="px-2 py-1 text-right font-medium text-gray-600">Idx 2</th>
          <th className="px-2 py-1 text-right font-medium text-gray-600">Idx 3</th>
          <th className="px-2 py-1 text-right font-medium text-gray-600">Strokes</th>
          <th className="px-2 py-1 text-right font-medium text-gray-600">Points</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-200">
        {is18Hole ? (
          <>
            {front9.map((hole) => (
              <tr key={hole.holeNumber} className="hover:bg-gray-50">
                <td className="px-2 py-1">{hole.holeNumber}</td>
                <td className="px-2 py-1 text-right">{hole.par ?? '-'}</td>
                <td className="px-2 py-1 text-right">{hole.meters ?? '-'}</td>
                <td className="px-2 py-1 text-right">{hole.index1 ?? '-'}</td>
                <td className="px-2 py-1 text-right">{hole.index2 ?? '-'}</td>
                <td className="px-2 py-1 text-right">{hole.index3 ?? '-'}</td>
                <td className="px-2 py-1 text-right">{hole.strokes ?? '-'}</td>
                <td className="px-2 py-1 text-right">{hole.score ?? '-'}</td>
              </tr>
            ))}
            <SubtotalRow label="Front 9" holes={front9} />
            {back9.map((hole) => (
              <tr key={hole.holeNumber} className="hover:bg-gray-50">
                <td className="px-2 py-1">{hole.holeNumber}</td>
                <td className="px-2 py-1 text-right">{hole.par ?? '-'}</td>
                <td className="px-2 py-1 text-right">{hole.meters ?? '-'}</td>
                <td className="px-2 py-1 text-right">{hole.index1 ?? '-'}</td>
                <td className="px-2 py-1 text-right">{hole.index2 ?? '-'}</td>
                <td className="px-2 py-1 text-right">{hole.index3 ?? '-'}</td>
                <td className="px-2 py-1 text-right">{hole.strokes ?? '-'}</td>
                <td className="px-2 py-1 text-right">{hole.score ?? '-'}</td>
              </tr>
            ))}
            <SubtotalRow label="Back 9" holes={back9} />
            <SubtotalRow label="Total" holes={sortedHoles} />
          </>
        ) : (
          <>
            {sortedHoles.map((hole) => (
              <tr key={hole.holeNumber} className="hover:bg-gray-50">
                <td className="px-2 py-1">{hole.holeNumber}</td>
                <td className="px-2 py-1 text-right">{hole.par ?? '-'}</td>
                <td className="px-2 py-1 text-right">{hole.meters ?? '-'}</td>
                <td className="px-2 py-1 text-right">{hole.index1 ?? '-'}</td>
                <td className="px-2 py-1 text-right">{hole.index2 ?? '-'}</td>
                <td className="px-2 py-1 text-right">{hole.index3 ?? '-'}</td>
                <td className="px-2 py-1 text-right">{hole.strokes ?? '-'}</td>
                <td className="px-2 py-1 text-right">{hole.score ?? '-'}</td>
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
function isToday(dateString?: string): boolean {
  if (!dateString) return false;
  const roundDate = new Date(dateString);
  const today = new Date();
  return (
    roundDate.getFullYear() === today.getFullYear() &&
    roundDate.getMonth() === today.getMonth() &&
    roundDate.getDate() === today.getDate()
  );
}

// Check if hole scores are incomplete (any hole missing strokes)
function isIncomplete(holeScores?: HoleScore[]): boolean {
  if (!holeScores || holeScores.length === 0) return true;
  return holeScores.some(hole => hole.strokes === null || hole.strokes === undefined || hole.strokes === 0);
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
    return <div className="text-red-600 py-4">Failed to load round details</div>;
  }

  if (!round.holeScores || round.holeScores.length === 0) {
    return <div className="text-gray-500 py-4">No hole scores available</div>;
  }

  const golferInProgress = isToday(round.roundDate) && isIncomplete(round.holeScores);
  const partnerInProgress = isToday(round.roundDate) && isIncomplete(round.playingPartnerRound?.holeScores);

  return (
    <div className="flex flex-col lg:flex-row gap-8">
      {/* Golfer's scorecard */}
      <div>
        <h4 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
          <span>{round.golferFirstName || ''} {round.golferLastName || 'Golfer'}</span>
          {golferInProgress && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
              In Progress
            </span>
          )}
        </h4>
        <ScorecardTable holeScores={round.holeScores} />
      </div>

      {/* Playing partner's scorecard */}
      {round.playingPartnerRound?.holeScores && round.playingPartnerRound.holeScores.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
            <span>{round.playingPartnerRound.golferFirstName || ''} {round.playingPartnerRound.golferLastName || 'Playing Partner'}</span>
            {partnerInProgress && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                In Progress
              </span>
            )}
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
    <div className="bg-white rounded-lg shadow p-4 space-y-2">
      {/* Header row with name and status */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          {round.golflinkNo ? (
            <Link
              to={`/golfers/${round.golflinkNo}`}
              className="text-blue-600 hover:text-blue-800 hover:underline font-medium"
            >
              {name}
            </Link>
          ) : (
            <span className="font-medium">{name}</span>
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
          className="text-blue-600 hover:text-blue-800 text-sm font-medium"
        >
          {isExpanded ? 'Hide' : 'Details'}
        </button>
      </div>

      {/* Date and time */}
      <div className="text-sm text-gray-600">
        {formatDate(round.roundDate)}
        {round.startTime && ` • ${formatTime(round.startTime)}`}
      </div>

      {/* Details row */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
        <span className="text-gray-500">
          GA: <span className="font-mono text-gray-900">{round.golflinkNo || '-'}</span>
        </span>
        <span className="text-gray-500">
          Club: <span className="text-gray-900">{round.clubName || '-'}</span>
        </span>
        {round.clubState && (
          <span className="text-gray-500">
            State: <span className="text-gray-900">{round.clubState.toUpperCase()}</span>
          </span>
        )}
      </div>

      {/* Stats row */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
        {round.roundType && (
          <span className="text-gray-500">
            Type: <span className="text-gray-900">{round.roundType}</span>
          </span>
        )}
        {round.compType && (
          <span className="text-gray-500">
            Comp: <span className="text-gray-900">{round.compType}</span>
          </span>
        )}
        <span className="text-gray-500">
          HCP: <span className="text-gray-900">{round.dailyHandicap?.toFixed(1) ?? '-'}</span>
        </span>
        <span className="text-gray-500">
          Score: <span className="text-gray-900">{round.compScoreTotal ?? '-'}</span>
        </span>
        <span className="text-gray-500">
          Holes: <span className="text-gray-900">{round.holeCount || 0}</span>
        </span>
      </div>

      {/* Expanded details */}
      {isExpanded && (
        <div className="pt-3 border-t border-gray-200 mt-3">
          <ExpandedRoundDetails roundId={round.id} />
        </div>
      )}
    </div>
  );
}

const STORAGE_KEY = 'rounds-filters';

function getInitialFilters(): ColumnFiltersState {
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return parsed.filters || [];
    }
  } catch {
    // Ignore parse errors
  }
  return [];
}

export function Rounds() {
  const pageSize = 20;

  const [page, setPage] = useState(1);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>(getInitialFilters);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

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

  const focusedFilterRef = useRef<string | null>(null);
  const filterRefs = {
    golferName: useRef<HTMLInputElement>(null),
    golflinkNo: useRef<HTMLInputElement>(null),
    clubName: useRef<HTMLInputElement>(null),
    roundType: useRef<HTMLInputElement>(null),
    compType: useRef<HTMLInputElement>(null),
  };

  const debouncedFilters = useDebounce(columnFilters, 700);

  const filterParams = useMemo(() => {
    const params: Record<string, string> = {};
    debouncedFilters.forEach((filter) => {
      if (filter.value) {
        params[filter.id] = filter.value as string;
      }
    });
    return params;
  }, [debouncedFilters]);

  const { data, isLoading, isFetching, isError, error } = useQuery({
    queryKey: ['rounds', page, pageSize, filterParams],
    queryFn: () => getAllRounds({
      page,
      pageSize,
      golferName: filterParams.golferName,
      golflinkNo: filterParams.golflinkNo,
      clubName: filterParams.clubName,
      state: filterParams.state,
      compType: filterParams.compType,
      roundType: filterParams.roundType,
      isSubmitted: filterParams.isSubmitted === 'true' ? true : filterParams.isSubmitted === 'false' ? false : undefined,
      roundDate: filterParams.roundDate,
    }),
    placeholderData: keepPreviousData,
  });

  useEffect(() => {
    setPage(1);
  }, [debouncedFilters]);

  useEffect(() => {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ filters: columnFilters }));
  }, [columnFilters]);

  useEffect(() => {
    if (focusedFilterRef.current && filterRefs[focusedFilterRef.current as keyof typeof filterRefs]) {
      const input = filterRefs[focusedFilterRef.current as keyof typeof filterRefs].current;
      if (input) {
        input.focus();
        const len = input.value.length;
        input.setSelectionRange(len, len);
      }
    }
  }, [data]);

  const handleFilterChange = (columnId: string, value: string) => {
    focusedFilterRef.current = columnId;
    setColumnFilters((prev) => {
      const existing = prev.filter((f) => f.id !== columnId);
      if (value) {
        return [...existing, { id: columnId, value }];
      }
      return existing;
    });
  };

  const getFilterValue = (columnId: string): string => {
    const filter = columnFilters.find((f) => f.id === columnId);
    return (filter?.value as string) || '';
  };

  const clearAllFilters = () => {
    setColumnFilters([]);
    setPage(1);
    sessionStorage.removeItem(STORAGE_KEY);
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
        cell: (info) => (
          <button
            onClick={() => toggleRow(info.row.original.id)}
            className="text-blue-600 hover:text-blue-800 hover:underline text-xs font-medium"
          >
            {expandedRows.has(info.row.original.id) ? 'Hide' : 'Details'}
          </button>
        ),
      }),
      columnHelper.accessor('roundDate', {
        header: 'Date',
        cell: (info) => formatDate(info.getValue()),
      }),
      columnHelper.accessor('startTime', {
        header: 'Start Time',
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
                    className="text-blue-600 hover:text-blue-800 hover:underline"
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
        cell: (info) => (
          <span className="font-mono">{info.getValue() || '-'}</span>
        ),
      }),
      columnHelper.accessor('clubName', {
        header: 'Club',
        cell: (info) => info.getValue() || '-',
      }),
      columnHelper.accessor('clubState', {
        id: 'state',
        header: 'State',
        cell: (info) => info.getValue()?.toUpperCase() || '-',
      }),
      columnHelper.accessor('roundType', {
        header: 'Type',
        cell: (info) => info.getValue() || '-',
      }),
      columnHelper.accessor('compType', {
        header: 'Comp',
        cell: (info) => info.getValue() || '-',
      }),
      columnHelper.accessor('dailyHandicap', {
        header: 'HCP',
        cell: (info) => formatHandicap(info.getValue()),
      }),
      columnHelper.accessor('compScoreTotal', {
        header: 'Score',
        cell: (info) => {
          const score = info.getValue();
          return score !== null && score !== undefined ? score : '-';
        },
      }),
      columnHelper.accessor('holeCount', {
        header: 'Holes',
        cell: (info) => info.getValue() || 0,
      }),
      columnHelper.accessor('isSubmitted', {
        header: 'Submitted',
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
    manualFiltering: true,
    manualPagination: true,
    state: {
      columnFilters,
    },
    onColumnFiltersChange: setColumnFilters,
  });

  const hasActiveFilters = columnFilters.length > 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Rounds</h1>
          {data && (
            <div className="mt-1 text-sm text-gray-700">
              <div>In Progress for today: {data.todayInProgressCount}</div>
              <div>Submitted today: {data.todaySubmittedCount}</div>
            </div>
          )}
        </div>
        {hasActiveFilters && (
          <button
            onClick={clearAllFilters}
            className="px-3 py-1 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
          >
            Clear All Filters
          </button>
        )}
      </div>

      {isLoading && !data && (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      )}

      {isError && !data && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-700">
            Error loading rounds: {error instanceof Error ? error.message : 'Unknown error'}
          </p>
        </div>
      )}

      {data && (
        <>
          <div className="text-sm text-gray-600 flex items-center gap-2">
            <span>
              Showing {data.data.length} of {data.totalCount.toLocaleString()} rounds
              {hasActiveFilters && <span className="ml-1 text-blue-600">(filtered)</span>}
            </span>
            {isFetching && (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
            )}
          </div>

          {/* Mobile filters */}
          <div className="lg:hidden bg-white rounded-lg shadow p-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Date</label>
                <input
                  type="date"
                  value={getFilterValue('roundDate')}
                  onChange={(e) => handleFilterChange('roundDate', e.target.value)}
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">State</label>
                <select
                  value={getFilterValue('state')}
                  onChange={(e) => handleFilterChange('state', e.target.value)}
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">All</option>
                  {stateOptions.map((state) => (
                    <option key={state} value={state}>{state}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Golfer Name</label>
                <input
                  type="text"
                  value={getFilterValue('golferName')}
                  onChange={(e) => handleFilterChange('golferName', e.target.value)}
                  placeholder="Search..."
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">GA Number</label>
                <input
                  type="text"
                  value={getFilterValue('golflinkNo')}
                  onChange={(e) => handleFilterChange('golflinkNo', e.target.value)}
                  placeholder="Search..."
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Submitted</label>
                <select
                  value={getFilterValue('isSubmitted')}
                  onChange={(e) => handleFilterChange('isSubmitted', e.target.value)}
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  {submittedOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Club</label>
                <input
                  type="text"
                  value={getFilterValue('clubName')}
                  onChange={(e) => handleFilterChange('clubName', e.target.value)}
                  placeholder="Search..."
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Mobile card view */}
          <div className="lg:hidden space-y-3 relative">
            {isFetching && (
              <div className="absolute inset-0 bg-white/60 flex items-center justify-center z-10 rounded-lg">
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
          <div className="hidden lg:block bg-white rounded-lg shadow overflow-hidden relative">
            {isFetching && (
              <div className="absolute inset-0 bg-white/60 flex items-center justify-center z-10">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
              </div>
            )}
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  {table.getHeaderGroups().map((headerGroup) => (
                    <tr key={headerGroup.id}>
                      {headerGroup.headers.map((header) => (
                        <th
                          key={header.id}
                          className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                        >
                          {header.isPlaceholder
                            ? null
                            : flexRender(header.column.columnDef.header, header.getContext())}
                        </th>
                      ))}
                    </tr>
                  ))}
                  {/* Filter row */}
                  <tr className="bg-gray-100">
                    <th className="px-4 py-2">
                      {/* No filter for actions */}
                    </th>
                    <th className="px-4 py-2">
                      <input
                        type="date"
                        value={getFilterValue('roundDate')}
                        onChange={(e) => handleFilterChange('roundDate', e.target.value)}
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </th>
                    <th className="px-4 py-2">
                      {/* No filter for start time */}
                    </th>
                    <th className="px-4 py-2">
                      <ColumnFilter
                        columnId="golferName"
                        value={getFilterValue('golferName')}
                        onChange={(v) => handleFilterChange('golferName', v)}
                        placeholder="Filter..."
                        inputRef={filterRefs.golferName}
                      />
                    </th>
                    <th className="px-4 py-2">
                      <ColumnFilter
                        columnId="golflinkNo"
                        value={getFilterValue('golflinkNo')}
                        onChange={(v) => handleFilterChange('golflinkNo', v)}
                        placeholder="Filter..."
                        inputRef={filterRefs.golflinkNo}
                      />
                    </th>
                    <th className="px-4 py-2">
                      <ColumnFilter
                        columnId="clubName"
                        value={getFilterValue('clubName')}
                        onChange={(v) => handleFilterChange('clubName', v)}
                        placeholder="Filter..."
                        inputRef={filterRefs.clubName}
                      />
                    </th>
                    <th className="px-4 py-2">
                      <ColumnFilter
                        columnId="state"
                        value={getFilterValue('state')}
                        onChange={(v) => handleFilterChange('state', v)}
                        placeholder="Filter..."
                        type="select"
                        options={stateOptions}
                      />
                    </th>
                    <th className="px-4 py-2">
                      <ColumnFilter
                        columnId="roundType"
                        value={getFilterValue('roundType')}
                        onChange={(v) => handleFilterChange('roundType', v)}
                        placeholder="Filter..."
                        inputRef={filterRefs.roundType}
                      />
                    </th>
                    <th className="px-4 py-2">
                      <ColumnFilter
                        columnId="compType"
                        value={getFilterValue('compType')}
                        onChange={(v) => handleFilterChange('compType', v)}
                        placeholder="Filter..."
                        inputRef={filterRefs.compType}
                      />
                    </th>
                    <th className="px-4 py-2">
                      {/* No filter for HCP */}
                    </th>
                    <th className="px-4 py-2">
                      {/* No filter for score */}
                    </th>
                    <th className="px-4 py-2">
                      {/* No filter for holes */}
                    </th>
                    <th className="px-4 py-2">
                      <ColumnFilter
                        columnId="isSubmitted"
                        value={getFilterValue('isSubmitted')}
                        onChange={(v) => handleFilterChange('isSubmitted', v)}
                        placeholder="Filter..."
                        type="select"
                        options={submittedOptions}
                      />
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {table.getRowModel().rows.map((row) => (
                    <React.Fragment key={row.id}>
                      <tr className="hover:bg-gray-50">
                        {row.getVisibleCells().map((cell) => (
                          <td key={cell.id} className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </td>
                        ))}
                      </tr>
                      {expandedRows.has(row.original.id) && (
                        <tr className="bg-gray-50">
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
            <div className="text-sm text-gray-600">
              Page {data.page} of {data.totalPages}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(1)}
                disabled={page === 1}
                className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                First
              </button>
              <button
                onClick={() => setPage((p: number) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <button
                onClick={() => setPage((p: number) => Math.min(data.totalPages, p + 1))}
                disabled={page >= data.totalPages}
                className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
              <button
                onClick={() => setPage(data.totalPages)}
                disabled={page >= data.totalPages}
                className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
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
