import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronDown,
  Info,
  LoaderCircle,
  Search,
  X,
  XCircle,
} from 'lucide-react'
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '../lib/utils'

export function Spinner({ className }: { className?: string }) {
  return <LoaderCircle className={cn('h-4 w-4 animate-spin', className)} aria-hidden="true" />
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'subtle'
  size?: 'sm' | 'md' | 'icon'
  loading?: boolean
}

export function Button({
  variant = 'secondary',
  size = 'md',
  loading = false,
  className,
  children,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-xl font-medium transition-all duration-150 ease-out active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime/50 disabled:cursor-not-allowed disabled:opacity-45',
        size === 'sm' && 'h-9 px-3 text-[13px]',
        size === 'md' && 'h-11 px-4 text-sm',
        size === 'icon' && 'h-10 w-10',
        variant === 'primary' && 'bg-lime text-ink-950 hover:bg-lime-soft active:bg-lime-dim',
        variant === 'secondary' && 'border border-ink-700 bg-ink-850 text-white hover:border-ink-600 hover:bg-ink-800',
        variant === 'ghost' && 'text-zinc-400 hover:bg-ink-800 hover:text-white',
        variant === 'subtle' && 'bg-ink-800 text-zinc-200 hover:bg-ink-750',
        variant === 'danger' && 'border border-red-950 bg-red-950/30 text-red-300 hover:bg-red-950/60',
        className,
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Spinner />}
      {children}
    </button>
  )
}

export function Card({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-ink-700/70 bg-ink-850 transition-[border-color,background-color,box-shadow,transform] duration-200 ease-out md:hover:-translate-y-0.5 md:hover:border-ink-600/80 md:hover:shadow-[0_18px_40px_-30px_rgba(0,0,0,0.95)]',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}

export function Field({
  label,
  hint,
  error,
  children,
  className,
  htmlFor,
  as = 'label',
}: {
  label?: string
  hint?: string
  error?: string
  children: ReactNode
  className?: string
  htmlFor?: string
  as?: 'label' | 'div'
}) {
  const content = (
    <>
      {label && <span className="mb-2 block text-xs font-medium uppercase tracking-[0.12em] text-zinc-500">{label}</span>}
      {children}
      {error ? (
        <span className="mt-1.5 block text-xs text-red-400">{error}</span>
      ) : hint ? (
        <span className="mt-1.5 block text-[11px] leading-relaxed text-zinc-500">{hint}</span>
      ) : null}
    </>
  )

  if (as === 'div') {
    return <div className={cn('block', className)}>{content}</div>
  }

  return (
    <label className={cn('block', className)} htmlFor={htmlFor}>
      {content}
    </label>
  )
}

const controlClass =
  'w-full rounded-xl border border-ink-700 bg-ink-900 px-3.5 text-sm text-white placeholder:text-zinc-600 transition-[border-color,box-shadow,background-color] duration-200 focus:border-lime/60 focus:shadow-[0_0_0_3px_rgba(184,243,107,0.06)] focus:outline-none focus:ring-1 focus:ring-lime/30 disabled:opacity-50'

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(controlClass, 'h-11', className)} {...props} />
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(controlClass, 'min-h-28 resize-y py-3 leading-relaxed', className)} {...props} />
}

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <span className="relative block">
      <select className={cn(controlClass, 'h-11 appearance-none pr-9', className)} {...props}>
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
    </span>
  )
}

export interface SearchSelectOption {
  value: string
  label: string
  group?: string
  hint?: string
}

export function SearchSelect({
  value,
  onChange,
  options,
  placeholder = 'Seleccionar…',
  searchPlaceholder = 'Buscar…',
  emptyMessage = 'Sin resultados.',
  clearLabel,
  disabled,
  className,
  size = 'md',
  ariaLabel,
}: {
  value: string
  onChange: (value: string) => void
  options: SearchSelectOption[]
  placeholder?: string
  searchPlaceholder?: string
  emptyMessage?: string
  clearLabel?: string
  disabled?: boolean
  className?: string
  size?: 'md' | 'sm'
  ariaLabel?: string
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handlePointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [open])

  const selected = options.find((option) => option.value === value) ?? null
  const term = query.trim().toLowerCase()
  const filtered = useMemo(() => {
    if (!term) return options
    return options.filter((option) =>
      `${option.label} ${option.group ?? ''} ${option.hint ?? ''}`.toLowerCase().includes(term),
    )
  }, [options, term])
  const groups = useMemo(() => {
    const map = new Map<string, SearchSelectOption[]>()
    for (const option of filtered) {
      const group = option.group ?? ''
      map.set(group, [...(map.get(group) ?? []), option])
    }
    return Array.from(map.entries())
  }, [filtered])
  const showClear = Boolean(clearLabel && (!term || clearLabel.toLowerCase().includes(term)))

  function choose(next: string) {
    onChange(next)
    setOpen(false)
    setQuery('')
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => {
          if (disabled) return
          setOpen((current) => !current)
          setQuery('')
        }}
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={cn(
          'flex w-full items-center justify-between gap-2 rounded-xl border border-ink-700 bg-ink-900 text-left transition focus:border-lime/60 focus:outline-none focus:ring-1 focus:ring-lime/30 disabled:cursor-not-allowed disabled:opacity-50',
          size === 'sm' ? 'h-9 px-2.5 text-xs' : 'h-11 px-3.5 text-sm',
          className,
        )}
      >
        <span className={cn('min-w-0 flex-1 truncate', selected ? 'text-white' : 'text-zinc-600')}>
          {selected?.label ?? placeholder}
        </span>
        <ChevronDown className={cn('h-4 w-4 shrink-0 text-zinc-500 transition', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="mt-1.5 origin-top overflow-hidden rounded-xl border border-ink-700 bg-ink-900 shadow-xl shadow-black/30 animate-pop-in">
          <div className="relative border-b border-ink-700/70">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-600" />
            <input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  setOpen(false)
                } else if (event.key === 'Enter') {
                  event.preventDefault()
                  if (filtered[0]) choose(filtered[0].value)
                }
              }}
              placeholder={searchPlaceholder}
              className="h-10 w-full bg-transparent pl-9 pr-3 text-xs text-white placeholder:text-zinc-600 focus:outline-none"
            />
          </div>
          <div className="max-h-60 overflow-y-auto p-1" role="listbox">
            {showClear && (
              <button
                type="button"
                onClick={() => choose('')}
                className={cn(
                  'flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-xs transition',
                  value ? 'text-zinc-400 hover:bg-ink-800 hover:text-white' : 'bg-lime/10 text-lime',
                )}
              >
                {clearLabel}
                {!value && <Check className="h-3.5 w-3.5" />}
              </button>
            )}
            {groups.map(([group, items]) => (
              <div key={group || 'sin-grupo'} className="py-1">
                {group && (
                  <p className="px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-zinc-600">
                    {group}
                  </p>
                )}
                {items.map((option) => {
                  const active = option.value === value
                  return (
                    <button
                      key={option.value}
                      type="button"
                      role="option"
                      aria-selected={active}
                      onClick={() => choose(option.value)}
                      className={cn(
                        'flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-xs transition',
                        active ? 'bg-lime/10 text-lime' : 'text-zinc-300 hover:bg-ink-800 hover:text-white',
                      )}
                    >
                      <span className="min-w-0">
                        <span className="block truncate">{option.label}</span>
                        {option.hint && <span className="block truncate text-[10px] text-zinc-600">{option.hint}</span>}
                      </span>
                      {active && <Check className="h-3.5 w-3.5 shrink-0" />}
                    </button>
                  )
                })}
              </div>
            ))}
            {!filtered.length && !showClear && (
              <p className="px-2.5 py-3 text-center text-[11px] text-zinc-600">{emptyMessage}</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export function Badge({
  children,
  tone = 'neutral',
  className,
}: {
  children: ReactNode
  tone?: 'neutral' | 'accent' | 'warning' | 'danger' | 'muted' | 'info'
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.1em]',
        tone === 'neutral' && 'bg-ink-750 text-zinc-300',
        tone === 'accent' && 'bg-lime/10 text-lime',
        tone === 'warning' && 'bg-amber-500/10 text-amber-300',
        tone === 'danger' && 'bg-red-500/10 text-red-300',
        tone === 'muted' && 'bg-ink-800 text-zinc-500',
        tone === 'info' && 'bg-sky-500/10 text-sky-300',
        className,
      )}
    >
      {children}
    </span>
  )
}

export function ProgressBar({
  value,
  tone = 'accent',
  className,
}: {
  value: number
  tone?: 'accent' | 'warning' | 'info'
  className?: string
}) {
  return (
    <div className={cn('h-1.5 w-full overflow-hidden rounded-full bg-ink-750', className)}>
      <div
        className={cn(
          'h-full origin-left rounded-full transition-all duration-500 ease-out motion-safe:animate-progress-grow',
          tone === 'accent' && 'bg-lime',
          tone === 'warning' && 'bg-amber-400',
          tone === 'info' && 'bg-sky-400',
        )}
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  )
}

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
}: {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  children: ReactNode
  footer?: ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previous
    }
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6" role="dialog" aria-modal="true">
      <button className="absolute inset-0 cursor-default bg-black/70 animate-fade-in" onClick={onClose} aria-label="Cerrar" />
      <div
        className={cn(
          'relative z-10 flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-3xl border border-ink-700 bg-ink-850 shadow-2xl shadow-black/50 animate-sheet-in will-change-transform sm:rounded-3xl sm:animate-modal-in',
          size === 'sm' && 'sm:max-w-md',
          size === 'md' && 'sm:max-w-xl',
          size === 'lg' && 'sm:max-w-3xl',
          size === 'xl' && 'sm:max-w-5xl',
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-ink-700/70 px-5 py-4 sm:px-6">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-white">{title}</h2>
            {description && <p className="mt-1 text-xs leading-relaxed text-zinc-500">{description}</p>}
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Cerrar">
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-5 sm:px-6">{children}</div>
        {footer && (
          <div
            data-modal-footer
            className="border-t border-ink-700/70 px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6 sm:pb-4"
          >
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}

export function ConfirmDialog({
  open,
  title = 'Confirmar acción',
  description,
  confirmLabel = 'Eliminar',
  loading,
  onCancel,
  onConfirm,
}: {
  open: boolean
  title?: string
  description: string
  confirmLabel?: string
  loading?: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      size="sm"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onCancel}>
            Cancelar
          </Button>
          <Button variant="danger" onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </div>
      }
    >
      <p className="text-sm leading-relaxed text-zinc-400">{description}</p>
    </Modal>
  )
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode
  title: string
  description?: string
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center px-5 py-12 text-center', className)}>
      {icon && (
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-ink-700 bg-ink-900 text-zinc-500 motion-safe:animate-pop-in">
          {icon}
        </div>
      )}
      <h3 className="text-sm font-semibold text-zinc-200">{title}</h3>
      {description && <p className="mt-1.5 max-w-sm text-xs leading-relaxed text-zinc-500">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export function LoadingState({ label = 'Cargando…' }: { label?: string }) {
  return (
    <div className="flex min-h-40 flex-col items-center justify-center gap-3 text-zinc-500">
      <Spinner className="h-5 w-5 text-lime" />
      <span className="text-xs uppercase tracking-[0.15em]">{label}</span>
    </div>
  )
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 px-5 py-12 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-500/10 text-red-400">
        <AlertTriangle className="h-5 w-5" />
      </div>
      <div>
        <h3 className="text-sm font-semibold text-white">No se pudieron cargar los datos</h3>
        <p className="mt-1 max-w-md text-xs leading-relaxed text-zinc-500">{message}</p>
      </div>
      {onRetry && (
        <Button size="sm" onClick={onRetry}>
          Reintentar
        </Button>
      )}
    </div>
  )
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string
  title: string
  description?: string
  actions?: ReactNode
}) {
  return (
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div>
        {eyebrow && (
          <p className="mb-1.5 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-lime">
            <span className="h-1.5 w-1.5 rounded-full bg-lime shadow-[0_0_10px_rgba(184,243,107,0.45)] motion-safe:animate-pulse-soft" />
            {eyebrow}
          </p>
        )}
        <h1 className="text-2xl font-semibold tracking-[-0.03em] text-white sm:text-3xl">{title}</h1>
        {description && <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-zinc-500">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

export function SectionHeader({
  title,
  subtitle,
  action,
}: {
  title: string
  subtitle?: string
  action?: ReactNode
}) {
  return (
    <div className="mb-3 flex items-end justify-between gap-4">
      <div className="min-w-0">
        <h2 className="truncate text-sm font-semibold tracking-tight text-white">{title}</h2>
        {subtitle && <p className="mt-0.5 text-xs text-zinc-500">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  className,
}: {
  options: Array<{ value: T; label: string; icon?: ReactNode }>
  value: T
  onChange: (value: T) => void
  className?: string
}) {
  return (
    <div className={cn('inline-flex rounded-xl border border-ink-700 bg-ink-900 p-1', className)}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={cn(
            'inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-medium transition',
            value === option.value
              ? 'bg-ink-750 text-white motion-safe:animate-pop-in'
              : 'text-zinc-500 hover:text-zinc-300',
          )}
        >
          {option.icon}
          {option.label}
        </button>
      ))}
    </div>
  )
}

type Toast = { id: string; message: string; tone: 'success' | 'error' | 'info' }

const ToastContext = createContext<{ push: (message: string, tone?: Toast['tone']) => void } | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const push = useCallback((message: string, tone: Toast['tone'] = 'success') => {
    const id = crypto.randomUUID()
    setToasts((current) => [...current, { id, message, tone }])
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id))
    }, 4200)
  }, [])

  const value = useMemo(() => ({ push }), [push])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+5.8rem)] z-[60] flex flex-col items-center gap-2 px-4 md:bottom-6">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={cn(
              'pointer-events-auto flex max-w-sm items-center gap-2.5 rounded-xl border px-4 py-3 text-sm shadow-xl shadow-black/40 animate-toast-in',
              toast.tone === 'success' && 'border-lime/20 bg-[#141a0e] text-lime-soft',
              toast.tone === 'error' && 'border-red-900 bg-[#1b0f0f] text-red-200',
              toast.tone === 'info' && 'border-ink-700 bg-ink-850 text-zinc-200',
            )}
          >
            {toast.tone === 'success' && <CheckCircle2 className="h-4 w-4 shrink-0" />}
            {toast.tone === 'error' && <XCircle className="h-4 w-4 shrink-0" />}
            {toast.tone === 'info' && <Info className="h-4 w-4 shrink-0" />}
            <span>{toast.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const value = useContext(ToastContext)
  if (!value) throw new Error('useToast debe usarse dentro de ToastProvider')
  return value
}

export function SaveIndicator({ status }: { status: 'idle' | 'saving' | 'saved' | 'error' }) {
  if (status === 'saving') {
    return (
      <span className="inline-flex items-center gap-1.5 text-[11px] text-zinc-500">
        <Spinner className="h-3 w-3" /> Guardando…
      </span>
    )
  }
  if (status === 'saved') {
    return (
      <span className="inline-flex items-center gap-1.5 text-[11px] text-lime motion-safe:animate-pop-in">
        <Check className="h-3 w-3" /> Guardado
      </span>
    )
  }
  if (status === 'error') {
    return (
      <span className="inline-flex items-center gap-1.5 text-[11px] text-red-400">
        <XCircle className="h-3 w-3" /> No guardado
      </span>
    )
  }
  return null
}
