import { AlertTriangle, CalendarClock, MapPin, Minus, Package, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  Input,
  LoadingState,
  PageHeader,
  ProgressBar,
  useToast,
} from '../ui'
import { PantryAdjustModal } from './PantryAdjustModal'
import { PantryItemModal } from './PantryItemModal'
import { useQuery } from '../../hooks/useQuery'
import { db } from '../../lib/supabase'
import { daysUntil, pantryStatus, pantryStatusLabel, percentage } from '../../lib/calculations'
import { errorMessage, formatNumber } from '../../lib/utils'
import type { PantryItem } from '../../types'

type Filter = 'all' | 'low' | 'out' | 'expiring'

export default function PantryPage() {
  const { push } = useToast()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<PantryItem | null>(null)
  const [adjustItem, setAdjustItem] = useState<PantryItem | null>(null)
  const [adjustDirection, setAdjustDirection] = useState<'consume' | 'add'>('consume')
  const [deleteTarget, setDeleteTarget] = useState<PantryItem | null>(null)
  const [deleting, setDeleting] = useState(false)

  const query = useQuery<PantryItem[]>(
    async () => {
      const { data, error } = await db()
        .from('pantry_items')
        .select('*')
        .order('quantity', { ascending: true })
        .order('name')
      if (error) throw error
      return (data ?? []) as PantryItem[]
    },
    [],
    [],
  )

  const stats = useMemo(() => {
    const low = query.data.filter((item) => pantryStatus(item) === 'low').length
    const out = query.data.filter((item) => pantryStatus(item) === 'out').length
    const expiring = query.data.filter((item) => item.expires_on && daysUntil(item.expires_on) >= 0 && daysUntil(item.expires_on) <= 7).length
    return { low, out, expiring }
  }, [query.data])

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return query.data
      .filter((item) => !term || item.name.toLowerCase().includes(term) || item.category?.toLowerCase().includes(term))
      .filter((item) => {
        if (filter === 'low') return pantryStatus(item) === 'low'
        if (filter === 'out') return pantryStatus(item) === 'out'
        if (filter === 'expiring') {
          const days = item.expires_on ? daysUntil(item.expires_on) : null
          return days !== null && days >= 0 && days <= 7
        }
        return true
      })
  }, [query.data, search, filter])

  async function deleteItem() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const { error } = await db().from('pantry_items').delete().eq('id', deleteTarget.id)
      if (error) throw error
      push('Alimento eliminado de la despensa')
      setDeleteTarget(null)
      setFormOpen(false)
      query.reload()
    } catch (reason) {
      push(errorMessage(reason), 'error')
    } finally {
      setDeleting(false)
    }
  }

  if (query.loading) return <LoadingState label="Cargando despensa" />
  if (query.error) return <ErrorState message={query.error} onRetry={query.reload} />

  return (
    <div className="space-y-5 animate-fade-up">
      <PageHeader
        eyebrow="Alimentación"
        title="Despensa"
        description="Inventario real, mínimos y caducidades. Sin dobles descuentos."
        actions={
          <Button
            variant="primary"
            onClick={() => {
              setEditing(null)
              setFormOpen(true)
            }}
          >
            <Plus className="h-4 w-4" /> Añadir alimento
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="p-4">
          <p className="muted-label">Productos</p>
          <p className="mt-2 text-2xl font-semibold text-white">{query.data.length}</p>
        </Card>
        <Card className="p-4">
          <p className="muted-label">Por agotarse</p>
          <p className="mt-2 text-2xl font-semibold text-amber-300">{stats.low}</p>
        </Card>
        <Card className="p-4">
          <p className="muted-label">Agotados</p>
          <p className="mt-2 text-2xl font-semibold text-red-300">{stats.out}</p>
        </Card>
        <Card className="p-4">
          <p className="muted-label">Caducan en 7 días</p>
          <p className="mt-2 text-2xl font-semibold text-sky-300">{stats.expiring}</p>
        </Card>
      </div>

      <Card className="space-y-2 p-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-600" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar en la despensa"
            className="pl-9"
          />
        </div>
        <div className="no-scrollbar flex gap-1.5 overflow-x-auto">
          {(
            [
              ['all', 'Todo'],
              ['low', 'Por agotarse'],
              ['out', 'Agotados'],
              ['expiring', 'Próximos a caducar'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              onClick={() => setFilter(value)}
              className={`shrink-0 rounded-full px-3 py-1 text-[10px] ${
                filter === value ? 'bg-lime/10 text-lime' : 'bg-ink-800 text-zinc-500'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </Card>

      {filtered.length ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((item) => {
            const status = pantryStatus(item)
            const days = item.expires_on ? daysUntil(item.expires_on) : null
            const stockRatio =
              item.min_quantity > 0 ? percentage(item.quantity, item.min_quantity * 2) : item.quantity > 0 ? 100 : 0
            return (
              <Card key={item.id} className="overflow-hidden">
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-semibold text-white">{item.name}</h3>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] text-zinc-500">
                        {item.category && <span>{item.category}</span>}
                        {item.location && (
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="h-2.5 w-2.5" /> {item.location}
                          </span>
                        )}
                      </div>
                    </div>
                    <Badge
                      tone={status === 'out' ? 'danger' : status === 'low' ? 'warning' : 'accent'}
                    >
                      {pantryStatusLabel(item)}
                    </Badge>
                  </div>
                  <div className="mt-4 flex items-end justify-between">
                    <div>
                      <span className="text-2xl font-semibold tracking-tight text-white">{formatNumber(item.quantity)}</span>
                      <span className="ml-1 text-xs text-zinc-500">{item.unit}</span>
                      <p className="mt-0.5 text-[10px] text-zinc-600">
                        Mínimo {formatNumber(item.min_quantity)} {item.unit}
                      </p>
                    </div>
                    {item.expires_on && (
                      <span
                        className={`inline-flex items-center gap-1 text-[10px] ${
                          days !== null && days < 0
                            ? 'text-red-400'
                            : days !== null && days <= 7
                              ? 'text-amber-300'
                              : 'text-zinc-600'
                        }`}
                      >
                        <CalendarClock className="h-3 w-3" />
                        {days === null ? '' : days < 0 ? 'Caducado' : days === 0 ? 'Caduca hoy' : `${days} días`}
                      </span>
                    )}
                  </div>
                  <ProgressBar
                    value={stockRatio}
                    tone={status === 'out' ? 'warning' : status === 'low' ? 'warning' : 'accent'}
                    className="mt-3"
                  />
                </div>
                <div className="flex items-center gap-1 border-t border-ink-700/60 bg-ink-900/50 px-3 py-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setAdjustDirection('consume')
                      setAdjustItem(item)
                    }}
                  >
                    <Minus className="h-3.5 w-3.5" /> Consumir
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setAdjustDirection('add')
                      setAdjustItem(item)
                    }}
                  >
                    <Plus className="h-3.5 w-3.5" /> Reponer
                  </Button>
                  <button
                    onClick={() => {
                      setEditing(item)
                      setFormOpen(true)
                    }}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-700 transition hover:bg-ink-800 hover:text-white"
                    aria-label="Editar alimento"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => setDeleteTarget(item)}
                    className="ml-auto flex h-8 w-8 items-center justify-center rounded-lg text-zinc-700 hover:bg-red-500/10 hover:text-red-400"
                    aria-label="Eliminar alimento"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </Card>
            )
          })}
        </div>
      ) : (
        <Card>
          <EmptyState
            icon={<Package className="h-5 w-5" />}
            title={query.data.length ? 'No hay productos con este filtro' : 'La despensa está vacía'}
            description={
              query.data.length
                ? 'Cambia el filtro o busca otro alimento.'
                : 'Añade lo que tienes en casa. LIFE OS avisará de mínimos y caducidades.'
            }
            action={
              query.data.length ? (
                <Button variant="secondary" onClick={() => setFilter('all')}>
                  Ver todo
                </Button>
              ) : (
                <Button
                  onClick={() => {
                    setEditing(null)
                    setFormOpen(true)
                  }}
                >
                  <Plus className="h-4 w-4" /> Añadir alimento
                </Button>
              )
            }
          />
        </Card>
      )}

      {stats.out + stats.low > 0 && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-500/15 bg-amber-500/5 px-4 py-3 text-[11px] leading-relaxed text-amber-200/70">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" />
          Hay {stats.out + stats.low} productos que necesitan reposición. Puedes incorporarlos a la lista de mercado desde Mercado.
        </div>
      )}

      <PantryItemModal
        open={formOpen}
        onClose={() => {
          setFormOpen(false)
          setEditing(null)
        }}
        onSaved={query.reload}
        item={editing}
        onDelete={(item) => setDeleteTarget(item)}
      />
      <PantryAdjustModal
        open={Boolean(adjustItem)}
        onClose={() => setAdjustItem(null)}
        onSaved={query.reload}
        item={adjustItem}
        initialDirection={adjustDirection}
      />
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Eliminar de la despensa"
        description="El alimento y su historial de movimientos se eliminarán. Esta acción no se puede deshacer."
        onCancel={() => setDeleteTarget(null)}
        onConfirm={deleteItem}
        loading={deleting}
      />
    </div>
  )
}
