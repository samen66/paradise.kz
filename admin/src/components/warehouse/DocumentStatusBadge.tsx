import type { DocumentStatus } from '@/lib/warehouse';

export default function DocumentStatusBadge({ status, postedLabel }: { status: DocumentStatus; postedLabel: string }) {
  return status === 'posted' ? (
    <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">{postedLabel}</span>
  ) : (
    <span className="inline-flex items-center rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700">Черновик</span>
  );
}
