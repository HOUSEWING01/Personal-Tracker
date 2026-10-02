// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AddTransactionDialog } from './AddTransactionDialog'

const createTransaction = vi.fn()
vi.mock('../../services/transactionService', () => ({ createTransaction: (...a: unknown[]) => createTransaction(...a) }))

function setup() {
  const onSaved = vi.fn(), onClose = vi.fn()
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { mutations: { retry: false } } })}>
      <AddTransactionDialog open onClose={onClose} onSaved={onSaved} />
    </QueryClientProvider>,
  )
  return { onSaved, onClose, user: userEvent.setup() }
}
afterEach(() => { cleanup(); createTransaction.mockReset() })

describe('AddTransactionDialog', () => {
  it('is an accessible modal dialog and focuses the first field', () => {
    setup()
    expect(screen.getByRole('dialog', { name: 'Add transaction' })).toBeTruthy()
    expect(document.activeElement).toBe(screen.getByLabelText('Type'))
  })

  it('shows validation errors and does not call the service', async () => {
    const { user } = setup()
    await user.click(screen.getByRole('button', { name: 'Save transaction' }))
    expect((await screen.findByText('Enter an amount.'))).toBeTruthy()
    expect(createTransaction).not.toHaveBeenCalled()
  })

  it('submits integer paise and reports success', async () => {
    createTransaction.mockResolvedValue({ id: '1' })
    const { user, onSaved } = setup()
    await user.type(screen.getByLabelText('Amount (₹)'), '6000.50')
    await user.type(screen.getByLabelText('Description (optional)'), 'Diesel')
    await user.click(screen.getByRole('button', { name: 'Save transaction' }))
    await waitFor(() => expect(onSaved).toHaveBeenCalled())
    expect(createTransaction).toHaveBeenCalledTimes(1)
    expect(createTransaction.mock.calls[0][0]).toMatchObject({ type: 'expense', module: 'general', amountPaise: 600050, description: 'Diesel' })
  })

  it('shows a retryable error when saving fails and stays open', async () => {
    createTransaction.mockRejectedValue(new Error('network down'))
    const { user, onSaved } = setup()
    await user.type(screen.getByLabelText('Amount (₹)'), '10')
    await user.click(screen.getByRole('button', { name: 'Save transaction' }))
    expect(await screen.findByText(/Could not save the transaction/)).toBeTruthy()
    expect(onSaved).not.toHaveBeenCalled()
  })

  it('requires a reason for adjustments', async () => {
    const { user } = setup()
    await user.click(screen.getByLabelText('Type'))
    await user.click(screen.getByRole('option', { name: 'Adjustment' }))
    await user.type(screen.getByLabelText('Amount (₹)'), '-100')
    await user.click(screen.getByRole('button', { name: 'Save transaction' }))
    expect(await screen.findByText('Explain the adjustment so it can be audited.')).toBeTruthy()
  })

  it('Escape closes the dialog', async () => {
    const { user, onClose } = setup()
    await user.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalled()
  })
})
