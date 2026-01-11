import { useState, useMemo } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { auditService } from '../services';
import type { AuditAction, AuditLog as AuditLogType } from '../types';

const actionOptions: { value: AuditAction | ''; label: string }[] = [
  { value: '', label: 'All Actions' },
  { value: 'ADMIN_CREDIT', label: 'Token Credit' },
  { value: 'ADMIN_DEBIT', label: 'Token Debit' },
  { value: 'NOTIFICATION_SENT', label: 'Notification Sent' },
  { value: 'ADMIN_USER_CREATED', label: 'Admin User Created' },
  { value: 'ADMIN_USER_UPDATED', label: 'Admin User Updated' },
];

function ActionBadge({ action }: { action: AuditAction }) {
  const styles: Record<AuditAction, string> = {
    ADMIN_CREDIT: 'bg-green-100 text-green-800',
    ADMIN_DEBIT: 'bg-red-100 text-red-800',
    NOTIFICATION_SENT: 'bg-blue-100 text-blue-800',
    ADMIN_USER_CREATED: 'bg-purple-100 text-purple-800',
    ADMIN_USER_UPDATED: 'bg-yellow-100 text-yellow-800',
  };

  const labels: Record<AuditAction, string> = {
    ADMIN_CREDIT: 'Token Credit',
    ADMIN_DEBIT: 'Token Debit',
    NOTIFICATION_SENT: 'Notification',
    ADMIN_USER_CREATED: 'User Created',
    ADMIN_USER_UPDATED: 'User Updated',
  };

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${styles[action]}`}>
      {labels[action]}
    </span>
  );
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-AU', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleTimeString('en-AU', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDetails(log: AuditLogType): string {
  const details = log.details;
  if (log.action === 'ADMIN_CREDIT' || log.action === 'ADMIN_DEBIT') {
    const amount = details.amount as number;
    const newBalance = details.newBalance as number;
    return `${amount} tokens (new balance: ${newBalance})`;
  }
  return JSON.stringify(details);
}

// Mobile card component
function AuditLogCard({ log }: { log: AuditLogType }) {
  return (
    <div className="bg-white rounded-lg shadow p-4 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <ActionBadge action={log.action} />
        <span className="text-sm text-gray-500">
          {formatDate(log.timestamp)} {formatTime(log.timestamp)}
        </span>
      </div>
      <div className="text-sm">
        <span className="text-gray-500">By: </span>
        <span className="font-medium">{log.performedBy.name}</span>
        <span className="text-gray-400 text-xs ml-1">({log.performedBy.email})</span>
      </div>
      {log.target && (
        <div className="text-sm">
          <span className="text-gray-500">Target: </span>
          <span className="font-medium">{log.target.name}</span>
          {log.target.email && (
            <span className="text-gray-400 text-xs ml-1">({log.target.email})</span>
          )}
        </div>
      )}
      <div className="text-sm">
        <span className="text-gray-500">Details: </span>
        <span>{formatDetails(log)}</span>
      </div>
    </div>
  );
}

export function AuditLog() {
  const pageSize = 20;
  const [page, setPage] = useState(1);
  const [actionFilter, setActionFilter] = useState<AuditAction | ''>('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const queryParams = useMemo(() => ({
    page,
    pageSize,
    action: actionFilter || undefined,
    fromDate: fromDate || undefined,
    toDate: toDate ? `${toDate}T23:59:59.999Z` : undefined,
  }), [page, pageSize, actionFilter, fromDate, toDate]);

  const { data, isLoading, isFetching, isError, error } = useQuery({
    queryKey: ['auditLogs', queryParams],
    queryFn: () => auditService.getAll(queryParams),
    placeholderData: keepPreviousData,
    refetchOnMount: 'always',
    staleTime: 0,
  });

  const clearFilters = () => {
    setActionFilter('');
    setFromDate('');
    setToDate('');
    setPage(1);
  };

  const hasActiveFilters = actionFilter || fromDate || toDate;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Audit Log</h1>
        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="px-3 py-1 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Action</label>
            <select
              value={actionFilter}
              onChange={(e) => {
                setActionFilter(e.target.value as AuditAction | '');
                setPage(1);
              }}
              className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {actionOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">From Date</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => {
                setFromDate(e.target.value);
                setPage(1);
              }}
              className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">To Date</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => {
                setToDate(e.target.value);
                setPage(1);
              }}
              className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {isLoading && !data && (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      )}

      {isError && !data && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-700">
            Error loading audit logs: {error instanceof Error ? error.message : 'Unknown error'}
          </p>
        </div>
      )}

      {data && (
        <>
          <div className="text-sm text-gray-600 flex items-center gap-2">
            <span>
              Showing {data.data.length} of {data.totalCount.toLocaleString()} entries
              {hasActiveFilters && <span className="ml-1 text-blue-600">(filtered)</span>}
            </span>
            {isFetching && (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
            )}
          </div>

          {data.data.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
              No audit log entries found.
            </div>
          ) : (
            <>
              {/* Mobile card view */}
              <div className="lg:hidden space-y-3 relative">
                {isFetching && (
                  <div className="absolute inset-0 bg-white/60 flex items-center justify-center z-10 rounded-lg">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
                  </div>
                )}
                {data.data.map((log) => (
                  <AuditLogCard key={log.id} log={log} />
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
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Date/Time
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Action
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Performed By
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Target
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Details
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {data.data.map((log) => (
                        <tr key={log.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                            <div>{formatDate(log.timestamp)}</div>
                            <div className="text-xs text-gray-500">{formatTime(log.timestamp)}</div>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <ActionBadge action={log.action} />
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm">
                            <div className="font-medium text-gray-900">{log.performedBy.name}</div>
                            <div className="text-xs text-gray-500">{log.performedBy.email}</div>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm">
                            {log.target ? (
                              <>
                                <div className="font-medium text-gray-900">{log.target.name}</div>
                                {log.target.email && (
                                  <div className="text-xs text-gray-500">{log.target.email}</div>
                                )}
                              </>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900">
                            {formatDetails(log)}
                          </td>
                        </tr>
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
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
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
        </>
      )}
    </div>
  );
}
