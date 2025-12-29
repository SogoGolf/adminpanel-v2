import { v4 as uuidv4 } from 'uuid';
import { api } from '../api';
import type { Golfer, Transaction, TransactionType } from '../types';

export const transactionService = {
  async getForGolfer(golferId: string): Promise<Transaction[]> {
    return api.transactions.getForGolfer(golferId);
  },

  async getTypes(): Promise<TransactionType[]> {
    return api.transactions.getTypes();
  },

  async getAdminTypes(): Promise<TransactionType[]> {
    const types = await api.transactions.getTypes();
    return types.filter(t => t.name === 'Admin Credit' || t.name === 'Admin Debit');
  },

  /**
   * Calculate the current balance from the latest transaction,
   * falling back to golfer's tokenBalance if no transactions exist.
   */
  getCurrentBalance(transactions: Transaction[], golfer: Golfer): number {
    if (transactions.length > 0) {
      return transactions[0].availableTokens;
    }
    return golfer.tokenBalance ?? 0;
  },

  /**
   * Create and add a new transaction for a golfer.
   */
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

    return api.transactions.add(transaction);
  },
};
