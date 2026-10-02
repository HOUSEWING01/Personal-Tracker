// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { GodownDialog } from './GodownDialog'

const svc = { createProperty: vi.fn(), updateProperty: vi.fn(), saveTenant: vi.fn(), recordAdvanceMovement: vi.fn() }
vi.mock('../../services/propertyService', () => ({
  createProperty: (...a: unknown[]) => svc.createProperty(...a),
  updateProperty: (...a: unknown[]) => svc.updateProperty(...a),
  saveTenant: (...a: unknown[]) => svc.saveTenant(...a),
  recordAdvanceMovement: (...a: unknown[]) => svc.recordAdvanceMovement(...a),
}))

function setup() {
  const onSaved = vi.fn(), onClose = vi.fn()
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { mutations: { retry: false } } })}>
      <GodownDialog open mode="add" onClose={onClose} onSaved={onSaved} />
    </QueryClientProvider>,
  )
  return { onSaved, user: userEvent.setup() }
}
async function fill(user: ReturnType<typeof userEvent.setup>, advance = '') {
  await user.type(screen.getByLabelText('Tenant name'), 'Ravi Traders')
  await user.type(screen.getByLabelText('Monthly rent (₹)'), '15000')
  if (advance) await user.type(screen.getByLabelText('Advance received (₹, optional)'), advance)
  await user.click(screen.getByRole('button', { name: 'Save godown' }))
}
afterEach(() => { cleanup(); Object.values(svc).forEach((f) => f.mockReset()) })

describe('GodownDialog (add)', () => {
  it('asks for the tenant name, rent and advance in one form', () => {
    setup()
    expect(screen.getByRole('dialog', { name: 'Add godown' })).toBeTruthy()
    expect(document.activeElement).toBe(screen.getByLabelText('Tenant name'))
  })

  it('shows errors and saves nothing when required fields are empty', async () => {
    const { user } = setup()
    await user.click(screen.getByRole('button', { name: 'Save godown' }))
    expect(await screen.findByText('Enter the tenant name.')).toBeTruthy()
    expect(svc.createProperty).not.toHaveBeenCalled()
  })

  it('creates the godown, its tenant and the advance, in that order', async () => {
    svc.createProperty.mockResolvedValue('g1'); svc.saveTenant.mockResolvedValue(undefined); svc.recordAdvanceMovement.mockResolvedValue('a1')
    const { user, onSaved } = setup()
    await fill(user, '50000')
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith('g1'))
    expect(svc.createProperty.mock.calls[0][0]).toMatchObject({ name: 'Ravi Traders', type: 'godown', monthlyRentPaise: 1_500_000 })
    expect(svc.saveTenant.mock.calls[0][0]).toBe('g1')
    expect(svc.recordAdvanceMovement.mock.calls[0]).toMatchObject(['g1', { kind: 'received', amountPaise: 5_000_000 }])
  })

  it('retrying after the advance fails does not create the godown a second time', async () => {
    svc.createProperty.mockResolvedValue('g1'); svc.saveTenant.mockResolvedValue(undefined)
    svc.recordAdvanceMovement.mockRejectedValueOnce(new Error('network down')).mockResolvedValue('a1')
    const { user, onSaved } = setup()
    await fill(user, '50000')
    expect(await screen.findByText(/Press Save again to retry/)).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Save godown' }))
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith('g1'))
    expect(svc.createProperty).toHaveBeenCalledTimes(1)
    expect(svc.recordAdvanceMovement).toHaveBeenCalledTimes(2)
  })
})
