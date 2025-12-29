import { useState } from 'react';
import type { TransactionType } from '../types';

interface AddTokensDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (transactionTypeId: string, amount: number) => void;
  transactionTypes: TransactionType[];
  saving: boolean;
}

export function AddTokensDialog({
  open,
  onClose,
  onSave,
  transactionTypes,
  saving,
}: AddTokensDialogProps) {
  const [transactionTypeId, setTransactionTypeId] = useState('');
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!transactionTypeId) {
      setError('Please select a transaction type');
      return;
    }

    const numAmount = parseInt(amount, 10);
    if (isNaN(numAmount) || numAmount <= 0) {
      setError('Please enter a valid amount greater than 0');
      return;
    }

    onSave(transactionTypeId, numAmount);
  };

  const handleClose = () => {
    setTransactionTypeId('');
    setAmount('');
    setError('');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
        <h2 className="text-xl font-semibold mb-4">Add Tokens</h2>

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Transaction Type
            </label>
            <select
              value={transactionTypeId}
              onChange={(e) => setTransactionTypeId(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={saving}
            >
              <option value="">Select a type...</option>
              {transactionTypes.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.name} ({type.debitOrCredit})
                </option>
              ))}
            </select>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Amount
            </label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Enter amount"
              min="1"
              className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={saving}
            />
          </div>

          {error && (
            <p className="text-red-600 text-sm mb-4">{error}</p>
          )}

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50 transition-colors"
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors disabled:opacity-50"
              disabled={saving}
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
