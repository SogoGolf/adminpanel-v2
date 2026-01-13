import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { v4 as uuidv4 } from 'uuid';
import { cosmosDbClient } from '../api/cosmosdb';
import { TransactionTable } from '../components/TransactionTable';
import { AddTokensDialog } from '../components/AddTokensDialog';
import { useFeature } from '../contexts/TenantContext';
import { useAuth } from '../contexts/AuthContext';
import type { Golfer, Transaction, TransactionType } from '../types';

// CosmosDB-specific transaction service (inline to ensure CosmosDB usage)
const cosmosTransactionService = {
  async getForGolfer(golferId: string): Promise<Transaction[]> {
    return cosmosDbClient.transactions.getForGolfer(golferId);
  },

  async getTypes(): Promise<TransactionType[]> {
    return cosmosDbClient.transactions.getTypes();
  },

  async getAdminTypes(): Promise<TransactionType[]> {
    const types = await cosmosDbClient.transactions.getTypes();
    return types.filter(t => t.name === 'Admin Credit' || t.name === 'Admin Debit');
  },

  getCurrentBalance(transactions: Transaction[], golfer: Golfer): number {
    if (transactions.length > 0) {
      return transactions[0].availableTokens;
    }
    return golfer.tokenBalance ?? 0;
  },

  async addTransaction(
    golfer: Golfer,
    transactionType: TransactionType,
    amount: number,
    currentBalance: number
  ): Promise<Transaction> {
    const newBalance = transactionType.debitOrCredit === 'credit'
      ? currentBalance + amount
      : currentBalance - amount;

    const transaction: Transaction = {
      id: uuidv4(),
      type: 'transaction',
      golferId: golfer.id,
      golferEmail: golfer.email,
      golferFirstName: golfer.firstName,
      golferLastName: golfer.lastName,
      transactionDate: new Date().toISOString(),
      transactionValue: amount,
      availableTokens: newBalance,
      transactionType: {
        id: transactionType.id,
        type: 'transactionType',
        name: transactionType.name,
        shortDescription: transactionType.shortDescription,
        debitOrCredit: transactionType.debitOrCredit,
      },
      createdDate: new Date().toISOString(),
    };

    return cosmosDbClient.transactions.add(transaction);
  },
};

export function GolferLookup() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [golflinkNo, setGolflinkNo] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);

  useAuth(); // Required for protected route
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

  // Fetch golfer from CosmosDB
  const {
    data: golfer,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ['cosmosdb-golfer', searchTerm],
    queryFn: () => cosmosDbClient.golfers.getByGolflinkNo(searchTerm),
    enabled: !!searchTerm,
  });

  // Fetch transactions from CosmosDB
  const { data: transactions = [], isLoading: transactionsLoading } = useQuery({
    queryKey: ['cosmosdb-transactions', golfer?.id],
    queryFn: () => cosmosTransactionService.getForGolfer(golfer!.id),
    enabled: !!golfer?.id,
  });

  // Fetch transaction types from CosmosDB (filtered to Admin Credit/Debit only)
  const { data: transactionTypes = [] } = useQuery({
    queryKey: ['cosmosdb-transactionTypes'],
    queryFn: () => cosmosTransactionService.getAdminTypes(),
  });

  // Add transaction mutation (writes to CosmosDB)
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

      return cosmosTransactionService.addTransaction(golfer, transactionType, amount, currentBalance);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cosmosdb-transactions', golfer?.id] });
      setDialogOpen(false);
    },
  });

  // Get balance using CosmosDB transaction service
  const currentBalance = transactionsLoading || !golfer
    ? null
    : cosmosTransactionService.getCurrentBalance(transactions, golfer);

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
      {/* CosmosDB Banner - clearly indicates this page operates on CosmosDB */}
      <div className="mb-6 p-4 bg-purple-100 dark:bg-purple-900/50 border-2 border-purple-500 dark:border-purple-400 rounded-lg">
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0">
            <svg className="w-8 h-8 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-bold text-purple-800 dark:text-purple-200">
              Azure CosmosDB
            </h2>
            <p className="text-sm text-purple-700 dark:text-purple-300">
              This page reads and writes golfer data and transactions directly to CosmosDB
            </p>
          </div>
        </div>
      </div>

      <h1 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">Golfer Lookup</h1>

      <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3 mb-6">
        <input
          type="text"
          value={golflinkNo}
          onChange={(e) => setGolflinkNo(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Enter GolfLink number (e.g. 3021600123)"
          className="flex-1 sm:max-w-sm border border-gray-300 dark:border-gray-600 rounded px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
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
        <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded mb-4">
          Error searching for golfer: {(error as Error).message}
        </div>
      )}

      {searchTerm && !isLoading && !golfer && !isError && (
        <div className="bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-800 text-yellow-700 dark:text-yellow-400 px-4 py-3 rounded mb-4">
          No golfer found with GolfLink number: {searchTerm}
        </div>
      )}

      {golfer && (
        <>
          {/* Golfer Summary Card */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 sm:p-6 mb-6">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
              <div>
                <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
                  {golfer.firstName} {golfer.lastName}
                </h2>
                <div className="grid grid-cols-[120px_1fr] sm:grid-cols-[140px_1fr] gap-2 text-sm">
                  <span className="font-medium text-gray-600 dark:text-gray-400">Email:</span>
                  <span className="break-all text-gray-900 dark:text-gray-100">{golfer.email}</span>

                  <span className="font-medium text-gray-600 dark:text-gray-400">GolfLink #:</span>
                  <span className="text-gray-900 dark:text-gray-100">{golfer.golflinkNo}</span>

                  <span className="font-medium text-gray-600 dark:text-gray-400">App Member Since:</span>
                  <span className="text-gray-900 dark:text-gray-100">
                    {golfer.memberSince
                      ? new Date(golfer.memberSince).toLocaleDateString('en-GB', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })
                      : 'N/A'}
                  </span>

                  <span className="font-medium text-gray-600 dark:text-gray-400">State:</span>
                  <span className="text-gray-900 dark:text-gray-100">{golfer.state?.shortName ?? 'N/A'}</span>

                  <span className="font-medium text-gray-600 dark:text-gray-400">Gender:</span>
                  <span className="text-gray-900 dark:text-gray-100">
                    {golfer.gender === 'm' || golfer.gender === 'M'
                      ? 'Male'
                      : golfer.gender === 'f' || golfer.gender === 'F'
                        ? 'Female'
                        : golfer.gender ?? 'N/A'}
                  </span>
                </div>
              </div>
              <div className="text-left sm:text-right">
                <p className="text-sm text-gray-500 dark:text-gray-400">Token Balance</p>
                <p className="text-3xl font-bold text-green-600 dark:text-green-400">
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
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
            <div className="px-4 sm:px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Transaction History</h2>
            </div>
            {transactionsLoading ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">Loading transactions...</div>
            ) : (
              <TransactionTable transactions={transactions} />
            )}
          </div>

          {canViewRounds && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden mt-6">
              <div className="px-4 sm:px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Rounds History</h2>
              </div>
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
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
