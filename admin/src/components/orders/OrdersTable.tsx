'use client';

import type { Column } from '@/components/ui/DataTable';
import { formatTenge } from '@/lib/money';
import OrderRowActions from './OrderRowActions';
import { statusBadge, statusLabel, type OrderStatus } from './orderStatus';

export type OrderRow = {
  id: number;
  number: string | null;
  status: OrderStatus;
  total: number | null;
  created_at: string | null;
  user: { id: number; name: string | null; phone: string | null; email: string | null; type: string | null } | null;
};

const date = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('ru-KZ', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';

export function orderColumns(onChanged: () => void): Column<OrderRow>[] {
  return [
    {
      key: 'id',
      header: '#',
      render: (row) => (
        <div>
          <div className="font-medium text-zinc-800">#{row.id}</div>
          {row.number && <div className="text-xs text-zinc-400">{row.number}</div>}
        </div>
      ),
    },
    {
      key: 'client',
      header: 'Клиент',
      render: (row) =>
        row.user ? (
          <div>
            <div className="font-medium text-zinc-900">{row.user.name || '—'}</div>
            <div className="text-xs text-zinc-500">{row.user.phone || row.user.email || '—'}</div>
          </div>
        ) : (
          <span className="text-xs italic text-zinc-400">Без клиента</span>
        ),
    },
    {
      key: 'segment',
      header: 'Сегмент',
      render: (row) => (
        <span
          className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${
            row.user?.type === 'b2b'
              ? 'border-sky-200 bg-sky-50 text-sky-700'
              : 'border-zinc-200 bg-zinc-50 text-zinc-600'
          }`}
        >
          {row.user?.type === 'b2b' ? 'B2B' : 'Розница'}
        </span>
      ),
    },
    {
      key: 'total',
      header: 'Сумма',
      className: 'tabular-nums',
      render: (row) => formatTenge(row.total),
    },
    {
      key: 'status',
      header: 'Статус',
      render: (row) => (
        <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${statusBadge(row.status)}`}>
          {statusLabel(row.status)}
        </span>
      ),
    },
    {
      key: 'created_at',
      header: 'Дата',
      className: 'whitespace-nowrap text-zinc-500',
      render: (row) => date(row.created_at),
    },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      render: (row) => <OrderRowActions orderId={row.id} status={row.status} onChanged={onChanged} />,
    },
  ];
}
