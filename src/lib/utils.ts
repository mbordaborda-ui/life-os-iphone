export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ')
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

export function toNumber(value: string | number | null | undefined, fallback = 0) {
  if (value === null || value === undefined || value === '') return fallback
  const parsed = typeof value === 'number' ? value : Number(String(value).replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : fallback
}

export function formatNumber(value: number, maximumFractionDigits = 1) {
  return new Intl.NumberFormat('es-ES', { maximumFractionDigits }).format(value)
}

export function formatMoney(value: number) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

export function formatMoneyPrecise(value: number) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value)
}

export function normalizeName(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, ' ')
}

export function splitTags(value: string) {
  return Array.from(
    new Set(
      value
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean),
    ),
  )
}

function errorText(error: unknown) {
  if (!error) return ''
  if (typeof error === 'string') return error
  if (error instanceof Error) return error.message
  if (typeof error === 'object' && 'message' in error) return String((error as { message: unknown }).message)
  return ''
}

export function isNetworkError(error: unknown) {
  return /failed to fetch|networkerror|network error|load failed|fetch failed|internet disconnected/i.test(errorText(error))
}

export function errorMessage(error: unknown) {
  if (!error) return 'Ha ocurrido un error inesperado.'
  if (isNetworkError(error)) return 'No pudimos conectar con el servidor. Revisa tu conexión y vuelve a intentarlo.'
  return errorText(error) || 'No se pudo completar la operación.'
}

export function isOnline() {
  return typeof navigator === 'undefined' || navigator.onLine
}

export function uid() {
  return crypto.randomUUID()
}

export function downloadText(filename: string, content: string, type = 'text/plain') {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}
