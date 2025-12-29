import { useState, useMemo, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  createColumnHelper,
} from '@tanstack/react-table';
import { getAllGolfers, getClubs } from '../api/mongodb';
import type { Golfer } from '../types';

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

const columnHelper = createColumnHelper<Golfer>();

const stateOptions = ['NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'NT', 'ACT'];

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
  options?: string[];
  inputRef?: React.RefObject<HTMLInputElement | null>;
}) {
  if (type === 'select' && options) {
    return (
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
      >
        <option value="">All</option>
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
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

const STORAGE_KEY = 'golfers-filters';

function getInitialFilters(): ColumnFiltersState {
  // Try sessionStorage for filters only
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

export function Golfers() {
  const pageSize = 20;

  // Initialize state - filters from sessionStorage, page always starts at 1
  const [page, setPage] = useState(1);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>(getInitialFilters);

  // Track focused filter to restore after re-render
  const focusedFilterRef = useRef<string | null>(null);
  const filterRefs = {
    firstName: useRef<HTMLInputElement>(null),
    lastName: useRef<HTMLInputElement>(null),
    email: useRef<HTMLInputElement>(null),
    golflinkNo: useRef<HTMLInputElement>(null),
    clubName: useRef<HTMLInputElement>(null),
  };

  // Debounce the filters - wait 700ms after user stops typing
  const debouncedFilters = useDebounce(columnFilters, 700);

  // Convert debounced column filters to API params
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
    queryKey: ['golfers', page, pageSize, filterParams],
    queryFn: () => getAllGolfers({ page, pageSize, ...filterParams }),
    placeholderData: keepPreviousData,
  });

  // Fetch clubs for lookup
  const { data: clubs } = useQuery({
    queryKey: ['clubs'],
    queryFn: getClubs,
    staleTime: 1000 * 60 * 60, // Cache for 1 hour
  });

  // Create club lookup map (glClubId -> club name)
  const clubLookup = useMemo(() => {
    const lookup = new Map<number, string>();
    if (clubs) {
      clubs.forEach((club) => {
        if (club.glClubId) {
          lookup.set(club.glClubId, club.name || 'Unknown');
        }
      });
    }
    return lookup;
  }, [clubs]);

  // Get club name from golflinkNo (first 5 digits = glClubId)
  const getClubName = (golflinkNo?: string): string => {
    if (!golflinkNo || golflinkNo.length < 5) return '-';
    const glClubId = parseInt(golflinkNo.substring(0, 5), 10);
    return clubLookup.get(glClubId) || '-';
  };

  // Reset to page 1 when debounced filters change
  useEffect(() => {
    setPage(1);
  }, [debouncedFilters]);

  // Save filters to sessionStorage (not page - page always resets to 1)
  useEffect(() => {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ filters: columnFilters }));
  }, [columnFilters]);

  // Restore focus after data loads
  useEffect(() => {
    if (focusedFilterRef.current && filterRefs[focusedFilterRef.current as keyof typeof filterRefs]) {
      const input = filterRefs[focusedFilterRef.current as keyof typeof filterRefs].current;
      if (input) {
        input.focus();
        // Move cursor to end
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

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    try {
      return new Date(dateString).toLocaleDateString();
    } catch {
      return '-';
    }
  };

  const columns = useMemo(
    () => [
      columnHelper.display({
        id: 'actions',
        header: '',
        cell: (info) => (
          <Link
            to={`/golfers/${info.row.original.golflinkNo}`}
            className="text-blue-600 hover:text-blue-800 hover:underline text-sm font-medium"
          >
            Info
          </Link>
        ),
      }),
      columnHelper.accessor('firstName', {
        header: 'First Name',
        cell: (info) => info.getValue() || '-',
      }),
      columnHelper.accessor('lastName', {
        header: 'Last Name',
        cell: (info) => info.getValue() || '-',
      }),
      columnHelper.accessor('email', {
        header: 'Email',
        cell: (info) => info.getValue() || '-',
      }),
      columnHelper.accessor('golflinkNo', {
        header: 'GA Number',
        cell: (info) => (
          <span className="font-mono">{info.getValue() || '-'}</span>
        ),
      }),
      columnHelper.accessor((row) => row.golflinkNo, {
        id: 'club',
        header: 'Club',
        cell: (info) => getClubName(info.getValue()),
      }),
      columnHelper.accessor('tokenBalance', {
        header: 'Tokens',
        cell: (info) => {
          const balance = info.getValue();
          return (
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                balance > 0 ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
              }`}
            >
              {balance}
            </span>
          );
        },
      }),
      columnHelper.accessor((row) => row.state?.shortName, {
        id: 'state',
        header: 'State',
        cell: (info) => info.getValue()?.toUpperCase() || '-',
      }),
      columnHelper.accessor('roundCount' as keyof Golfer, {
        id: 'roundCount',
        header: 'Submitted Rounds',
        cell: (info) => {
          const count = info.getValue() as number | undefined;
          return count ?? 0;
        },
      }),
      columnHelper.accessor('memberSince', {
        header: 'Member Since',
        cell: (info) => formatDate(info.getValue()),
      }),
    ],
    [clubLookup]
  );

  const table = useReactTable({
    data: data?.data ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualFiltering: true, // Server-side filtering
    manualPagination: true, // Server-side pagination
    state: {
      columnFilters,
    },
    onColumnFiltersChange: setColumnFilters,
  });

  const hasActiveFilters = columnFilters.length > 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Golfers</h1>
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
            Error loading golfers: {error instanceof Error ? error.message : 'Unknown error'}
          </p>
        </div>
      )}

      {data && (
        <>
          <div className="text-sm text-gray-600 flex items-center gap-2">
            <span>
              Showing {data.data.length} of {data.totalCount.toLocaleString()} golfers
              {hasActiveFilters && <span className="ml-1 text-blue-600">(filtered)</span>}
            </span>
            {isFetching && (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
            )}
          </div>

          <div className={`bg-white rounded-lg shadow overflow-hidden transition-opacity ${isFetching ? 'opacity-70' : ''}`}>
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
                      <ColumnFilter
                        columnId="firstName"
                        value={getFilterValue('firstName')}
                        onChange={(v) => handleFilterChange('firstName', v)}
                        placeholder="Filter..."
                        inputRef={filterRefs.firstName}
                      />
                    </th>
                    <th className="px-4 py-2">
                      <ColumnFilter
                        columnId="lastName"
                        value={getFilterValue('lastName')}
                        onChange={(v) => handleFilterChange('lastName', v)}
                        placeholder="Filter..."
                        inputRef={filterRefs.lastName}
                      />
                    </th>
                    <th className="px-4 py-2">
                      <ColumnFilter
                        columnId="email"
                        value={getFilterValue('email')}
                        onChange={(v) => handleFilterChange('email', v)}
                        placeholder="Filter..."
                        inputRef={filterRefs.email}
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
                      {/* No filter for tokens */}
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
                      {/* No filter for rounds */}
                    </th>
                    <th className="px-4 py-2">
                      {/* No filter for member since */}
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {table.getRowModel().rows.map((row) => (
                    <tr key={row.id} className="hover:bg-gray-50">
                      {row.getVisibleCells().map((cell) => (
                        <td key={cell.id} className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
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
