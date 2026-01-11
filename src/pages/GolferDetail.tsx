import React, { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { getClubs } from '../api/mongodb';
const API_BASE = import.meta.env.VITE_MONGODB_API_URL || 'https://mongo-api-613362712202.australia-southeast1.run.app';

// Actual transaction structure from MongoDB API
interface ApiTransaction {
  id: string;
  transactionDate: string;
  amount: number;
  transactionType: string;
  debitCreditType: 'credit' | 'debit';
  comment?: string;
  summary?: string;
  status?: string;
}

// Round structure from MongoDB API
interface ApiRound {
  id: string;
  roundDate?: string;
  clubName?: string;
  clubState?: { shortName: string };
  compType?: string;
  teeColor?: string;
  golfLinkHandicap?: number;
  dailyHandicap?: number;
  scratchRating?: number;
  slopeRating?: number;
  holeScores?: { holeNumber: number; strokes: number; score: number; par: number; index1?: number; index2?: number; index3?: number; meters?: number }[];
  isSubmitted?: boolean;
  isClubComp?: boolean;
  playingPartnerRound?: {
    golferFirstName?: string;
    golferLastName?: string;
    holeScores?: { holeNumber: number; strokes: number; score: number; par: number; index1?: number; index2?: number; index3?: number; meters?: number }[];
  };
  golferFirstName?: string;
  golferLastName?: string;
  markerFirstName?: string;
  markerLastName?: string;
}

interface RoundsPaginatedResponse {
  data: ApiRound[];
  pagination: {
    page: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
  };
}

async function getTransactionsByEmail(email: string): Promise<ApiTransaction[]> {
  const response = await fetch(`${API_BASE}/transactions?email=${encodeURIComponent(email)}`);
  if (!response.ok) throw new Error('Failed to fetch transactions');
  return response.json();
}

async function getRoundsByGolflinkNo(golflinkNo: string, page: number, pageSize: number): Promise<RoundsPaginatedResponse> {
  const response = await fetch(`${API_BASE}/rounds/all?golflinkNo=${encodeURIComponent(golflinkNo)}&page=${page}&pageSize=${pageSize}`);
  if (!response.ok) throw new Error('Failed to fetch rounds');
  return response.json();
}

// Tabs for the golfer detail page
type TabId = 'profile' | 'rounds' | 'transactions';

const tabs: { id: TabId; label: string }[] = [
  { id: 'rounds', label: 'Rounds' },
  { id: 'transactions', label: 'Transactions' },
  { id: 'profile', label: 'Profile' },
];

// Transactions Tab Component with client-side pagination
function TransactionsTab({ email, tokenBalance }: { email: string; tokenBalance: number }) {
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const { data: allTransactions, isLoading, isFetching, isError, error } = useQuery({
    queryKey: ['transactions', email],
    queryFn: () => getTransactionsByEmail(email),
    enabled: !!email,
    placeholderData: keepPreviousData,
  });

  // Client-side pagination
  const paginatedData = useMemo(() => {
    if (!allTransactions) return { data: [], totalCount: 0, totalPages: 0 };
    const totalCount = allTransactions.length;
    const totalPages = Math.ceil(totalCount / pageSize);
    const start = (page - 1) * pageSize;
    const data = allTransactions.slice(start, start + pageSize);
    return { data, totalCount, totalPages };
  }, [allTransactions, page, pageSize]);

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    try {
      return new Date(dateString).toLocaleDateString();
    } catch {
      return '-';
    }
  };

  const formatCurrency = (value?: number) => {
    if (value === undefined || value === null) return '-';
    return value.toLocaleString();
  };

  if (isLoading && !allTransactions) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-4">
        <p className="text-red-700 dark:text-red-400">
          Error loading transactions: {error instanceof Error ? error.message : 'Unknown error'}
        </p>
      </div>
    );
  }

  if (!allTransactions || allTransactions.length === 0) {
    return (
      <div className="text-gray-500 dark:text-gray-400 text-center py-8">
        No transactions found for this golfer.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-600 dark:text-gray-400">Current Balance:</span>
        <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
          tokenBalance > 0 ? 'bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-300' : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300'
        }`}>
          {tokenBalance}
        </span>
      </div>
      <div className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-2">
        <span>
          Showing {paginatedData.data.length} of {paginatedData.totalCount} transactions
        </span>
        {isFetching && (
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
        )}
      </div>

      <div className={`overflow-x-auto transition-opacity ${isFetching ? 'opacity-70' : ''}`}>
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Date</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Type</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Comment</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Amount</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Status</th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {paginatedData.data.map((transaction) => (
              <tr key={transaction.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                  {formatDate(transaction.transactionDate)}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100 capitalize">
                  {transaction.transactionType?.replace(/_/g, ' ') || '-'}
                </td>
                <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 max-w-xs truncate">
                  {transaction.comment || '-'}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-right">
                  <span className={transaction.debitCreditType?.toLowerCase() === 'credit' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                    {transaction.debitCreditType?.toLowerCase() === 'credit' ? '+' : '-'}
                    {formatCurrency(transaction.amount)}
                  </span>
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 capitalize">
                  {transaction.status || '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {paginatedData.totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-sm text-gray-600 dark:text-gray-400">
            Page {page} of {paginatedData.totalPages}
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
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800"
            >
              Previous
            </button>
            <button
              onClick={() => setPage((p) => Math.min(paginatedData.totalPages, p + 1))}
              disabled={page >= paginatedData.totalPages}
              className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800"
            >
              Next
            </button>
            <button
              onClick={() => setPage(paginatedData.totalPages)}
              disabled={page >= paginatedData.totalPages}
              className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800"
            >
              Last
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Scorecard table component for displaying hole-by-hole scores
type HoleScore = { holeNumber: number; strokes: number; score: number; par: number; index1?: number; index2?: number; index3?: number; meters?: number };

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

// Mobile card component for round display in golfer detail
function RoundCardMobile({
  round,
  isExpanded,
  onToggle,
  calculateTotalStrokes,
  calculateTotalScore,
}: {
  round: ApiRound;
  isExpanded: boolean;
  onToggle: () => void;
  calculateTotalStrokes: (holeScores?: ApiRound['holeScores']) => string | number;
  calculateTotalScore: (holeScores?: ApiRound['holeScores']) => string | number;
}) {
  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    try {
      return new Date(dateString).toLocaleDateString();
    } catch {
      return '-';
    }
  };

  const markerName = (() => {
    const firstName = round.playingPartnerRound?.golferFirstName || round.markerFirstName;
    const lastName = round.playingPartnerRound?.golferLastName || round.markerLastName;
    return firstName || lastName ? `${firstName || ''} ${lastName || ''}`.trim() : null;
  })();

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 space-y-2">
      {/* Header row with date and status */}
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium text-gray-900 dark:text-white">{formatDate(round.roundDate)}</span>
        <div className="flex items-center gap-2">
          {round.isSubmitted ? (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-300">
              Submitted
            </span>
          ) : (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300">
              Not Submitted
            </span>
          )}
          <button
            onClick={onToggle}
            className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 text-sm font-medium"
          >
            {isExpanded ? 'Hide' : 'Details'}
          </button>
        </div>
      </div>

      {/* Club and type */}
      <div className="text-sm text-gray-600 dark:text-gray-400">
        {round.clubName || '-'}
        {round.compType && ` • ${round.compType}`}
        {round.teeColor && ` • ${round.teeColor} tee`}
      </div>

      {/* Stats row */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
        <span className="text-gray-500 dark:text-gray-400">
          HCP: <span className="text-gray-900 dark:text-gray-100">{round.dailyHandicap?.toFixed(1) ?? '-'}</span>
        </span>
        <span className="text-gray-500 dark:text-gray-400">
          Strokes: <span className="text-gray-900 dark:text-gray-100">{calculateTotalStrokes(round.holeScores)}</span>
        </span>
        <span className="text-gray-500 dark:text-gray-400">
          Score: <span className="text-green-600 dark:text-green-400 font-medium">{calculateTotalScore(round.holeScores)}</span>
        </span>
      </div>

      {/* Course rating row */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
        <span className="text-gray-500 dark:text-gray-400">
          Scratch: <span className="text-gray-900 dark:text-gray-100">{round.scratchRating?.toFixed(1) ?? '-'}</span>
        </span>
        <span className="text-gray-500 dark:text-gray-400">
          Slope: <span className="text-gray-900 dark:text-gray-100">{round.slopeRating?.toFixed(1) ?? '-'}</span>
        </span>
        {markerName && (
          <span className="text-gray-500 dark:text-gray-400">
            Marker: <span className="text-gray-900 dark:text-gray-100">{markerName}</span>
          </span>
        )}
      </div>

      {/* Expanded scorecard */}
      {isExpanded && round.holeScores && round.holeScores.length > 0 && (
        <div className="pt-3 border-t border-gray-200 dark:border-gray-700 mt-3">
          <div className="flex flex-col lg:flex-row gap-4 overflow-x-auto">
            {/* Golfer's scorecard */}
            <div>
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
                {round.golferFirstName || ''} {round.golferLastName || 'Golfer'}
              </h4>
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
        </div>
      )}
    </div>
  );
}

// Rounds Tab Component with server-side pagination
function RoundsTab({ golflinkNo }: { golflinkNo: string }) {
  const [page, setPage] = useState(1);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const pageSize = 10;

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

  const { data, isLoading, isFetching, isError, error } = useQuery({
    queryKey: ['rounds', golflinkNo, page, pageSize],
    queryFn: () => getRoundsByGolflinkNo(golflinkNo, page, pageSize),
    enabled: !!golflinkNo,
    placeholderData: keepPreviousData,
  });

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    try {
      return new Date(dateString).toLocaleDateString();
    } catch {
      return '-';
    }
  };

  const calculateTotalStrokes = (holeScores?: ApiRound['holeScores']) => {
    if (!holeScores || holeScores.length === 0) return '-';
    return holeScores.reduce((sum, hole) => sum + (hole.strokes || 0), 0);
  };

  const calculateTotalScore = (holeScores?: ApiRound['holeScores']) => {
    if (!holeScores || holeScores.length === 0) return '-';
    return holeScores.reduce((sum, hole) => sum + (hole.score || 0), 0);
  };

  if (isLoading && !data) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-4">
        <p className="text-red-700 dark:text-red-400">
          Error loading rounds: {error instanceof Error ? error.message : 'Unknown error'}
        </p>
      </div>
    );
  }

  if (!data || data.data.length === 0) {
    return (
      <div className="text-gray-500 dark:text-gray-400 text-center py-8">
        No rounds found for this golfer.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-2">
        <span>
          Showing {data.data.length} of {data.pagination.totalCount} rounds
        </span>
        {isFetching && (
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
        )}
      </div>

      {/* Mobile card view */}
      <div className="lg:hidden space-y-3 relative">
        {isFetching && (
          <div className="absolute inset-0 bg-white/60 dark:bg-gray-800/60 flex items-center justify-center z-10 rounded-lg">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
          </div>
        )}
        {data.data.map((round) => (
          <RoundCardMobile
            key={round.id}
            round={round}
            isExpanded={expandedRows.has(round.id)}
            onToggle={() => toggleRow(round.id)}
            calculateTotalStrokes={calculateTotalStrokes}
            calculateTotalScore={calculateTotalScore}
          />
        ))}
      </div>

      {/* Desktop table view */}
      <div className={`hidden lg:block overflow-x-auto transition-opacity ${isFetching ? 'opacity-70' : ''}`}>
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th className="px-2 py-3 w-8"></th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Date</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Club</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Type</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Tee</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">HCP</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Scratch</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Slope</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Strokes</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Score</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Marker</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Status</th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {data.data.map((round) => (
              <React.Fragment key={round.id}>
              <tr className="hover:bg-gray-50 dark:hover:bg-gray-700">
                <td className="px-2 py-3 whitespace-nowrap">
                  <button
                    onClick={() => toggleRow(round.id)}
                    className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 hover:underline text-xs font-medium"
                  >
                    {expandedRows.has(round.id) ? 'Hide' : 'Details'}
                  </button>
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                  {formatDate(round.roundDate)}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                  {round.clubName || '-'}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100 capitalize">
                  {round.compType || '-'}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100 capitalize">
                  {round.teeColor || '-'}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-900 dark:text-gray-100">
                  {round.dailyHandicap?.toFixed(1) ?? '-'}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-900 dark:text-gray-100">
                  {round.scratchRating?.toFixed(1) ?? '-'}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-900 dark:text-gray-100">
                  {round.slopeRating?.toFixed(1) ?? '-'}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-900 dark:text-gray-100">
                  {calculateTotalStrokes(round.holeScores)}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-right font-medium">
                  <span className={typeof calculateTotalScore(round.holeScores) === 'number' ? 'text-green-600 dark:text-green-400' : 'text-gray-900 dark:text-gray-100'}>
                    {calculateTotalScore(round.holeScores)}
                  </span>
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                  {(() => {
                    const firstName = round.playingPartnerRound?.golferFirstName || round.markerFirstName;
                    const lastName = round.playingPartnerRound?.golferLastName || round.markerLastName;
                    return firstName || lastName ? `${firstName || ''} ${lastName || ''}`.trim() : '-';
                  })()}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm">
                  {round.isSubmitted ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-300">
                      Submitted
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300">
                      Not Submitted
                    </span>
                  )}
                </td>
              </tr>
              {/* Expandable hole scores row */}
              {expandedRows.has(round.id) && round.holeScores && round.holeScores.length > 0 && (
                <tr className="bg-gray-50 dark:bg-gray-700">
                  <td colSpan={12} className="px-4 py-4">
                    <div className="flex flex-col xl:flex-row gap-8">
                      {/* Golfer's scorecard */}
                      <div>
                        <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
                          {round.golferFirstName || ''} {round.golferLastName || 'Golfer'}
                        </h4>
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
                  </td>
                </tr>
              )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {data.pagination.totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-sm text-gray-600 dark:text-gray-400">
            Page {data.pagination.page} of {data.pagination.totalPages}
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
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800"
            >
              Previous
            </button>
            <button
              onClick={() => setPage((p) => Math.min(data.pagination.totalPages, p + 1))}
              disabled={page >= data.pagination.totalPages}
              className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800"
            >
              Next
            </button>
            <button
              onClick={() => setPage(data.pagination.totalPages)}
              disabled={page >= data.pagination.totalPages}
              className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800"
            >
              Last
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function GolferDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabId>('rounds');

  // Fetch golfer by ID from MongoDB API
  const { data: golfer, isLoading, isError, error } = useQuery({
    queryKey: ['golfer', id],
    queryFn: async () => {
      const response = await fetch(
        `${import.meta.env.VITE_MONGODB_API_URL || 'https://mongo-api-613362712202.australia-southeast1.run.app'}/golfers?golflinkNo=${id}`
      );
      if (!response.ok) throw new Error('Failed to fetch golfer');
      const data = await response.json();
      return data;
    },
    enabled: !!id,
  });

  // Fetch clubs for lookup
  const { data: clubs } = useQuery({
    queryKey: ['clubs'],
    queryFn: getClubs,
    staleTime: 1000 * 60 * 60,
  });

  // Get club name from golflinkNo
  const getClubName = (golflinkNo?: string): string => {
    if (!golflinkNo || golflinkNo.length < 5 || !clubs) return '-';
    const glClubId = parseInt(golflinkNo.substring(0, 5), 10);
    const club = clubs.find((c) => c.glClubId === glClubId);
    return club?.name || '-';
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    try {
      return new Date(dateString).toLocaleDateString();
    } catch {
      return '-';
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="space-y-4">
        <button onClick={() => navigate(-1)} className="text-blue-600 dark:text-blue-400 hover:underline">&larr; Back</button>
        <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-700 dark:text-red-400">
            Error loading golfer: {error instanceof Error ? error.message : 'Unknown error'}
          </p>
        </div>
      </div>
    );
  }

  if (!golfer || Object.keys(golfer).length === 0) {
    return (
      <div className="space-y-4">
        <button onClick={() => navigate(-1)} className="text-blue-600 dark:text-blue-400 hover:underline">&larr; Back</button>
        <div className="bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
          <p className="text-yellow-700 dark:text-yellow-400">Golfer not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => navigate(-1)} className="text-blue-600 dark:text-blue-400 hover:underline">&larr; Back</button>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          {golfer.firstName} {golfer.lastName}
        </h1>
        <span className="text-gray-500 dark:text-gray-400">({golfer.golflinkNo})</span>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex gap-4">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        {activeTab === 'profile' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h3 className="font-semibold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-2">Personal Information</h3>
              <dl className="space-y-2">
                <div className="flex">
                  <dt className="w-32 text-gray-500 dark:text-gray-400">First Name</dt>
                  <dd className="text-gray-900 dark:text-gray-100">{golfer.firstName || '-'}</dd>
                </div>
                <div className="flex">
                  <dt className="w-32 text-gray-500 dark:text-gray-400">Last Name</dt>
                  <dd className="text-gray-900 dark:text-gray-100">{golfer.lastName || '-'}</dd>
                </div>
                <div className="flex">
                  <dt className="w-32 text-gray-500 dark:text-gray-400">Email</dt>
                  <dd className="text-gray-900 dark:text-gray-100">{golfer.email || '-'}</dd>
                </div>
                <div className="flex">
                  <dt className="w-32 text-gray-500 dark:text-gray-400">Mobile</dt>
                  <dd className="text-gray-900 dark:text-gray-100">{golfer.mobileNo || '-'}</dd>
                </div>
                <div className="flex">
                  <dt className="w-32 text-gray-500 dark:text-gray-400">Gender</dt>
                  <dd className="text-gray-900 dark:text-gray-100">{golfer.gender === 'm' ? 'Male' : golfer.gender === 'f' ? 'Female' : '-'}</dd>
                </div>
                <div className="flex">
                  <dt className="w-32 text-gray-500 dark:text-gray-400">Date of Birth</dt>
                  <dd className="text-gray-900 dark:text-gray-100">{formatDate(golfer.dateOfBirth)}</dd>
                </div>
              </dl>
            </div>

            <div className="space-y-4">
              <h3 className="font-semibold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-2">Golf Information</h3>
              <dl className="space-y-2">
                <div className="flex">
                  <dt className="w-32 text-gray-500 dark:text-gray-400">GA Number</dt>
                  <dd className="text-gray-900 dark:text-gray-100 font-mono">{golfer.golflinkNo || '-'}</dd>
                </div>
                <div className="flex">
                  <dt className="w-32 text-gray-500 dark:text-gray-400">Club</dt>
                  <dd className="text-gray-900 dark:text-gray-100">{getClubName(golfer.golflinkNo)}</dd>
                </div>
                <div className="flex">
                  <dt className="w-32 text-gray-500 dark:text-gray-400">Handicap</dt>
                  <dd className="text-gray-900 dark:text-gray-100">{golfer.handicap ?? golfer.golfLinkHandicap ?? '-'}</dd>
                </div>
                <div className="flex">
                  <dt className="w-32 text-gray-500 dark:text-gray-400">Token Balance</dt>
                  <dd>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      golfer.tokenBalance > 0 ? 'bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-300' : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300'
                    }`}>
                      {golfer.tokenBalance}
                    </span>
                  </dd>
                </div>
                <div className="flex">
                  <dt className="w-32 text-gray-500 dark:text-gray-400">Member Since</dt>
                  <dd className="text-gray-900 dark:text-gray-100">{formatDate(golfer.memberSince)}</dd>
                </div>
                <div className="flex">
                  <dt className="w-32 text-gray-500 dark:text-gray-400">State</dt>
                  <dd className="text-gray-900 dark:text-gray-100">{golfer.state?.shortName || '-'}</dd>
                </div>
              </dl>
            </div>

            <div className="space-y-4">
              <h3 className="font-semibold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-2">App Information</h3>
              <dl className="space-y-2">
                <div className="flex">
                  <dt className="w-32 text-gray-500 dark:text-gray-400">App Version</dt>
                  <dd className="text-gray-900 dark:text-gray-100">{golfer.sogoAppVersion || '-'}</dd>
                </div>
                <div className="flex">
                  <dt className="w-32 text-gray-500 dark:text-gray-400">Device OS</dt>
                  <dd className="text-gray-900 dark:text-gray-100">{golfer.deviceOS || '-'}</dd>
                </div>
                <div className="flex">
                  <dt className="w-32 text-gray-500 dark:text-gray-400">OS Version</dt>
                  <dd className="text-gray-900 dark:text-gray-100">{golfer.deviceOSVersion || '-'}</dd>
                </div>
                <div className="flex">
                  <dt className="w-32 text-gray-500 dark:text-gray-400">Device</dt>
                  <dd className="text-gray-900 dark:text-gray-100">{golfer.deviceModel || '-'}</dd>
                </div>
              </dl>
            </div>

            <div className="space-y-4">
              <h3 className="font-semibold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-2">Status</h3>
              <dl className="space-y-2">
                <div className="flex">
                  <dt className="w-32 text-gray-500 dark:text-gray-400">User Type</dt>
                  <dd className="text-gray-900 dark:text-gray-100 capitalize">{golfer.userType || '-'}</dd>
                </div>
                <div className="flex">
                  <dt className="w-32 text-gray-500 dark:text-gray-400">Signup Status</dt>
                  <dd className="text-gray-900 dark:text-gray-100">{golfer.signupStatus || '-'}</dd>
                </div>
                <div className="flex">
                  <dt className="w-32 text-gray-500 dark:text-gray-400">Inactive</dt>
                  <dd className="text-gray-900 dark:text-gray-100">{golfer.isInactive ? 'Yes' : 'No'}</dd>
                </div>
              </dl>
            </div>
          </div>
        )}

        {activeTab === 'rounds' && golfer.golflinkNo && (
          <RoundsTab golflinkNo={golfer.golflinkNo} />
        )}

        {activeTab === 'transactions' && golfer.email && (
          <TransactionsTab email={golfer.email} tokenBalance={golfer.tokenBalance ?? 0} />
        )}
        {activeTab === 'transactions' && !golfer.email && (
          <div className="text-gray-500 dark:text-gray-400 text-center py-8">
            No email address available for this golfer.
          </div>
        )}
      </div>
    </div>
  );
}
