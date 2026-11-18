import type { ReactNode } from 'react'
import { Card } from '../ui'
import { cn } from '../../lib/utils'

export const chartGrid = { stroke: '#27272a', vertical: false as const }
export const chartAxis = {
  stroke: '#3f3f46',
  tick: { fill: '#71717a', fontSize: 10 },
  axisLine: false as const,
  tickLine: false as const,
}
export const chartTooltipStyle = {
  background: '#171717',
  border: '1px solid #3f3f46',
  borderRadius: 12,
  fontSize: 12,
  color: '#e4e4e7',
  boxShadow: '0 12px 30px rgba(0,0,0,.45)',
}
export const chartTooltipLabelStyle = { color: '#a1a1aa', fontSize: 11, marginBottom: 4 }

export function ChartCard({
  title,
  subtitle,
  action,
  children,
  empty,
  className,
}: {
  title: string
  subtitle?: string
  action?: ReactNode
  children: ReactNode
  empty?: boolean
  className?: string
}) {
  return (
    <Card className={cn('overflow-hidden', className)}>
      <div className="flex items-start justify-between gap-3 border-b border-ink-700/60 px-4 py-3">
        <div>
          <h3 className="text-sm font-semibold text-white">{title}</h3>
          {subtitle && <p className="mt-0.5 text-[10px] text-zinc-500">{subtitle}</p>}
        </div>
        {action}
      </div>
      <div className="p-4">
        {empty ? (
          <div className="flex h-48 flex-col items-center justify-center gap-2 text-center">
            <p className="text-xs text-zinc-500">Aún no hay datos suficientes.</p>
            <p className="max-w-xs text-[10px] leading-relaxed text-zinc-600">
              Registra actividad en este periodo para ver la evolución aquí.
            </p>
          </div>
        ) : (
          children
        )}
      </div>
    </Card>
  )
}
