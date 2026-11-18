import {
  Check,
  Package,
  Plus,
  RotateCcw,
  ShoppingCart,
  Sparkles,
  Trash2,
  Wand2,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  LoadingState,
  Modal,
  PageHeader,
  ProgressBar,
  useToast,
} from '../ui'
import { ShoppingItemModal } from './ShoppingItemModal'
import { useAuth } from '../../hooks/useAuth'
import { useQuery } from '../../hooks/useQuery'
import { db } from '../../lib/supabase'
import { endOfWeek, startOfWeek, toISODate } from '../../lib/dates'
import { foodCost, pantryStatus, percentage, shoppingTotal } from '../../lib/calculations'
import { errorMessage, formatMoney, formatMoneyPrecise, formatNumber, normalizeName } from '../../lib/utils'
import type {
  MealPlan,
  PantryItem,
  Recipe,
  RecipeIngredient,
  ShoppingList,
  ShoppingListItem,
} from '../../types'

type PlannedRecipe = Recipe & { recipe_ingredients: RecipeIngredient[] }
type PlannedMeal = MealPlan & { recipes: PlannedRecipe | null }
type MarketData = {
  lists: ShoppingList[]
  items: ShoppingListItem[]
  pantry: PantryItem[]
  meals: PlannedMeal[]
}

const EMPTY: MarketData = { lists: [], items: [], pantry: [], meals: [] }

export default function MarketPage() {
  const { user } = useAuth()
  const { push } = useToast()
  const [itemModalOpen, setItemModalOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<ShoppingListItem | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ShoppingListItem | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [completeOpen, setCompleteOpen] = useState(false)
  const [updatePantry, setUpdatePantry] = useState(true)
  const [completing, setCompleting] = useState(false)
  const [busyItem, setBusyItem] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [creating, setCreating] = useState(false)
  const [reusingId, setReusingId] = useState<string | null>(null)

  const weekStart = startOfWeek(new Date())
  const weekEnd = endOfWeek(new Date())

  const query = useQuery<MarketData>(
    async () => {
      const client = db()
      const [lists, items, pantry, meals] = await Promise.all([
        client.from('shopping_lists').select('*').order('created_at', { ascending: false }),
        client.from('shopping_list_items').select('*').order('category').order('name'),
        client.from('pantry_items').select('*').order('name'),
        client
          .from('meal_plans')
          .select('*, recipes(id, name, servings, recipe_ingredients(*, foods(*)))')
          .gte('plan_date', toISODate(weekStart))
          .lte('plan_date', toISODate(weekEnd)),
      ])
      for (const result of [lists, items, pantry, meals]) {
        if (result.error) throw result.error
      }
      return {
        lists: (lists.data ?? []) as ShoppingList[],
        items: (items.data ?? []) as ShoppingListItem[],
        pantry: (pantry.data ?? []) as PantryItem[],
        meals: (meals.data ?? []) as PlannedMeal[],
      }
    },
    [toISODate(weekStart), toISODate(weekEnd)],
    EMPTY,
  )

  const openList = query.data.lists.find((list) => list.status === 'open') ?? null
  const completedLists = query.data.lists.filter((list) => list.status === 'completed').slice(0, 4)
  const items = useMemo(
    () => (openList ? query.data.items.filter((item) => item.list_id === openList.id) : []),
    [openList, query.data.items],
  )
  const unchecked = items.filter((item) => !item.is_checked)
  const checked = items.filter((item) => item.is_checked)
  const lastCompleted = completedLists.find((list) => query.data.items.some((item) => item.list_id === list.id)) ?? null
  const canRecover = Boolean(lastCompleted && (!openList || items.length === 0))
  const estimatedTotal = shoppingTotal(unchecked, 'estimated')
  const progress = percentage(checked.length, items.length)
  const itemKeys = new Set(items.map((item) => `${normalizeName(item.name)}|${item.unit}`))
  const suggestions = query.data.pantry.filter(
    (item) =>
      (pantryStatus(item) === 'low' || pantryStatus(item) === 'out') &&
      !itemKeys.has(`${normalizeName(item.name)}|${item.unit}`),
  )
  const plannedIngredients = useMemo(() => {
    const aggregate = new Map<
      string,
      { name: string; quantity: number; unit: string; category: string | null; estimated_price: number | null }
    >()
    query.data.meals.forEach((meal) => {
      if (!meal.recipes || meal.is_consumed) return
      const ratio = meal.servings / meal.recipes.servings
      meal.recipes.recipe_ingredients.forEach((ingredient) => {
        const key = `${normalizeName(ingredient.name)}|${ingredient.unit}`
        const quantity = ingredient.quantity * ratio
        const cost = ingredient.foods && ingredient.foods.price !== null
          ? foodCost(ingredient.foods, quantity, ingredient.unit)
          : null
        const existing = aggregate.get(key)
        if (existing) {
          existing.quantity += quantity
          if (cost !== null) existing.estimated_price = (existing.estimated_price ?? 0) + cost
        } else {
          aggregate.set(key, {
            name: ingredient.name,
            quantity,
            unit: ingredient.unit,
            category: ingredient.foods?.category ?? null,
            estimated_price: cost,
          })
        }
      })
    })
    return Array.from(aggregate.values())
  }, [query.data.meals])

  async function createList() {
    if (!user) return
    setCreating(true)
    try {
      const { error } = await db().from('shopping_lists').insert({ user_id: user.id, name: 'Mercado' })
      if (error) throw error
      push('Lista de mercado creada')
      query.reload()
    } catch (reason) {
      push(errorMessage(reason), 'error')
    } finally {
      setCreating(false)
    }
  }

  async function reuseList(list: ShoppingList, message = 'Lista reutilizada') {
    if (reusingId) return
    setReusingId(list.id)
    try {
      const { data, error } = await db().rpc('reuse_shopping_list', { p_source_list_id: list.id })
      if (error) throw error
      const result = data as { list_id: string; items: number } | null
      push(`${message} · ${result?.items ?? 0} productos`)
      query.reload()
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (reason) {
      push(errorMessage(reason), 'error')
    } finally {
      setReusingId(null)
    }
  }

  async function addItems(
    entries: Array<{ name: string; quantity: number; unit: string; category?: string | null; estimated_price?: number | null }>,
    successMessage: string,
  ) {
    if (!openList) return
    if (!entries.length) {
      push('No hay productos nuevos que añadir.', 'info')
      return
    }
    setAdding(true)
    try {
      const { error } = await db().rpc('add_shopping_items', {
        p_list_id: openList.id,
        p_items: entries,
      })
      if (error) throw error
      push(successMessage)
      query.reload()
    } catch (reason) {
      push(errorMessage(reason), 'error')
    } finally {
      setAdding(false)
    }
  }

  async function addFromPlan() {
    await addItems(
      plannedIngredients.map((ingredient) => ({
        name: ingredient.name,
        quantity: Math.round(ingredient.quantity * 100) / 100,
        unit: ingredient.unit,
        category: ingredient.category,
        estimated_price: ingredient.estimated_price,
      })),
      'Ingredientes del plan añadidos',
    )
  }

  async function addSuggestions() {
    await addItems(
      suggestions.map((item) => ({
        name: item.name,
        quantity: Math.max(1, Math.round((item.min_quantity * 2 - item.quantity) * 100) / 100),
        unit: item.unit,
        category: item.category,
      })),
      'Sugerencias añadidas al mercado',
    )
  }

  async function toggleItem(item: ShoppingListItem) {
    setBusyItem(item.id)
    try {
      const { error } = await db()
        .from('shopping_list_items')
        .update({ is_checked: !item.is_checked })
        .eq('id', item.id)
      if (error) throw error
      query.reload()
    } catch (reason) {
      push(errorMessage(reason), 'error')
    } finally {
      setBusyItem(null)
    }
  }

  async function deleteItem() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const { error } = await db().from('shopping_list_items').delete().eq('id', deleteTarget.id)
      if (error) throw error
      push('Producto eliminado')
      setDeleteTarget(null)
      setEditingItem(null)
      setItemModalOpen(false)
      query.reload()
    } catch (reason) {
      push(errorMessage(reason), 'error')
    } finally {
      setDeleting(false)
    }
  }

  async function completePurchase() {
    if (!openList) return
    setCompleting(true)
    try {
      const { data, error } = await db().rpc('complete_shopping_list', {
        p_list_id: openList.id,
        p_update_pantry: updatePantry,
      })
      if (error) throw error
      const result = data as { items_added: number; total: number; pantry_updated: boolean }
      push(
        `Compra completada · ${result.items_added} productos${result.pantry_updated ? ' y despensa actualizada' : ''}`,
      )
      setCompleteOpen(false)
      query.reload()
    } catch (reason) {
      push(errorMessage(reason), 'error')
    } finally {
      setCompleting(false)
    }
  }

  const groupedUnchecked = useMemo(() => {
    const map = new Map<string, ShoppingListItem[]>()
    unchecked.forEach((item) => {
      const category = item.category || 'Otros'
      map.set(category, [...(map.get(category) ?? []), item])
    })
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b))
  }, [unchecked])

  if (query.loading) return <LoadingState label="Cargando mercado" />
  if (query.error) return <ErrorState message={query.error} onRetry={query.reload} />

  return (
    <div className="space-y-5 animate-fade-up">
      <PageHeader
        eyebrow="Alimentación"
        title="Mercado"
        description="Una lista que se nutre del plan y de la despensa. Una compra, un único movimiento de stock."
        actions={
          <>
            {canRecover && lastCompleted && (
              <Button
                variant="secondary"
                onClick={() => reuseList(lastCompleted, 'Última lista recuperada')}
                loading={reusingId === lastCompleted.id}
              >
                <RotateCcw className="h-4 w-4" /> Recuperar última lista
              </Button>
            )}
            {openList ? (
              <Button
                variant="primary"
                onClick={() => {
                  setEditingItem(null)
                  setItemModalOpen(true)
                }}
              >
                <Plus className="h-4 w-4" /> Añadir producto
              </Button>
            ) : (
              <Button variant="primary" onClick={createList} loading={creating}>
                <Plus className="h-4 w-4" /> Crear lista
              </Button>
            )}
          </>
        }
      />

      {!openList ? (
        <Card>
          <EmptyState
            icon={<ShoppingCart className="h-5 w-5" />}
            title="No hay una lista abierta"
            description="Crea una lista para añadir productos manualmente, desde recetas planificadas o desde los mínimos de tu despensa."
            action={
              <div className="flex flex-wrap justify-center gap-2">
                {canRecover && lastCompleted && (
                  <Button
                    variant="secondary"
                    onClick={() => reuseList(lastCompleted, 'Última lista recuperada')}
                    loading={reusingId === lastCompleted.id}
                  >
                    <RotateCcw className="h-4 w-4" /> Recuperar última lista
                  </Button>
                )}
                <Button onClick={createList} loading={creating}>
                  <Plus className="h-4 w-4" /> Crear lista de mercado
                </Button>
              </div>
            }
          />
        </Card>
      ) : (
        <>
          <Card className="p-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-semibold text-white">{openList.name}</h2>
                  <Badge tone="accent">Abierta</Badge>
                </div>
                <p className="mt-1 text-[11px] text-zinc-500">
                  {items.length} productos · {checked.length} comprados · estimado pendiente {formatMoney(estimatedTotal)}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" size="sm" onClick={addFromPlan} loading={adding} disabled={!plannedIngredients.length}>
                  <Wand2 className="h-3.5 w-3.5" /> Del plan
                </Button>
                <Button variant="secondary" size="sm" onClick={addSuggestions} loading={adding} disabled={!suggestions.length}>
                  <Sparkles className="h-3.5 w-3.5" /> Reposición
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setCompleteOpen(true)}
                  disabled={!items.length}
                >
                  <Check className="h-3.5 w-3.5" /> Completar compra
                </Button>
              </div>
            </div>
            {items.length > 0 && (
              <div className="mt-4">
                <div className="mb-1.5 flex justify-between text-[10px] text-zinc-500">
                  <span>Progreso de compra</span>
                  <span className="text-lime">{Math.round(progress)}%</span>
                </div>
                <ProgressBar value={progress} />
              </div>
            )}
          </Card>

          <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
            <div className="space-y-4">
              {groupedUnchecked.length > 0 &&
                groupedUnchecked.map(([category, categoryItems]) => (
                  <section key={category}>
                    <div className="mb-2 flex items-center justify-between">
                      <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">{category}</h3>
                      <span className="text-[10px] text-zinc-700">{categoryItems.length}</span>
                    </div>
                    <Card className="divide-y divide-ink-700/60">
                      {categoryItems.map((item) => (
                        <div key={item.id} className="flex items-center gap-3 px-4 py-3">
                          <button
                            onClick={() => toggleItem(item)}
                            disabled={busyItem === item.id}
                            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-ink-600 text-transparent transition hover:border-lime/60 disabled:opacity-50"
                            aria-label="Marcar como comprado"
                          >
                            <Check className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              setEditingItem(item)
                              setItemModalOpen(true)
                            }}
                            className="min-w-0 flex-1 text-left"
                          >
                            <p className="truncate text-sm text-white">{item.name}</p>
                            <p className="mt-0.5 text-[11px] text-zinc-500">
                              {formatNumber(item.quantity)} {item.unit}
                              {item.estimated_price !== null && ` · ${formatMoney(item.estimated_price)} estimado`}
                              {item.estimated_price !== null && item.quantity > 0 &&
                                ` (${formatMoneyPrecise(item.estimated_price / item.quantity)} c/u)`}
                            </p>
                          </button>
                          <button
                            onClick={() => setDeleteTarget(item)}
                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-zinc-700 hover:bg-red-500/10 hover:text-red-400"
                            aria-label="Eliminar producto"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </Card>
                  </section>
                ))}

              {checked.length > 0 && (
                <section>
                  <div className="mb-2 flex items-center justify-between">
                    <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">Comprados</h3>
                    <span className="text-[10px] text-zinc-700">{checked.length}</span>
                  </div>
                  <Card className="divide-y divide-ink-700/60">
                    {checked.map((item) => (
                      <div key={item.id} className="flex items-center gap-3 px-4 py-3">
                        <button
                          onClick={() => toggleItem(item)}
                          disabled={busyItem === item.id}
                          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-lime bg-lime text-ink-950 disabled:opacity-50"
                          aria-label="Desmarcar"
                        >
                          <Check className="h-3.5 w-3.5" />
                        </button>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm text-zinc-500 line-through">{item.name}</p>
                          <p className="mt-0.5 text-[11px] text-zinc-600">
                            {formatNumber(item.quantity)} {item.unit}
                            {item.actual_price !== null && ` · ${formatMoney(item.actual_price)} real`}
                            {item.actual_price !== null && item.quantity > 0 &&
                              ` (${formatMoneyPrecise(item.actual_price / item.quantity)} c/u)`}
                          </p>
                        </div>
                        <button
                          onClick={() => {
                            setEditingItem(item)
                            setItemModalOpen(true)
                          }}
                          className="text-[10px] text-zinc-600 hover:text-white"
                        >
                          Editar
                        </button>
                      </div>
                    ))}
                  </Card>
                </section>
              )}

              {!items.length && (
                <Card>
                  <EmptyState
                    icon={<ShoppingCart className="h-5 w-5" />}
                    title="La lista está vacía"
                    description="Añade productos manualmente, desde las recetas de esta semana o desde los mínimos de la despensa."
                    action={
                      <div className="flex flex-wrap justify-center gap-2">
                        {canRecover && lastCompleted && (
                          <Button
                            variant="secondary"
                            onClick={() => reuseList(lastCompleted, 'Última lista recuperada')}
                            loading={reusingId === lastCompleted.id}
                          >
                            <RotateCcw className="h-4 w-4" /> Recuperar última lista
                          </Button>
                        )}
                        <Button
                          onClick={() => {
                            setEditingItem(null)
                            setItemModalOpen(true)
                          }}
                        >
                          <Plus className="h-4 w-4" /> Añadir producto
                        </Button>
                        <Button variant="secondary" onClick={addFromPlan} disabled={!plannedIngredients.length} loading={adding}>
                          <Wand2 className="h-4 w-4" /> Del plan
                        </Button>
                      </div>
                    }
                  />
                </Card>
              )}
            </div>

            <div className="space-y-4">
              <Card className="p-4">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-lime/10 text-lime">
                    <Sparkles className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-semibold text-white">Sugerencias de reposición</h3>
                    <p className="text-[10px] text-zinc-500">Según los mínimos de tu despensa</p>
                  </div>
                </div>
                {suggestions.length ? (
                  <div className="mt-3 space-y-2">
                    {suggestions.map((item) => (
                      <div key={item.id} className="flex items-center gap-2 rounded-lg border border-ink-700 bg-ink-900 px-2.5 py-2">
                        <Package className="h-3.5 w-3.5 shrink-0 text-amber-400" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[11px] text-zinc-300">{item.name}</p>
                          <p className="text-[9px] text-zinc-600">
                            {formatNumber(item.quantity)} / mín. {formatNumber(item.min_quantity)} {item.unit}
                          </p>
                        </div>
                        <button
                          onClick={() =>
                            addItems(
                              [
                                {
                                  name: item.name,
                                  quantity: Math.max(1, item.min_quantity * 2 - item.quantity),
                                  unit: item.unit,
                                  category: item.category,
                                },
                              ],
                              'Producto añadido',
                            )
                          }
                          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-zinc-500 hover:bg-ink-800 hover:text-lime"
                          aria-label="Añadir sugerencia"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                    <Button variant="secondary" size="sm" className="w-full" onClick={addSuggestions} loading={adding}>
                      Añadir todas
                    </Button>
                  </div>
                ) : (
                  <p className="mt-3 text-[11px] leading-relaxed text-zinc-600">
                    No hay productos por debajo del mínimo que no estén ya en la lista.
                  </p>
                )}
              </Card>

              <Card className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="muted-label">Estimado pendiente</p>
                    <p className="mt-1 text-lg font-semibold text-white">{formatMoney(estimatedTotal)}</p>
                  </div>
                  <ShoppingCart className="h-5 w-5 text-zinc-600" />
                </div>
                <div className="mt-3 border-t border-ink-700/60 pt-3 text-[11px] text-zinc-500">
                  Plan de esta semana: {plannedIngredients.length} ingredientes detectados.
                </div>
              </Card>
            </div>
          </div>
        </>
      )}

      {completedLists.length > 0 && (
        <section>
          <div className="mb-2 flex items-center justify-between gap-2">
            <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">Compras recientes</h2>
            <span className="text-[10px] text-zinc-600">Reutiliza para no empezar de cero</span>
          </div>
          <Card className="divide-y divide-ink-700/60">
            {completedLists.map((list) => {
              const listItems = query.data.items.filter((item) => item.list_id === list.id)
              const total = shoppingTotal(listItems, 'actual')
              return (
                <div key={list.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-ink-800 text-zinc-500">
                    <Check className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-white">{list.name}</p>
                    <p className="text-[10px] text-zinc-600">
                      {list.completed_at
                        ? new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }).format(
                            new Date(list.completed_at),
                          )
                        : ''}{' '}
                      · {listItems.length} productos
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-xs font-medium text-zinc-400">{formatMoney(total)}</p>
                    <button
                      onClick={() => reuseList(list)}
                      disabled={reusingId !== null}
                      className="mt-1 inline-flex items-center gap-1 text-[10px] text-lime transition hover:text-lime-soft disabled:opacity-50"
                    >
                      <RotateCcw className={reusingId === list.id ? 'h-3 w-3 animate-spin' : 'h-3 w-3'} />
                      {reusingId === list.id ? 'Reutilizando' : 'Reutilizar'}
                    </button>
                  </div>
                </div>
              )
            })}
          </Card>
        </section>
      )}

      <ShoppingItemModal
        open={itemModalOpen}
        onClose={() => {
          setItemModalOpen(false)
          setEditingItem(null)
        }}
        onSaved={query.reload}
        listId={openList?.id ?? null}
        item={editingItem}
        onDelete={(item) => setDeleteTarget(item)}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Eliminar producto"
        description="Se eliminará de la lista de mercado."
        onCancel={() => setDeleteTarget(null)}
        onConfirm={deleteItem}
        loading={deleting}
      />

      <Modal
        open={completeOpen}
        onClose={() => setCompleteOpen(false)}
        title="Completar compra"
        description="Esta acción cerrará la lista y no podrá repetirse."
        size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setCompleteOpen(false)}>
              Cancelar
            </Button>
            <Button variant="primary" onClick={completePurchase} loading={completing}>
              Confirmar compra
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="rounded-xl border border-ink-700 bg-ink-900 p-4">
            <div className="flex justify-between text-xs">
              <span className="text-zinc-500">Productos marcados</span>
              <span className="text-white">{checked.length}</span>
            </div>
            <div className="mt-2 flex justify-between text-xs">
              <span className="text-zinc-500">Coste real / estimado</span>
              <span className="text-white">{formatMoney(shoppingTotal(checked, 'actual'))}</span>
            </div>
          </div>
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-ink-700 bg-ink-900 p-3.5">
            <input
              type="checkbox"
              checked={updatePantry}
              onChange={(event) => setUpdatePantry(event.target.checked)}
              className="mt-0.5 h-4 w-4 accent-[#b8f36b]"
            />
            <span>
              <span className="block text-xs font-medium text-white">Actualizar despensa</span>
              <span className="mt-0.5 block text-[11px] leading-relaxed text-zinc-500">
                Suma las cantidades de los productos marcados a tus existencias. Si ya existe el producto con la misma unidad,
                se incrementa en lugar de duplicarse.
              </span>
            </span>
          </label>
          {!checked.length && (
            <p className="text-[11px] leading-relaxed text-amber-300/80">
              No has marcado productos. La lista se cerrará sin añadir nada a la despensa.
            </p>
          )}
        </div>
      </Modal>
    </div>
  )
}
