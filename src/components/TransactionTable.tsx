import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';
import type { Transaction } from '../types';

const columnHelper = createColumnHelper<Transaction>();

const columns = [
  columnHelper.accessor('transactionDate', {
    header: 'Date',
    cell: (info) => {
      const date = new Date(info.getValue());
      return date.toLocaleDateString('en-AU', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    },
  }),
  columnHelper.accessor('transactionType.name', {
    header: 'Type',
  }),
  columnHelper.accessor('transactionValue', {
    header: 'Amount',
    cell: (info) => {
      const type = info.row.original.transactionType.debitOrCredit;
      const value = info.getValue();
      return (
        <span className={type === 'credit' ? 'text-green-600' : 'text-red-600'}>
          {type === 'credit' ? '+' : '-'}{value}
        </span>
      );
    },
  }),
  columnHelper.accessor('availableTokens', {
    header: 'Balance',
  }),
  columnHelper.accessor('transactionType.shortDescription', {
    header: 'Description',
  }),
];

interface TransactionTableProps {
  transactions: Transaction[];
}

export function TransactionTable({ transactions }: TransactionTableProps) {
  const table = useReactTable({
    data: transactions,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        <thead className="bg-gray-50 dark:bg-gray-700">
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th
                  key={header.id}
                  className="px-2 sm:px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap"
                >
                  {header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext())}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
          {table.getRowModel().rows.map((row) => (
            <tr key={row.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id} className="px-2 sm:px-4 py-3 text-sm text-gray-900 dark:text-gray-100 whitespace-nowrap">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {transactions.length === 0 && (
        <p className="text-center text-gray-500 dark:text-gray-400 py-8">No transactions found</p>
      )}
    </div>
  );
}
