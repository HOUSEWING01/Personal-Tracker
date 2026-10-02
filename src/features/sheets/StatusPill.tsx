const TONES = {
  good: 'bg-sage-soft text-primary',
  warn: 'bg-gold-soft text-primary',
  danger: 'bg-danger-soft text-danger',
  neutral: 'bg-canvas text-muted',
} as const

/** Status is always spelled out in text, never colour alone. */
export function StatusPill({ tone = 'neutral', children }: { tone?: keyof typeof TONES; children: React.ReactNode }) {
  return <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${TONES[tone]}`}>{children}</span>
}
