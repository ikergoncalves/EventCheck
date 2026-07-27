import type { EventStatus } from '../api/types'

const STYLES: Record<EventStatus, string> = {
  draft: 'bg-slate-100 text-slate-700 ring-slate-200',
  published: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  finished: 'bg-blue-50 text-blue-700 ring-blue-200',
  cancelled: 'bg-rose-50 text-rose-700 ring-rose-200',
}

const LABELS: Record<EventStatus, string> = {
  draft: 'Draft',
  published: 'Published',
  finished: 'Finished',
  cancelled: 'Cancelled',
}

export function StatusBadge({ status }: { status: EventStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${STYLES[status]}`}
    >
      {LABELS[status]}
    </span>
  )
}
