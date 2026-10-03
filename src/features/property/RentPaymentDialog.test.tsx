// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RentPaymentDialog } from './RentPaymentDialog'

const recordRentPayment = vi.fn()
vi.mock('../../services/propertyService', () => ({ recordRentPayment: (...a: unknown[]) => recordRentPayment(...a) }))

function setup(outstandingPaise = 1_000_000) {
  const onSaved = vi.fn(), onClose = vi.fn()
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { mutations: { retry: false } } })}>
      <RentPaymentDialog open propertyId="prop-1" period="2026-09-01" outstandingPaise={outstandingPaise} onClose={onClose} onSaved={onSaved} />
    </QueryClientProvider>,
  )
  return { onSaved, onClose, user: userEvent.setup() }
}
afterEach(() => { cleanup(); recordRentPayment.mockReset() })

describe('RentPaymentDialog', () => {
  it('is a labelled dialog, shows the outstanding for the month and prefills the amount', () => {
    setup()
    expect(screen.getByRole('dialog', { name: 'Record rent payment' })).toBeTruthy()
    expect(screen.getByText(/Outstanding for 1 Sep\w* – 30 Sep\w* 2026/)).toBeTruthy()
    expect((screen.getByLabelText('Amount (₹)') as HTMLInputElement).value).toBe('10000.00')
    expect(document.activeElement).toBe(screen.getByLabelText('Amount (₹)'))
  })

  it('submits integer paise for the right property and month', async () => {
    recordRentPayment.mockResolvedValue('pay-1')
    const { user, onSaved } = setup()
    const amount = screen.getByLabelText('Amount (₹)')
    await user.clear(amount)
    await user.type(amount, '6000.50')
    await user.click(screen.getByRole('button', { name: 'Record payment' }))
    await waitFor(() => expect(onSaved).toHaveBeenCalled())
    expect(recordRentPayment).toHaveBeenCalledWith('prop-1', '2026-09-01', expect.objectContaining({ amountPaise: 600_050 }))
  })

  it('blocks an amount above the outstanding and does not call the service', async () => {
    const { user } = setup()
    const amount = screen.getByLabelText('Amount (₹)')
    await user.clear(amount)
    await user.type(amount, '10000.01')
    await user.click(screen.getByRole('button', { name: 'Record payment' }))
    expect(await screen.findByText('Amount is more than the rent outstanding for this month.')).toBeTruthy()
    expect(recordRentPayment).not.toHaveBeenCalled()
  })

  it('explains a server-side rejection and stays open', async () => {
    recordRentPayment.mockRejectedValue(new Error('payment exceeds the outstanding rent for that month'))
    const { user, onSaved } = setup()
    await user.click(screen.getByRole('button', { name: 'Record payment' }))
    expect(await screen.findByText(/more than the rent outstanding for this month\. Refresh/)).toBeTruthy()
    expect(onSaved).not.toHaveBeenCalled()
  })

  it('shows a retryable error when the network fails', async () => {
    recordRentPayment.mockRejectedValue(new Error('network down'))
    const { user } = setup()
    await user.click(screen.getByRole('button', { name: 'Record payment' }))
    expect(await screen.findByText(/Could not save the payment/)).toBeTruthy()
  })

  it('closes on Escape', async () => {
    const { user, onClose } = setup()
    await user.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalled()
  })
})
