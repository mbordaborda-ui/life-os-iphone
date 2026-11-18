import { Apple, Database, Pencil, Plus, Search, Trash2 } from 'lucide-react'
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
  useToast,
} from '../ui'
import { FoodFormModal } from './FoodFormModal'
import { useAuth } from '../../hooks/useAuth'
import { useFoods } from '../../hooks/useFoods'
import { db } from '../../lib/supabase'
import { BASIC_FOODS, basicFoodPrice } from '../../lib/foodCatalog'
import { errorMessage, formatMoney, formatNumber } from '../../lib/utils'
import type { Food } from '../../types'

function nutrient(value: number | null, suffix = 'g') {
  return value === null ? '—' : `${formatNumber(value)} ${suffix}`
}

export default function FoodsPage() {
  const { user } = useAuth()
  const { push } = useToast()
  const foods = useFoods()
  const [search, setSearch] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Food | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Food | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [loadingBasics, setLoadingBasics] = useState(false)

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return foods.data
    return foods.data.filter(
      (food) =>
        food.name.toLowerCase().includes(term) ||
        food.brand?.toLowerCase().includes(term) ||
        food.category?.toLowerCase().includes(term),
    )
  }, [foods.data, search])

  const grouped = useMemo(() => {
    const map = new Map<string, Food[]>()
    filtered.forEach((food) => {
      const category = food.category || 'Otros'
      map.set(category, [...(map.get(category) ?? []), food])
    })
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b))
  }, [filtered])

  async function loadBasics() {
    if (!user) return
    setLoadingBasics(true)
    try {
      const payload = BASIC_FOODS.map((food) => ({
        user_id: user.id,
        name: food.name,
        brand: null,
        category: food.category,
        nutrition_unit: food.nutritionUnit,
        reference_amount: 100,
        calories: food.calories,
        protein_g: food.protein,
        carbs_g: food.carbs,
        fat_g: food.fat,
        fiber_g: food.fiber,
        grams_per_unit: food.gramsPerUnit ?? null,
        price: basicFoodPrice(food.name),
        notes: null,
      }))
      const { error } = await db().from('foods').upsert(payload, {
        onConflict: 'user_id,name',
        ignoreDuplicates: true,
      })
      if (error) throw error
      push('Alimentos básicos disponibles. Los que ya tenías se han conservado.')
      foods.reload()
    } catch (reason) {
      push(errorMessage(reason), 'error')
    } finally {
      setLoadingBasics(false)
    }
  }

  async function deleteFood() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const { error } = await db().from('foods').delete().eq('id', deleteTarget.id)
      if (error) throw error
      push('Alimento eliminado')
      setDeleteTarget(null)
      foods.reload()
    } catch (reason) {
      const message = errorMessage(reason)
      push(
        message.includes('recipe_ingredients_food_fk')
          ? 'No se puede eliminar: este alimento se usa en una receta.'
          : message,
        'error',
      )
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-5 animate-fade-up">
      <PageHeader
        eyebrow="Alimentación"
        title="Alimentos"
        description="El catálogo que alimenta tus recetas, el plan y el registro nutricional. Todo se calcula a partir de estos valores."
        actions={
          <>
            <Button variant="secondary" onClick={loadBasics} loading={loadingBasics}>
              <Database className="h-4 w-4" /> Cargar básicos
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                setEditing(null)
                setFormOpen(true)
              }}
            >
              <Plus className="h-4 w-4" /> Nuevo alimento
            </Button>
          </>
        }
      />

      <Card className="p-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-600" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar alimento, marca o categoría"
            className="pl-9"
          />
        </div>
      </Card>

      {foods.loading ? (
        <LoadingState label="Cargando alimentos" />
      ) : foods.error ? (
        <ErrorState message={foods.error} onRetry={foods.reload} />
      ) : !foods.data.length ? (
        <Card>
          <EmptyState
            icon={<Apple className="h-5 w-5" />}
            title="Tu catálogo está vacío"
            description="Registra alimentos con sus valores nutricionales o carga una base de alimentos comunes para empezar."
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Button onClick={loadBasics} loading={loadingBasics}>
                  <Database className="h-4 w-4" /> Cargar alimentos básicos
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setEditing(null)
                    setFormOpen(true)
                  }}
                >
                  <Plus className="h-4 w-4" /> Crear alimento
                </Button>
              </div>
            }
          />
        </Card>
      ) : !filtered.length ? (
        <Card>
          <EmptyState
            icon={<Search className="h-5 w-5" />}
            title="Sin resultados"
            description="No hay alimentos que coincidan con esta búsqueda."
            action={
              <Button variant="secondary" onClick={() => setSearch('')}>
                Limpiar búsqueda
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="space-y-4">
          {grouped.map(([category, categoryFoods]) => (
            <section key={category}>
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">{category}</h2>
                <Badge tone="muted">{categoryFoods.length}</Badge>
              </div>
              <Card className="divide-y divide-ink-700/60">
                {categoryFoods.map((food) => (
                  <div key={food.id} className="flex items-start gap-3 px-4 py-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-ink-800 text-lime">
                      <Apple className="h-4 w-4" />
                    </div>
                    <button
                      onClick={() => {
                        setEditing(food)
                        setFormOpen(true)
                      }}
                      className="min-w-0 flex-1 text-left"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-medium text-white">{food.name}</p>
                        {food.brand && <span className="text-[10px] text-zinc-600">{food.brand}</span>}
                      </div>
                      <div className="mt-0.5 flex flex-wrap gap-x-2 gap-y-0.5 text-[11px] text-zinc-500">
                        <span>{nutrient(food.calories, 'kcal')}</span>
                        <span>P {nutrient(food.protein_g)}</span>
                        <span>C {nutrient(food.carbs_g)}</span>
                        <span>G {nutrient(food.fat_g)}</span>
                        <span>Fibra {nutrient(food.fiber_g)}</span>
                      </div>
                      <p className="mt-0.5 text-[10px] text-zinc-600">
                        {food.price === null
                          ? `Sin precio · por 100 ${food.nutrition_unit === 'ml' ? 'ml' : 'g'}`
                          : `${formatMoney(food.price)} por 100 ${food.nutrition_unit === 'ml' ? 'ml' : 'g'}`}
                        {food.grams_per_unit ? ` · 1 ud ≈ ${formatNumber(food.grams_per_unit)} ${food.nutrition_unit}` : ''}
                      </p>
                    </button>
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        onClick={() => {
                          setEditing(food)
                          setFormOpen(true)
                        }}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-600 hover:bg-ink-800 hover:text-white"
                        aria-label="Editar alimento"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(food)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-700 hover:bg-red-500/10 hover:text-red-400"
                        aria-label="Eliminar alimento"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </Card>
            </section>
          ))}
        </div>
      )}

      <p className="px-1 text-[10px] leading-relaxed text-zinc-700">
        Los valores son una referencia por 100 g/ml y pueden variar según la marca o la preparación.
      </p>

      <FoodFormModal
        open={formOpen}
        onClose={() => {
          setFormOpen(false)
          setEditing(null)
        }}
        onSaved={() => foods.reload()}
        food={editing}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Eliminar alimento"
        description="Si el alimento se usa en una receta no se podrá eliminar. Los registros del diario conservarán sus valores."
        onCancel={() => setDeleteTarget(null)}
        onConfirm={deleteFood}
        loading={deleting}
      />
    </div>
  )
}
