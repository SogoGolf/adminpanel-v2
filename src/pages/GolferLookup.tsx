import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { golferService, transactionService } from '../services';
import { TransactionTable } from '../components/TransactionTable';
import { AddTokensDialog } from '../components/AddTokensDialog';
import { useFeature } from '../contexts/TenantContext';
import { useAuth } from '../contexts/AuthContext';

export function GolferLookup() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [golflinkNo, setGolflinkNo] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);

  const { adminUser } = useAuth();
  const canAddTokens = useFeature('canAddTokens');
  const canViewRounds = useFeature('canViewRounds');

  // Get search term from URL params
  const searchTerm = searchParams.get('golflinkNo') || '';

  // Initialize input from URL on mount
  useEffect(() => {
    if (searchTerm) {
      setGolflinkNo(searchTerm);
    }
  }, []);

  // Fetch golfer
  const {
    data: golfer,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ['golfer', searchTerm],
    queryFn: () => golferService.getByGolflinkNo(searchTerm),
    enabled: !!searchTerm,
  });

  // Fetch transactions
  const { data: transactions = [], isLoading: transactionsLoading } = useQuery({
    queryKey: ['transactions', golfer?.id],
    queryFn: () => transactionService.getForGolfer(golfer!.id),
    enabled: !!golfer?.id,
  });

  // Fetch transaction types (filtered to Admin Credit/Debit only)
  const { data: transactionTypes = [] } = useQuery({
    queryKey: ['transactionTypes'],
    queryFn: () => transactionService.getAdminTypes(),
  });

  // Add transaction mutation
  const addTransactionMutation = useMutation({
    mutationFn: async ({
      transactionTypeId,
      amount,
    }: {
      transactionTypeId: string;
      amount: number;
    }) => {
      if (!golfer || currentBalance === null) {
        throw new Error('Golfer or balance not available');
      }

      const transactionType = transactionTypes.find((t) => t.id === transactionTypeId);
      if (!transactionType) {
        throw new Error('Transaction type not found');
      }

      // Pass admin user for audit logging
      const performedBy = adminUser ? {
        id: adminUser.id,
        email: adminUser.email,
        name: adminUser.name,
      } : undefined;

      return transactionService.addTransaction(golfer, transactionType, amount, currentBalance, performedBy);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions', golfer?.id] });
      setDialogOpen(false);
    },
  });

  // Get balance using service
  const currentBalance = transactionsLoading || !golfer
    ? null
    : transactionService.getCurrentBalance(transactions, golfer);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (golflinkNo.trim()) {
      setSearchParams({ golflinkNo: golflinkNo.trim() });
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch(e);
    }
  };

  const handleAddTokens = (transactionTypeId: string, amount: number) => {
    addTransactionMutation.mutate({ transactionTypeId, amount });
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Golfer Lookup</h1>

      <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3 mb-6">
        <input
          type="text"
          value={golflinkNo}
          onChange={(e) => setGolflinkNo(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Enter GolfLink number (e.g. 3021600123)"
          className="flex-1 sm:max-w-sm border border-gray-300 rounded px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="submit"
          disabled={isLoading}
          className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:opacity-50"
        >
          {isLoading ? 'Searching...' : 'Search'}
        </button>
      </form>

      {isError && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
          Error searching for golfer: {(error as Error).message}
        </div>
      )}

      {searchTerm && !isLoading && !golfer && !isError && (
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-3 rounded mb-4">
          No golfer found with GolfLink number: {searchTerm}
        </div>
      )}

      {golfer && (
        <>
          {/* Golfer Summary Card */}
          <div className="bg-white rounded-lg shadow-md p-4 sm:p-6 mb-6">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
              <div>
                <h2 className="text-xl font-semibold mb-4">
                  {golfer.firstName} {golfer.lastName}
                </h2>
                <div className="grid grid-cols-[120px_1fr] sm:grid-cols-[140px_1fr] gap-2 text-sm">
                  <span className="font-medium text-gray-600">Email:</span>
                  <span className="break-all">{golfer.email}</span>

                  <span className="font-medium text-gray-600">GolfLink #:</span>
                  <span>{golfer.golflinkNo}</span>

                  <span className="font-medium text-gray-600">App Member Since:</span>
                  <span>
                    {golfer.memberSince
                      ? new Date(golfer.memberSince).toLocaleDateString('en-GB', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })
                      : 'N/A'}
                  </span>

                  <span className="font-medium text-gray-600">State:</span>
                  <span>{golfer.state?.shortName ?? 'N/A'}</span>

                  <span className="font-medium text-gray-600">Gender:</span>
                  <span>
                    {golfer.gender === 'm' || golfer.gender === 'M'
                      ? 'Male'
                      : golfer.gender === 'f' || golfer.gender === 'F'
                        ? 'Female'
                        : golfer.gender ?? 'N/A'}
                  </span>
                </div>
              </div>
              <div className="text-left sm:text-right">
                <p className="text-sm text-gray-500">Token Balance</p>
                <p className="text-3xl font-bold text-green-600">
                  {currentBalance === null ? '...' : currentBalance}
                </p>
              </div>
            </div>
          </div>

          {/* Transaction History */}
          {canAddTokens && (
            <div className="mb-4">
              <button
                onClick={() => setDialogOpen(true)}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
              >
                Add Tokens
              </button>
            </div>
          )}
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="px-4 sm:px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold">Transaction History</h2>
            </div>
            {transactionsLoading ? (
              <div className="text-center py-8 text-gray-500">Loading transactions...</div>
            ) : (
              <TransactionTable transactions={transactions} />
            )}
          </div>

          {canViewRounds && (
            <div className="bg-white rounded-lg shadow-md overflow-hidden mt-6">
              <div className="px-4 sm:px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold">Rounds History</h2>
              </div>
              <div className="text-center py-8 text-gray-500">
                Coming soon
              </div>
            </div>
          )}

          {canAddTokens && (
            <AddTokensDialog
              open={dialogOpen}
              onClose={() => setDialogOpen(false)}
              onSave={handleAddTokens}
              transactionTypes={transactionTypes}
              saving={addTransactionMutation.isPending}
            />
          )}
        </>
      )}
    </div>
  );
}
