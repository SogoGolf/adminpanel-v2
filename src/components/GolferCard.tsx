import type { Golfer } from '../types';

interface GolferCardProps {
  golfer: Golfer;
  tokenBalance: number;
  onTokensClick: () => void;
}

export function GolferCard({ golfer, tokenBalance, onTokensClick }: GolferCardProps) {
  return (
    <div className="bg-white rounded-lg shadow-md p-6 max-w-xl">
      <h2 className="text-xl font-semibold mb-4">Golfer Details</h2>

      <div className="grid grid-cols-[140px_1fr] gap-2 text-sm">
        <span className="font-medium text-gray-600">Name:</span>
        <span>{golfer.firstName} {golfer.lastName}</span>

        <span className="font-medium text-gray-600">Email:</span>
        <span>{golfer.email}</span>

        <span className="font-medium text-gray-600">GolfLink #:</span>
        <span>{golfer.golflinkNo}</span>

        <span className="font-medium text-gray-600">Token Balance:</span>
        <span className="font-semibold text-green-600">{tokenBalance}</span>

        <span className="font-medium text-gray-600">Member Since:</span>
        <span>{golfer.memberSince ?? 'N/A'}</span>

        <span className="font-medium text-gray-600">State:</span>
        <span>{golfer.state?.shortName ?? 'N/A'}</span>

        <span className="font-medium text-gray-600">Gender:</span>
        <span>{golfer.gender ?? 'N/A'}</span>
      </div>

      <div className="mt-6 flex gap-3">
        <button
          onClick={onTokensClick}
          className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
        >
          Manage Tokens
        </button>
      </div>
    </div>
  );
}
