import { formatDate } from '../../lib/dates'
import { formatSignedINR } from '../../lib/money'
import type { Transaction } from '../../types/finance'
import { CASH_DIRECTION, signedCashAmount } from './financeEngine'
import { MODULE_LABELS, TYPE_LABELS } from './labels'

function TypeBadge({ type }: { type: Transaction['type'] }) {
  const dir = CASH_DIRECTION[type]
  const cls = dir === 'in' ? 'bg-sage-soft text-primary' : dir === 'signed' ? 'bg-gold-soft text-primary' : 'bg-canvas text-muted'
  return <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${cls}`}>{TYPE_LABELS[type]}</span>
}

export function TransactionList({ rows }: { rows: Transaction[] }) {
  return (
    <>
      <div className="hidden overflow-x-auto rounded-md border border-line bg-surface md:block">
        <table className="w-full text-sm">
          <thead className="border-b border-line text-left text-xs text-muted">
            <tr>
              <th scope="col" className="px-4 py-2 font-medium">Date</th>
              <th scope="col" className="px-4 py-2 font-medium">Type</th>
              <th scope="col" className="px-4 py-2 font-medium">Module</th>
              <th scope="col" className="px-4 py-2 font-medium">Description</th>
              <th scope="col" className="px-4 py-2 text-right font-medium">Amount</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-line last:border-0">
                <td className="whitespace-nowrap px-4 py-2.5">{formatDate(r.date)}</td>
                <td className="px-4 py-2.5"><TypeBadge type={r.type} /></td>
                <td className="px-4 py-2.5 text-muted">{MODULE_LABELS[r.module]}</td>
                <td className="max-w-xs truncate px-4 py-2.5" title={r.description ?? ''}>{r.description ?? '—'}</td>
                <td className="whitespace-nowrap px-4 py-2.5 text-right font-medium tabular-nums">{formatSignedINR(signedCashAmount(r))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="flex flex-col gap-2 md:hidden">
        {rows.map((r) => (
          <li key={r.id} className="rounded-md border border-line bg-surface px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <TypeBadge type={r.type} />
              <span className="font-semibold tabular-nums">{formatSignedINR(signedCashAmount(r))}</span>
            </div>
            <p className="mt-2 text-sm">{r.description ?? '—'}</p>
            <p className="mt-1 text-xs text-muted">{formatDate(r.date)} · {MODULE_LABELS[r.module]}</p>
          </li>
        ))}
      </ul>
    </>
  )
}
