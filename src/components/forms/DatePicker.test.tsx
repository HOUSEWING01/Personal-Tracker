// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { DatePicker } from './DatePicker'

function Harness({ initial = '', onChange = () => {} }: { initial?: string; onChange?: (v: string) => void }) {
  const [v, setV] = useState(initial)
  return (
    <>
      <label htmlFor="d">Pledge date</label>
      <DatePicker id="d" value={v} onChange={(x) => { setV(x); onChange(x) }} />
    </>
  )
}
afterEach(cleanup)

describe('DatePicker', () => {
  it('shows the formatted date, or a placeholder when empty', () => {
    render(<Harness initial="2026-10-03" />)
    expect(screen.getByLabelText('Pledge date').textContent).toContain('03 Oct 2026')
    cleanup()
    render(<Harness />)
    expect(screen.getByLabelText('Pledge date').textContent).toContain('Select date')
  })

  it('opens on the selected month and picks a day', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<Harness initial="2026-10-03" onChange={onChange} />)
    await user.click(screen.getByLabelText('Pledge date'))
    expect(screen.getByRole('dialog', { name: 'Choose date' })).toBeTruthy()
    expect(screen.getByText('October 2026')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: '15 October 2026' }))
    expect(onChange).toHaveBeenCalledWith('2026-10-15')
    expect(screen.queryByRole('dialog', { name: 'Choose date' })).toBeNull()
    expect(screen.getByLabelText('Pledge date').textContent).toContain('15 Oct 2026')
  })

  it('moves between months', async () => {
    const user = userEvent.setup()
    render(<Harness initial="2026-10-03" />)
    await user.click(screen.getByLabelText('Pledge date'))
    await user.click(screen.getByRole('button', { name: 'Next month' }))
    expect(screen.getByText('November 2026')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Previous month' }))
    await user.click(screen.getByRole('button', { name: 'Previous month' }))
    expect(screen.getByText('September 2026')).toBeTruthy()
  })

  it('jumps to another year through the month and year views', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<Harness initial="2026-10-03" onChange={onChange} />)
    await user.click(screen.getByLabelText('Pledge date'))
    await user.click(screen.getByRole('button', { name: 'Choose month and year' }))
    await user.click(screen.getByRole('button', { name: 'Choose year' }))
    await user.click(screen.getByRole('button', { name: '2024' }))
    await user.click(screen.getByRole('button', { name: 'February 2024' }))
    await user.click(screen.getByRole('button', { name: '29 February 2024' }))
    expect(onChange).toHaveBeenCalledWith('2024-02-29')
  })

  it('moves by day with the arrow keys and selects with Enter', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<Harness initial="2026-10-03" onChange={onChange} />)
    await user.click(screen.getByLabelText('Pledge date'))
    await user.keyboard('{ArrowRight}{ArrowDown}{Enter}') // 3 Oct -> 4 Oct -> 11 Oct
    expect(onChange).toHaveBeenCalledWith('2026-10-11')
  })

  it('Today and Clear work', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<Harness initial="2026-10-03" onChange={onChange} />)
    await user.click(screen.getByLabelText('Pledge date'))
    await user.click(screen.getByRole('button', { name: 'Clear' }))
    expect(onChange).toHaveBeenLastCalledWith('')
    await user.click(screen.getByLabelText('Pledge date'))
    expect(screen.queryByRole('button', { name: 'Clear' })).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Today' }))
    expect(onChange.mock.lastCall?.[0]).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('Escape closes the calendar and returns focus to the field', async () => {
    const user = userEvent.setup()
    render(<Harness initial="2026-10-03" />)
    const btn = screen.getByLabelText('Pledge date')
    await user.click(btn)
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog', { name: 'Choose date' })).toBeNull()
    expect(document.activeElement).toBe(btn)
  })
})
