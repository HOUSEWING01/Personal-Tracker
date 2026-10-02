import { supabase } from '../lib/supabase'
import { fromPaise, toPaise } from '../lib/money'
import type { GoldLoan, GoldLoanPayment, GoldLoanStatus } from '../types/gold'
import { searchTerm, type PageOpts, type Paged } from './transportService'

type Num = number | string

interface LoanRow {
  id: string; person_name: string; mobile: string | null; gold_description: string; gold_weight_grams: Num | null; bank: string
  pledge_date: string; due_date: string | null; principal: Num; annual_rate: Num; status: GoldLoanStatus
  closed_date: string | null; notes: string | null
}
interface TotalsRow { loan_id: string; paid_total: Num; payment_count: Num; last_payment_date: string | null }

const toLoan = (r: LoanRow, t?: TotalsRow): GoldLoan => ({
  id: r.id, personName: r.person_name, mobile: r.mobile, goldDescription: r.gold_description,
  goldWeightGrams: r.gold_weight_grams === null ? null : Number(r.gold_weight_grams), bank: r.bank,
  pledgeDate: r.pledge_date, dueDate: r.due_date, principalPaise: toPaise(r.principal), annualRate: Number(r.annual_rate),
  status: r.status, closedDate: r.closed_date, notes: r.notes,
  paidPaise: t ? toPaise(t.paid_total) : 0, paymentCount: t ? Number(t.payment_count) : 0, lastPaymentDate: t?.last_payment_date ?? null,
})

const range = (o: PageOpts): [number, number] => [(o.page - 1) * o.pageSize, o.page * o.pageSize - 1]

export interface GoldLoanFilters { status?: GoldLoanStatus; q?: string }
export async function listGoldLoans(f: GoldLoanFilters, o: PageOpts): Promise<Paged<GoldLoan>> {
  let query = supabase.from('gold_loans').select('*', { count: 'exact' })
  if (f.status) query = query.eq('status', f.status)
  const q = searchTerm(f.q ?? '')
  if (q) query = query.or(['person_name', 'bank', 'gold_description', 'mobile', 'notes'].map((c) => `${c}.ilike.%${q}%`).join(','))
  const { data, error, count } = await query
    .order('pledge_date', { ascending: false }).order('created_at', { ascending: false }).range(...range(o))
  if (error) throw error
  const rows = data as unknown as LoanRow[]

  const totals = new Map<string, TotalsRow>()
  if (rows.length > 0) {
    const t = await supabase.from('gold_loan_payment_totals').select('loan_id, paid_total, payment_count, last_payment_date').in('loan_id', rows.map((r) => r.id))
    if (t.error) throw t.error
    for (const r of t.data as TotalsRow[]) totals.set(r.loan_id, r)
  }
  return { rows: rows.map((r) => toLoan(r, totals.get(r.id))), total: count ?? 0 }
}

export interface GoldLoanInput {
  personName: string; mobile: string | null; goldDescription: string; goldWeightGrams: number | null; bank: string
  pledgeDate: string; dueDate: string | null; principalPaise: number; annualRate: number
  status: GoldLoanStatus; closedDate: string | null; notes: string | null
}
/** Creates (no id) or edits a gold loan; the database function keeps the loan's `loan_received` ledger entry in step (D-024, migration 0011). */
export async function saveGoldLoan(id: string | undefined, l: GoldLoanInput): Promise<string> {
  const { data, error } = await supabase.rpc('save_gold_loan', {
    p_person_name: l.personName, p_mobile: l.mobile, p_gold_description: l.goldDescription, p_gold_weight_grams: l.goldWeightGrams,
    p_bank: l.bank, p_pledge_date: l.pledgeDate, p_due_date: l.dueDate, p_principal: fromPaise(l.principalPaise),
    p_annual_rate: l.annualRate, p_status: l.status, p_closed_date: l.closedDate, p_notes: l.notes, p_id: id ?? null,
  })
  if (error) throw error
  return data as string
}

interface PaymentRow { id: string; loan_id: string; payment_date: string; amount: Num; notes: string | null }
const toPayment = (r: PaymentRow): GoldLoanPayment => ({
  id: r.id, loanId: r.loan_id, paymentDate: r.payment_date, amountPaise: toPaise(r.amount), notes: r.notes,
})

/** Every payment of one loan, newest first. */
export async function listGoldLoanPayments(loanId: string): Promise<GoldLoanPayment[]> {
  const { data, error } = await supabase.from('gold_loan_payments').select('*').eq('loan_id', loanId)
    .order('payment_date', { ascending: false }).order('created_at', { ascending: false }).limit(1000)
  if (error) throw error
  return (data as PaymentRow[]).map(toPayment)
}

export interface GoldLoanPaymentInput { paymentDate: string; amountPaise: number; notes: string | null }
/** Records (no id) or edits a repayment; the full amount posts to the ledger as one `loan_repayment` (D-009). */
export async function saveGoldLoanPayment(loanId: string, id: string | undefined, p: GoldLoanPaymentInput): Promise<string> {
  const { data, error } = await supabase.rpc('save_gold_loan_payment', {
    p_loan_id: loanId, p_payment_date: p.paymentDate, p_amount: fromPaise(p.amountPaise), p_notes: p.notes, p_id: id ?? null,
  })
  if (error) throw error
  return data as string
}

/** Every Active gold loan with its repayment totals, for the Dashboard (a bank-pledge book is small; capped at 500). */
export async function listActiveGoldLoans(): Promise<GoldLoan[]> {
  const { data, error } = await supabase.from('gold_loans').select('*').eq('status', 'active')
    .order('due_date', { ascending: true, nullsFirst: false }).limit(500)
  if (error) throw error
  const rows = data as unknown as LoanRow[]
  const totals = new Map<string, TotalsRow>()
  if (rows.length > 0) {
    const t = await supabase.from('gold_loan_payment_totals').select('loan_id, paid_total, payment_count, last_payment_date').in('loan_id', rows.map((r) => r.id))
    if (t.error) throw t.error
    for (const r of t.data as TotalsRow[]) totals.set(r.loan_id, r)
  }
  return rows.map((r) => toLoan(r, totals.get(r.id)))
}
