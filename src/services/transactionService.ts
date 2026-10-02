import { supabase } from '../lib/supabase'
import { toPaise, fromPaise } from '../lib/money'
import type { BusinessModule, Transaction, TransactionType } from '../types/finance'
import type { TotalsByType } from '../features/finance/financeEngine'

interface TxRow {
  id: string
  type: TransactionType
  amount: number | string
  module: BusinessModule
  entity_type: string | null
  entity_id: string | null
  transaction_date: string
  payment_method: string | null
  description: string | null
  created_at: string
}

const toDomain = (r: TxRow): Transaction => ({
  id: r.id, type: r.type, amountPaise: toPaise(r.amount), module: r.module,
  entityType: r.entity_type, entityId: r.entity_id, date: r.transaction_date,
  paymentMethod: r.payment_method, description: r.description, createdAt: r.created_at,
})

export interface TransactionFilters {
  type?: TransactionType
  module?: BusinessModule
  from?: string
  to?: string
  q?: string
}
export type TransactionSort = 'newest' | 'oldest'

export async function listTransactions(
  f: TransactionFilters,
  opts: { page: number; pageSize: number; sort: TransactionSort },
): Promise<{ rows: Transaction[]; total: number }> {
  let query = supabase.from('transactions').select('*', { count: 'exact' })
  if (f.type) query = query.eq('type', f.type)
  if (f.module) query = query.eq('module', f.module)
  if (f.from) query = query.gte('transaction_date', f.from)
  if (f.to) query = query.lte('transaction_date', f.to)
  if (f.q?.trim()) query = query.ilike('description', `%${f.q.trim().replace(/[\\%_]/g, (m) => `\\${m}`)}%`)
  const asc = opts.sort === 'oldest'
  const start = (opts.page - 1) * opts.pageSize
  const { data, error, count } = await query
    .order('transaction_date', { ascending: asc })
    .order('created_at', { ascending: asc })
    .range(start, start + opts.pageSize - 1)
  if (error) throw error
  return { rows: (data as TxRow[]).map(toDomain), total: count ?? 0 }
}

/** Per-type totals computed in the database; formulas are applied by financeEngine. */
export async function getTotalsByType(f: Pick<TransactionFilters, 'from' | 'to' | 'module'>): Promise<TotalsByType> {
  const { data, error } = await supabase.rpc('transaction_totals', {
    p_from: f.from ?? null, p_to: f.to ?? null, p_module: f.module ?? null,
  })
  if (error) throw error
  const totals: TotalsByType = {}
  for (const row of (data ?? []) as { type: TransactionType; total: number | string }[]) totals[row.type] = toPaise(row.total)
  return totals
}

// Used by Phase 4+ modules to post to the ledger (validated again by DB constraints).
export interface NewTransaction {
  type: TransactionType
  amountPaise: number
  module: BusinessModule
  date: string
  entityType?: string
  entityId?: string
  paymentMethod?: string
  description?: string
}
export async function createTransaction(t: NewTransaction): Promise<Transaction> {
  const { data, error } = await supabase.from('transactions').insert({
    type: t.type, amount: fromPaise(t.amountPaise), module: t.module, transaction_date: t.date,
    entity_type: t.entityType ?? null, entity_id: t.entityId ?? null,
    payment_method: t.paymentMethod ?? null, description: t.description ?? null,
  }).select().single()
  if (error) throw error
  return toDomain(data as TxRow)
}
