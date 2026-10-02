// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { Select } from './Select'

function Harness({ onChange = () => {}, initial = '' }: { onChange?: (v: string) => void; initial?: string }) {
  const [v, setV] = useState(initial)
  return (
    <>
      <label htmlFor="s">Status</label>
      <Select id="s" value={v} onChange={(x) => { setV(x); onChange(x) }}>
        <option value="">Choose one</option>
        <option value="a">Alpha</option>
        <option value="b" disabled>Beta</option>
        <option value="c">Gamma</option>
      </Select>
    </>
  )
}
afterEach(cleanup)

describe('Select', () => {
  it('shows the selected label and opens a listbox on click', async () => {
    const user = userEvent.setup()
    render(<Harness initial="a" />)
    const btn = screen.getByLabelText('Status')
    expect(btn.textContent).toContain('Alpha')
    await user.click(btn)
    expect(screen.getByRole('listbox')).toBeTruthy()
    expect(screen.getAllByRole('option')).toHaveLength(4)
    expect(screen.getByRole('option', { name: 'Alpha' }).getAttribute('aria-selected')).toBe('true')
  })

  it('picks an option with the mouse and closes', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<Harness onChange={onChange} />)
    await user.click(screen.getByLabelText('Status'))
    await user.click(screen.getByRole('option', { name: 'Gamma' }))
    expect(onChange).toHaveBeenCalledWith('c')
    expect(screen.queryByRole('listbox')).toBeNull()
    expect(screen.getByLabelText('Status').textContent).toContain('Gamma')
  })

  it('does not pick a disabled option', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<Harness onChange={onChange} />)
    await user.click(screen.getByLabelText('Status'))
    await user.click(screen.getByRole('option', { name: 'Beta' }))
    expect(onChange).not.toHaveBeenCalled()
  })

  it('works from the keyboard and skips disabled options', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<Harness onChange={onChange} />)
    screen.getByLabelText('Status').focus()
    await user.keyboard('{ArrowDown}') // opens on the first enabled option
    await user.keyboard('{ArrowDown}') // Alpha
    await user.keyboard('{ArrowDown}') // skips disabled Beta, lands on Gamma
    await user.keyboard('{Enter}')
    expect(onChange).toHaveBeenCalledWith('c')
  })

  it('Escape closes the list and the event does not reach an outer Escape listener', async () => {
    const outer = vi.fn()
    const user = userEvent.setup()
    const { container } = render(<div onKeyDownCapture={() => {}}><Harness /></div>)
    container.addEventListener('keydown', (e) => { if (e.key === 'Escape') outer() })
    await user.click(screen.getByLabelText('Status'))
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('listbox')).toBeNull()
    expect(outer).not.toHaveBeenCalled()
  })

  it('closes when pressing outside', async () => {
    const user = userEvent.setup()
    render(<><Harness /><button type="button">elsewhere</button></>)
    await user.click(screen.getByLabelText('Status'))
    await user.click(screen.getByRole('button', { name: 'elsewhere' }))
    expect(screen.queryByRole('listbox')).toBeNull()
  })
})
