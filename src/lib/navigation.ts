import type { Icon } from '@phosphor-icons/react'
import {
  SquaresFour, Buildings, Truck, Stack, Coins, ArrowsLeftRight, ChartBar, GearSix,
} from '@phosphor-icons/react'

export interface NavItem { to: string; label: string; icon: Icon; phase: number }
export interface NavGroup { label?: string; items: NavItem[] }

export const NAV: NavGroup[] = [
  { items: [{ to: '/', label: 'Dashboard', icon: SquaresFour, phase: 8 }] },
  {
    label: 'Business',
    items: [
      { to: '/property', label: 'Property rental', icon: Buildings, phase: 4 },
      { to: '/transport', label: 'Transport', icon: Truck, phase: 5 },
      { to: '/sheets', label: 'Sheet rental', icon: Stack, phase: 6 },
      { to: '/gold-loans', label: 'Gold loans', icon: Coins, phase: 7 },
    ],
  },
  { label: 'Finance', items: [{ to: '/finance', label: 'Transactions', icon: ArrowsLeftRight, phase: 3 }] },
  { items: [
      { to: '/reports', label: 'Reports', icon: ChartBar, phase: 9 },
      { to: '/settings', label: 'Settings', icon: GearSix, phase: 10 },
  ] },
]

export const ALL_NAV_ITEMS: NavItem[] = NAV.flatMap((g) => g.items)
