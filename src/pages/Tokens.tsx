import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { v4 as uuidv4 } from 'uuid';
import {
  getGolferById,
  getTransactionsForGolfer,
  getTransactionTypes,
  addTransaction,
} from '../api/cosmosdb';
import { TransactionTable } from '../components/TransactionTable';
import { AddTokensDialog } from '../components/AddTokensDialog';
import type { Transaction } from '../types';

export function Tokens() {
  const { golferId } = useParams<{ golferId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);

  // Fetch golfer
  const { data: golfer, isLoading: golferLoading } = useQuery({
    queryKey: ['golfer', golferId],
    queryFn: () => getGolferById(golferId!),
    enabled: !!golferId,
  });

  // Fetch transactions
  const { data: transactions = [], isLoading: transactionsLoading } = useQuery({
    queryKey: ['transactions', golferId],
    queryFn: () => getTransactionsForGolfer(golferId!),
    enabled: !!golferId,
  });

  // Fetch transaction types
  const { data: transactionTypes = [] } = useQuery({
    queryKey: ['transactionTypes'],
    queryFn: getTransactionTypes,
  });

  // Add transaction mutation
  const addTransactionMutation = useMutation({
    mutationFn: addTransaction,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions', golferId] });
      queryClient.invalidateQueries({ queryKey: ['golfer', golferId] });
      setDialogOpen(false);
    },
  });

  // Calculate current balance from most recent transaction
  const currentBalance = transactions.length > 0
    ? transactions[0].availableTokens
    : golfer?.tokenBalance ?? 0;

  const handleAddTokens = (transactionTypeId: string, amount: number) => {
    if (!golfer) return;

    const transactionType = transactionTypes.find((t) => t.id === transactionTypeId);
    if (!transactionType) return;

    // Calculate new balance
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

    addTransactionMutation.mutate(transaction);
  };

  if (golferLoading) {
    return <div className="text-center py-8">Loading golfer...</div>;
  }

  if (!golfer) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-600 mb-4">Golfer not found</p>
        <button
          onClick={() => navigate('/')}
          className="text-blue-600 hover:underline"
        >
          Back to Lookup
        </button>
      </div>
    );
  }

  return (
    <div>
      <button
        onClick={() => navigate('/')}
        className="text-blue-600 hover:underline mb-4 inline-block"
      >
        &larr; Back to Lookup
      </button>

      <h1 className="text-2xl font-bold mb-2">Token Management</h1>

      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-lg font-semibold">
              {golfer.firstName} {golfer.lastName}
            </h2>
            <p className="text-gray-600">{golfer.email}</p>
            <p className="text-gray-600">GolfLink: {golfer.golflinkNo}</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-500">Current Balance</p>
            <p className="text-3xl font-bold text-green-600">{currentBalance}</p>
          </div>
        </div>

        <div className="mt-4">
          <button
            onClick={() => setDialogOpen(true)}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
          >
            Add Tokens
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold">Transaction History</h2>
        </div>
        {transactionsLoading ? (
          <div className="text-center py-8 text-gray-500">Loading transactions...</div>
        ) : (
          <TransactionTable transactions={transactions} />
        )}
      </div>

      <AddTokensDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSave={handleAddTokens}
        transactionTypes={transactionTypes}
        saving={addTransactionMutation.isPending}
      />
    </div>
  );
}
