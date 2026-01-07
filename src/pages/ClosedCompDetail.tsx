import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getClosedCompById,
  getClosedCompParticipants,
  getClosedCompRounds,
  getClosedCompLeaderboard,
  updateClosedCompStatus,
  deleteClosedComp,
  updateParticipantStatus,
  updateClosedComp,
  getRoundById,
  searchGolfers,
} from '../api/mongodb';
import type { UpdateClosedCompParams } from '../api/mongodb';
import { ConfirmDialog } from '../components/ConfirmDialog';
import type { ClosedCompParticipant, HoleScore, Golfer } from '../types';

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

// Hook to get playing partner name for a round
function usePlayingPartner(roundId: string) {
  const { data: round } = useQuery({
    queryKey: ['round', roundId],
    queryFn: () => getRoundById(roundId),
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  });

  if (!round?.playingPartnerRound) return null;
  const pp = round.playingPartnerRound;
  return `${pp.golferFirstName || ''} ${pp.golferLastName || ''}`.trim() || null;
}

// Component to display playing partner name
function PlayingPartnerCell({ roundId }: { roundId: string }) {
  const partnerName = usePlayingPartner(roundId);
  return <span>{partnerName || '-'}</span>;
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

  return (
    <div className="flex flex-col lg:flex-row gap-8">
      {/* Golfer's scorecard */}
      <div>
        <h4 className="text-sm font-semibold text-gray-900 mb-2">
          {round.golferFirstName || ''} {round.golferLastName || 'Golfer'}
        </h4>
        <ScorecardTable holeScores={round.holeScores} />
      </div>

      {/* Playing partner's scorecard */}
      {round.playingPartnerRound?.holeScores && round.playingPartnerRound.holeScores.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-gray-900 mb-2">
            {round.playingPartnerRound.golferFirstName || ''} {round.playingPartnerRound.golferLastName || 'Playing Partner'}
          </h4>
          <ScorecardTable holeScores={round.playingPartnerRound.holeScores} />
        </div>
      )}
    </div>
  );
}

type TabType = 'info' | 'participants' | 'rounds' | 'leaderboard';

export function ClosedCompDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabType>('info');
  const [showCloseDialog, setShowCloseDialog] = useState(false);
  const [showReopenDialog, setShowReopenDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showBlockDialog, setShowBlockDialog] = useState(false);
  const [showBlockAllDialog, setShowBlockAllDialog] = useState(false);
  const [showUnblockAllDialog, setShowUnblockAllDialog] = useState(false);
  const [selectedParticipant, setSelectedParticipant] = useState<ClosedCompParticipant | null>(null);
  const [expandedRounds, setExpandedRounds] = useState<Set<string>>(new Set());

  // Invite modal state
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteSearch, setInviteSearch] = useState('');
  const [inviteState, setInviteState] = useState('');
  const [invitePage, setInvitePage] = useState(1);
  const [, setInviteResults] = useState<Golfer[]>([]);
  const [, setInviteTotalPages] = useState(0);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState('');

  // Edit modal state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '',
    prize: '',
    maxRounds: 3,
    holesPerRound: 18,
    roundSelectionMode: 'best' as 'best' | 'first',
    startDate: '',
    endDate: '',
    timezone: 'Australia/Sydney',
  });
  const [editError, setEditError] = useState('');

  const toggleRoundExpansion = (roundId: string) => {
    setExpandedRounds((prev) => {
      const next = new Set(prev);
      if (next.has(roundId)) {
        next.delete(roundId);
      } else {
        next.add(roundId);
      }
      return next;
    });
  };

  const { data: comp, isLoading: compLoading } = useQuery({
    queryKey: ['closedComp', id],
    queryFn: () => getClosedCompById(id!),
    enabled: !!id,
  });

  const { data: participants = [] } = useQuery({
    queryKey: ['closedCompParticipants', id],
    queryFn: () => getClosedCompParticipants(id!),
    enabled: !!id,
  });

  const { data: rounds = [] } = useQuery({
    queryKey: ['closedCompRounds', id],
    queryFn: () => getClosedCompRounds(id!),
    enabled: !!id,
  });

  const { data: leaderboard } = useQuery({
    queryKey: ['closedCompLeaderboard', id],
    queryFn: () => getClosedCompLeaderboard(id!),
    enabled: !!id && activeTab === 'leaderboard',
  });

  const closeCompMutation = useMutation({
    mutationFn: () => updateClosedCompStatus(id!, 'closed'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['closedComp', id] });
      setShowCloseDialog(false);
    },
  });

  const reopenCompMutation = useMutation({
    mutationFn: () => updateClosedCompStatus(id!, 'active'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['closedComp', id] });
      setShowReopenDialog(false);
    },
  });

  const deleteCompMutation = useMutation({
    mutationFn: () => deleteClosedComp(id!),
    onSuccess: () => {
      navigate('/closed-comps');
    },
  });

  const updateParticipantMutation = useMutation({
    mutationFn: ({ participantId, status }: { participantId: string; status: 'accepted' | 'blocked' }) =>
      updateParticipantStatus(id!, participantId, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['closedCompParticipants', id] });
      setShowBlockDialog(false);
      setSelectedParticipant(null);
    },
  });

  const blockAllMutation = useMutation({
    mutationFn: async () => {
      const nonOwnerParticipants = participants.filter(p => !p.isOwner && p.status !== 'blocked');
      await Promise.all(
        nonOwnerParticipants.map(p => updateParticipantStatus(id!, p.id, 'blocked'))
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['closedCompParticipants', id] });
      setShowBlockAllDialog(false);
    },
  });

  const unblockAllMutation = useMutation({
    mutationFn: async () => {
      const blockedParticipants = participants.filter(p => !p.isOwner && p.status === 'blocked');
      await Promise.all(
        blockedParticipants.map(p => updateParticipantStatus(id!, p.id, 'accepted'))
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['closedCompParticipants', id] });
      setShowUnblockAllDialog(false);
    },
  });

  const editCompMutation = useMutation({
    mutationFn: (params: UpdateClosedCompParams) => updateClosedComp(id!, params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['closedComp', id] });
      setShowEditModal(false);
      setEditError('');
    },
    onError: (error: Error) => {
      setEditError(error.message || 'Failed to update competition');
    },
  });

  const handleOpenEditModal = () => {
    if (comp) {
      // Format dates for date input (YYYY-MM-DD)
      const formatDateForInput = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toISOString().split('T')[0];
      };

      setEditForm({
        name: comp.name,
        prize: comp.prize || '',
        maxRounds: comp.maxRounds,
        holesPerRound: comp.holesPerRound,
        roundSelectionMode: comp.roundSelectionMode || 'best',
        startDate: formatDateForInput(comp.startDate),
        endDate: formatDateForInput(comp.endDate),
        timezone: comp.timezone,
      });
      setEditError('');
      setShowEditModal(true);
    }
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setEditError('');

    // Validation
    if (!editForm.name.trim()) {
      setEditError('Name is required');
      return;
    }
    if (editForm.maxRounds < 1) {
      setEditError('Max rounds must be at least 1');
      return;
    }
    if (new Date(editForm.startDate) >= new Date(editForm.endDate)) {
      setEditError('End date must be after start date');
      return;
    }

    // Build params object with only changed fields
    const params: UpdateClosedCompParams = {};
    if (editForm.name !== comp?.name) params.name = editForm.name;
    if (editForm.prize !== (comp?.prize || '')) params.prize = editForm.prize;
    if (editForm.maxRounds !== comp?.maxRounds) params.maxRounds = editForm.maxRounds;
    if (editForm.holesPerRound !== comp?.holesPerRound) params.holesPerRound = editForm.holesPerRound;
    if (editForm.roundSelectionMode !== (comp?.roundSelectionMode || 'best')) params.roundSelectionMode = editForm.roundSelectionMode;
    if (editForm.timezone !== comp?.timezone) params.timezone = editForm.timezone;

    // Format dates to ISO string for API
    const formatDateForApi = (dateStr: string) => new Date(dateStr).toISOString();
    const currentStartDate = comp?.startDate ? new Date(comp.startDate).toISOString().split('T')[0] : '';
    const currentEndDate = comp?.endDate ? new Date(comp.endDate).toISOString().split('T')[0] : '';

    if (editForm.startDate !== currentStartDate) params.startDate = formatDateForApi(editForm.startDate);
    if (editForm.endDate !== currentEndDate) params.endDate = formatDateForApi(editForm.endDate);

    if (Object.keys(params).length === 0) {
      setEditError('No changes to save');
      return;
    }

    editCompMutation.mutate(params);
  };

  const handleInviteSearch = async () => {
    if (!inviteSearch.trim() && !inviteState) {
      setInviteResults([]);
      setInviteTotalPages(0);
      return;
    }
    setInviteLoading(true);
    setInviteError('');
    try {
      const result = await searchGolfers({
        search: inviteSearch.trim() || undefined,
        state: inviteState || undefined,
        page: invitePage,
        pageSize: 10,
      });
      setInviteResults(result.data);
      setInviteTotalPages(result.totalPages);
    } catch {
      setInviteError('Failed to search golfers');
      setInviteResults([]);
    } finally {
      setInviteLoading(false);
    }
  };

  const handleCloseInviteModal = () => {
    setShowInviteModal(false);
    setInviteSearch('');
    setInviteState('');
    setInvitePage(1);
    setInviteResults([]);
    setInviteTotalPages(0);
    setInviteError('');
  };

  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-AU', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const formatDateTime = (dateString: string | undefined) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString('en-AU', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusBadge = (status: string) => {
    const baseClasses = 'px-2 py-1 rounded-full text-xs font-medium';
    switch (status) {
      case 'active':
        return <span className={`${baseClasses} bg-green-100 text-green-800`}>Active</span>;
      case 'closed':
        return <span className={`${baseClasses} bg-gray-100 text-gray-800`}>Closed</span>;
      case 'accepted':
        return <span className={`${baseClasses} bg-blue-100 text-blue-800`}>Accepted</span>;
      case 'blocked':
        return <span className={`${baseClasses} bg-red-100 text-red-800`}>Blocked</span>;
      case 'invited':
        return <span className={`${baseClasses} bg-yellow-100 text-yellow-800`}>Invited</span>;
      default:
        return <span className={`${baseClasses} bg-gray-100 text-gray-800`}>{status}</span>;
    }
  };

  const getRankDisplay = (rank: number) => {
    const colors: Record<number, string> = {
      1: 'text-yellow-500',
      2: 'text-gray-400',
      3: 'text-amber-600',
    };
    const suffix = rank === 1 ? 'st' : rank === 2 ? 'nd' : rank === 3 ? 'rd' : 'th';
    return (
      <span className={`font-bold text-lg ${colors[rank] || 'text-gray-700'}`}>
        {rank}{suffix}
      </span>
    );
  };

  if (compLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!comp) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-800">Competition not found</p>
      </div>
    );
  }

  const tabs: { key: TabType; label: string; count?: number }[] = [
    { key: 'info', label: 'Info' },
    { key: 'participants', label: 'Participants', count: participants.length },
    { key: 'rounds', label: 'Rounds', count: rounds.length },
    { key: 'leaderboard', label: 'Leaderboard' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
        <div>
          <button
            onClick={() => navigate('/closed-comps')}
            className="text-blue-600 hover:text-blue-800 text-sm mb-2 flex items-center gap-1"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to List
          </button>
          <h1 className="text-2xl font-bold text-gray-900">{comp.name}</h1>
          <p className="text-gray-500">
            Invite Code: <code className="bg-gray-100 px-2 py-1 rounded font-mono text-lg">{comp.inviteCode}</code>
          </p>
        </div>
        {getStatusBadge(comp.status)}
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow">
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-6 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                  activeTab === tab.key
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.label}
                {tab.count !== undefined && (
                  <span className="ml-2 bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full text-xs">
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {/* Info Tab */}
          {activeTab === 'info' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-gray-500">Owner</label>
                    <p className="text-gray-900">{comp.ownerFirstName} {comp.ownerLastName}</p>
                    <p className="text-sm text-gray-500">{comp.ownerEmail}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Competition Type</label>
                    <p className="text-gray-900">{comp.compTypes?.join(', ') || 'N/A'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Max Rounds</label>
                    <p className="text-gray-900">{comp.maxRounds}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Holes per Round</label>
                    <p className="text-gray-900">{comp.holesPerRound}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Round Selection Mode</label>
                    <p className="text-gray-900">
                      {comp.roundSelectionMode === 'first' ? 'First submitted (no replacements)' : 'Best rounds (can replace worse)'}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Participants</label>
                    <p className="text-gray-900">{comp.participantCount}</p>
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-gray-500">Prize</label>
                    <p className="text-gray-900">{comp.prize || 'N/A'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Start Date</label>
                    <p className="text-gray-900">{formatDate(comp.startDate)}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">End Date</label>
                    <p className="text-gray-900">{formatDate(comp.endDate)}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Timezone</label>
                    <p className="text-gray-900">{comp.timezone}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Created</label>
                    <p className="text-gray-900">{formatDateTime(comp.createdDate)}</p>
                  </div>
                </div>
              </div>

              <div className="border-t pt-6 flex flex-wrap gap-3">
                <button
                  onClick={handleOpenEditModal}
                  className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
                >
                  Edit Competition
                </button>
                {comp.status === 'active' && (
                  <button
                    onClick={() => setShowCloseDialog(true)}
                    className="bg-yellow-500 text-white px-4 py-2 rounded-md hover:bg-yellow-600 transition-colors"
                  >
                    Close Competition
                  </button>
                )}
                {comp.status === 'closed' && (
                  <button
                    onClick={() => setShowReopenDialog(true)}
                    className="bg-green-500 text-white px-4 py-2 rounded-md hover:bg-green-600 transition-colors"
                  >
                    Reopen Competition
                  </button>
                )}
                <button
                  onClick={() => setShowDeleteDialog(true)}
                  className="bg-red-500 text-white px-4 py-2 rounded-md hover:bg-red-600 transition-colors"
                >
                  Delete Competition
                </button>
              </div>
            </div>
          )}

          {/* Participants Tab */}
          {activeTab === 'participants' && (
            <div className="space-y-4">
              {/* Action Buttons */}
              <div className="flex flex-wrap justify-start gap-2 sm:gap-3">
                <button
                  onClick={() => setShowInviteModal(true)}
                  className="bg-blue-600 text-white px-3 py-2 sm:px-4 rounded-md hover:bg-blue-700 transition-colors flex items-center gap-2 text-sm sm:text-base"
                >
                  <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Invite Golfer
                </button>
                {participants.filter(p => !p.isOwner && p.status !== 'blocked').length > 0 && (
                  <button
                    onClick={() => setShowBlockAllDialog(true)}
                    className="bg-red-500 text-white px-3 py-2 sm:px-4 rounded-md hover:bg-red-600 transition-colors text-sm sm:text-base"
                  >
                    Block All
                  </button>
                )}
                {participants.filter(p => !p.isOwner && p.status === 'blocked').length > 0 && (
                  <button
                    onClick={() => setShowUnblockAllDialog(true)}
                    className="bg-green-500 text-white px-3 py-2 sm:px-4 rounded-md hover:bg-green-600 transition-colors text-sm sm:text-base"
                  >
                    Unblock All
                  </button>
                )}
              </div>

              {/* Mobile Card View */}
              <div className="md:hidden space-y-3">
                {participants.map((p) => (
                  <div key={p.id} className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="font-medium text-gray-900">
                          {p.golferFirstName} {p.golferLastName}
                          {p.isOwner && <span className="ml-2 text-xs text-blue-600">(Owner)</span>}
                        </p>
                        <p className="text-sm text-gray-500">{p.golferEmail}</p>
                      </div>
                      {getStatusBadge(p.status)}
                    </div>
                    <div className="flex justify-between items-center text-sm text-gray-500">
                      <span>{p.roundsSubmitted} round{p.roundsSubmitted !== 1 ? 's' : ''}</span>
                      <span>Joined {formatDate(p.acceptedDate)}</span>
                    </div>
                    {!p.isOwner && (
                      <div className="mt-3 pt-3 border-t border-gray-100">
                        <button
                          onClick={() => {
                            setSelectedParticipant(p);
                            setShowBlockDialog(true);
                          }}
                          className={`w-full px-3 py-2 rounded text-sm ${
                            p.status === 'blocked'
                              ? 'bg-green-100 text-green-700 hover:bg-green-200'
                              : 'bg-red-100 text-red-700 hover:bg-red-200'
                          }`}
                        >
                          {p.status === 'blocked' ? 'Unblock' : 'Block'}
                        </button>
                      </div>
                    )}
                  </div>
                ))}
                {participants.length === 0 && (
                  <div className="text-center py-8 text-gray-500">No participants</div>
                )}
              </div>

              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Owner</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rounds</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Joined</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {participants.map((p) => (
                      <tr key={p.id}>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {p.golferFirstName} {p.golferLastName}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">{p.golferEmail}</td>
                        <td className="px-4 py-3 whitespace-nowrap">{getStatusBadge(p.status)}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm">{p.isOwner ? 'Yes' : 'No'}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm">{p.roundsSubmitted}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                          {formatDate(p.acceptedDate)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {!p.isOwner && (
                            <button
                              onClick={() => {
                                setSelectedParticipant(p);
                                setShowBlockDialog(true);
                              }}
                              className={`px-3 py-1 rounded text-sm ${
                                p.status === 'blocked'
                                  ? 'bg-green-100 text-green-700 hover:bg-green-200'
                                  : 'bg-red-100 text-red-700 hover:bg-red-200'
                              }`}
                            >
                              {p.status === 'blocked' ? 'Unblock' : 'Block'}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                    {participants.length === 0 && (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                          No participants
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Rounds Tab */}
          {activeTab === 'rounds' && (
            <div>
              {/* Mobile Card View */}
              <div className="md:hidden space-y-3">
                {rounds.map((r) => (
                  <div key={r.id} className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
                    <div className="p-4">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <p className="font-medium text-gray-900">
                            {r.golferFirstName} {r.golferLastName}
                          </p>
                          <p className="text-sm text-gray-500">{r.clubName}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold text-gray-900">{r.score}</p>
                          <p className="text-xs text-gray-500">{r.compType}</p>
                        </div>
                      </div>
                      <div className="flex justify-between items-center text-sm text-gray-500 mb-2">
                        <span>Played: {formatDate(r.roundDate)}</span>
                        <span>Partner: <PlayingPartnerCell roundId={r.roundId} /></span>
                      </div>
                      <button
                        onClick={() => toggleRoundExpansion(r.roundId)}
                        className="w-full text-blue-600 hover:text-blue-800 text-sm font-medium py-2 border-t border-gray-100 mt-2"
                      >
                        {expandedRounds.has(r.roundId) ? 'Hide Scorecard' : 'View Scorecard'}
                      </button>
                    </div>
                    {expandedRounds.has(r.roundId) && (
                      <div className="bg-gray-50 p-4 border-t border-gray-200 overflow-x-auto">
                        <ExpandedRoundDetails roundId={r.roundId} />
                      </div>
                    )}
                  </div>
                ))}
                {rounds.length === 0 && (
                  <div className="text-center py-8 text-gray-500">No rounds submitted</div>
                )}
              </div>

              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase"></th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Golfer</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Score</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Club</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Round Date</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Submitted</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Playing Partner</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {rounds.map((r) => (
                      <React.Fragment key={r.id}>
                        <tr className="hover:bg-gray-50">
                          <td className="px-4 py-3 whitespace-nowrap">
                            <button
                              onClick={() => toggleRoundExpansion(r.roundId)}
                              className="text-blue-600 hover:text-blue-800 hover:underline text-xs font-medium"
                            >
                              {expandedRounds.has(r.roundId) ? 'Hide' : 'Details'}
                            </button>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            {r.golferFirstName} {r.golferLastName}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap font-bold">{r.score}</td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">{r.compType}</td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">{r.clubName}</td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                            {formatDate(r.roundDate)}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                            {formatDateTime(r.submittedDate)}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                            <PlayingPartnerCell roundId={r.roundId} />
                          </td>
                        </tr>
                        {expandedRounds.has(r.roundId) && (
                          <tr className="bg-gray-50">
                            <td colSpan={8} className="px-4 py-4">
                              <ExpandedRoundDetails roundId={r.roundId} />
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                    {rounds.length === 0 && (
                      <tr>
                        <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                          No rounds submitted
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Leaderboard Tab */}
          {activeTab === 'leaderboard' && (
            <div>
              {leaderboard && (
                <div className="mb-4">
                  <p className="text-sm text-gray-500">
                    {leaderboard.compType} leaderboard - Best {leaderboard.maxRounds} rounds count towards total
                  </p>
                </div>
              )}

              {/* Mobile Card View */}
              <div className="md:hidden space-y-3">
                {leaderboard?.leaderboard.map((entry) => (
                  <div
                    key={entry.golferId}
                    className={`bg-white border rounded-lg p-4 shadow-sm ${
                      entry.rank <= 3 ? 'border-yellow-300 bg-yellow-50/50' : 'border-gray-200'
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-3">
                        {getRankDisplay(entry.rank)}
                        <div>
                          <p className="font-medium text-gray-900">{entry.golferName}</p>
                          <p className="text-xs text-gray-500">{entry.golferEmail}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-gray-900">{entry.totalScore}</p>
                        <p className="text-xs text-gray-500">{entry.roundsCount} round{entry.roundsCount !== 1 ? 's' : ''}</p>
                      </div>
                    </div>
                  </div>
                ))}
                {(!leaderboard?.leaderboard || leaderboard.leaderboard.length === 0) && (
                  <div className="text-center py-8 text-gray-500">No entries yet</div>
                )}
              </div>

              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rank</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Golfer</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total Score</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rounds</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {leaderboard?.leaderboard.map((entry) => (
                      <tr key={entry.golferId} className={entry.rank <= 3 ? 'bg-yellow-50/50' : ''}>
                        <td className="px-4 py-3 whitespace-nowrap">{getRankDisplay(entry.rank)}</td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="font-medium">{entry.golferName}</div>
                          <div className="text-xs text-gray-500">{entry.golferEmail}</div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="text-xl font-bold">{entry.totalScore}</span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                          {entry.roundsCount}
                        </td>
                      </tr>
                    ))}
                    {(!leaderboard?.leaderboard || leaderboard.leaderboard.length === 0) && (
                      <tr>
                        <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                          No entries yet
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Close Competition Dialog */}
      <ConfirmDialog
        open={showCloseDialog}
        title="Close Competition?"
        message="Are you sure you want to close this competition? This will prevent any new rounds from being submitted."
        confirmLabel="Close Competition"
        cancelLabel="Cancel"
        variant="warning"
        onConfirm={() => closeCompMutation.mutate()}
        onCancel={() => setShowCloseDialog(false)}
      />

      {/* Reopen Competition Dialog */}
      <ConfirmDialog
        open={showReopenDialog}
        title="Reopen Competition?"
        message="Are you sure you want to reopen this competition? Participants will be able to submit rounds again."
        confirmLabel="Reopen Competition"
        cancelLabel="Cancel"
        variant="success"
        onConfirm={() => reopenCompMutation.mutate()}
        onCancel={() => setShowReopenDialog(false)}
      />

      {/* Delete Competition Dialog */}
      <ConfirmDialog
        open={showDeleteDialog}
        title="Delete Competition?"
        message="Warning: This will permanently delete the competition and all associated participants and rounds. This action cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={() => deleteCompMutation.mutate()}
        onCancel={() => setShowDeleteDialog(false)}
      />

      {/* Block/Unblock Participant Dialog */}
      <ConfirmDialog
        open={showBlockDialog}
        title={selectedParticipant?.status === 'blocked' ? 'Unblock Participant?' : 'Block Participant?'}
        message={
          selectedParticipant?.status === 'blocked'
            ? `Are you sure you want to unblock ${selectedParticipant?.golferFirstName} ${selectedParticipant?.golferLastName}? They will be able to submit rounds again.`
            : `Are you sure you want to block ${selectedParticipant?.golferFirstName} ${selectedParticipant?.golferLastName}? They will no longer be able to submit rounds to this competition.`
        }
        confirmLabel={selectedParticipant?.status === 'blocked' ? 'Unblock' : 'Block'}
        cancelLabel="Cancel"
        variant={selectedParticipant?.status === 'blocked' ? 'success' : 'danger'}
        onConfirm={() => {
          if (selectedParticipant) {
            updateParticipantMutation.mutate({
              participantId: selectedParticipant.id,
              status: selectedParticipant.status === 'blocked' ? 'accepted' : 'blocked',
            });
          }
        }}
        onCancel={() => {
          setShowBlockDialog(false);
          setSelectedParticipant(null);
        }}
      />

      {/* Block All Participants Dialog */}
      <ConfirmDialog
        open={showBlockAllDialog}
        title="Block All Users?"
        message={`Are you sure you want to block all ${participants.filter(p => !p.isOwner && p.status !== 'blocked').length} participant(s)? They will no longer be able to submit rounds to this competition.`}
        confirmLabel="Block All"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={() => blockAllMutation.mutate()}
        onCancel={() => setShowBlockAllDialog(false)}
      />

      {/* Unblock All Participants Dialog */}
      <ConfirmDialog
        open={showUnblockAllDialog}
        title="Unblock All Users?"
        message={`Are you sure you want to unblock all ${participants.filter(p => !p.isOwner && p.status === 'blocked').length} blocked participant(s)? They will be able to submit rounds again.`}
        confirmLabel="Unblock All"
        cancelLabel="Cancel"
        variant="success"
        onConfirm={() => unblockAllMutation.mutate()}
        onCancel={() => setShowUnblockAllDialog(false)}
      />

      {/* Invite Golfer Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-xl font-semibold text-gray-900">Invite Golfer to Competition</h2>
              <button
                onClick={handleCloseInviteModal}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              {inviteError && (
                <div className="bg-red-50 border border-red-200 rounded-md p-3 text-red-700 text-sm">
                  {inviteError}
                </div>
              )}

              {/* Search Form */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  setInvitePage(1);
                  handleInviteSearch();
                }}
                className="flex flex-wrap gap-4 items-end"
              >
                <div className="flex-1 min-w-[200px]">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
                  <input
                    type="text"
                    value={inviteSearch}
                    onChange={(e) => setInviteSearch(e.target.value)}
                    placeholder="Name, email, or GolfLink number..."
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                  <select
                    value={inviteState}
                    onChange={(e) => setInviteState(e.target.value)}
                    className="border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">All States</option>
                    <option value="NSW">NSW</option>
                    <option value="VIC">VIC</option>
                    <option value="QLD">QLD</option>
                    <option value="WA">WA</option>
                    <option value="SA">SA</option>
                    <option value="TAS">TAS</option>
                    <option value="ACT">ACT</option>
                    <option value="NT">NT</option>
                  </select>
                </div>
                <button
                  type="submit"
                  disabled={inviteLoading}
                  className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {inviteLoading ? 'Searching...' : 'Search'}
                </button>
              </form>

              {/* Results Table - temporarily hidden */}
              {/* TODO: Re-enable when ready
              {inviteResults.length > 0 && (
                <div className="border border-gray-200 rounded-md overflow-hidden">
                  ... results table code ...
                </div>
              )}
              */}

              {/* Placeholder message */}
              <div className="text-center py-8 text-gray-500">
                Invite functionality coming soon.
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-200 flex justify-end">
              <button
                onClick={handleCloseInviteModal}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Competition Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-xl font-semibold text-gray-900">Edit Competition</h2>
              <button
                onClick={() => setShowEditModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
              {editError && (
                <div className="bg-red-50 border border-red-200 rounded-md p-3 text-red-700 text-sm">
                  {editError}
                </div>
              )}

              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Competition Name *</label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              {/* Prize */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Prize</label>
                <input
                  type="text"
                  value={editForm.prize}
                  onChange={(e) => setEditForm({ ...editForm, prize: e.target.value })}
                  placeholder="e.g., Bottle of wine for the winner!"
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Max Rounds and Holes per Round */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Max Rounds *</label>
                  <input
                    type="number"
                    min="1"
                    max="20"
                    value={editForm.maxRounds}
                    onChange={(e) => setEditForm({ ...editForm, maxRounds: parseInt(e.target.value) || 1 })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Holes per Round *</label>
                  <select
                    value={editForm.holesPerRound}
                    onChange={(e) => setEditForm({ ...editForm, holesPerRound: parseInt(e.target.value) })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value={9}>9 holes</option>
                    <option value={18}>18 holes</option>
                  </select>
                </div>
              </div>

              {/* Round Selection Mode */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Round Selection Mode</label>
                <select
                  value={editForm.roundSelectionMode}
                  onChange={(e) => setEditForm({ ...editForm, roundSelectionMode: e.target.value as 'best' | 'first' })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="best">Best rounds - new rounds can replace worse ones</option>
                  <option value="first">First submitted - lock in rounds, no replacements</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  {editForm.roundSelectionMode === 'best'
                    ? "Each player's best rounds are kept. If they submit a better round, it replaces their worst."
                    : "Once a player reaches max rounds, no more can be added. First submitted rounds are final."}
                </p>
              </div>

              {/* Start and End Dates */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start Date *</label>
                  <input
                    type="date"
                    value={editForm.startDate}
                    onChange={(e) => setEditForm({ ...editForm, startDate: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">End Date *</label>
                  <input
                    type="date"
                    value={editForm.endDate}
                    onChange={(e) => setEditForm({ ...editForm, endDate: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
              </div>

              {/* Timezone */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Timezone</label>
                <select
                  value={editForm.timezone}
                  onChange={(e) => setEditForm({ ...editForm, timezone: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="Australia/Sydney">Australia/Sydney (AEST/AEDT)</option>
                  <option value="Australia/Melbourne">Australia/Melbourne (AEST/AEDT)</option>
                  <option value="Australia/Brisbane">Australia/Brisbane (AEST)</option>
                  <option value="Australia/Perth">Australia/Perth (AWST)</option>
                  <option value="Australia/Adelaide">Australia/Adelaide (ACST/ACDT)</option>
                  <option value="Australia/Darwin">Australia/Darwin (ACST)</option>
                  <option value="Australia/Hobart">Australia/Hobart (AEST/AEDT)</option>
                  <option value="Pacific/Auckland">New Zealand (NZST/NZDT)</option>
                </select>
              </div>

              <div className="border-t pt-4 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editCompMutation.isPending}
                  className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {editCompMutation.isPending ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
