import { cn } from '../lib/utils'

export function Logo({ compact = false, className }: { compact?: boolean; className?: string }) {
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <span className="relative flex h-8 w-8 items-center justify-center rounded-[10px] border border-ink-700 bg-ink-850 shadow-[0_0_20px_rgba(184,243,107,0.06)]">
        <span className="h-3 w-3 rounded-full border-[2.5px] border-lime motion-safe:animate-pulse-soft" />
        <span className="absolute bottom-[7px] h-[7px] w-[2px] rounded-full bg-white/90" />
      </span>
      {!compact && (
        <span className="text-[15px] font-semibold tracking-[-0.02em] text-white">
          LIFE <span className="text-zinc-500">OS</span>
        </span>
      )}
    </div>
  )
}
