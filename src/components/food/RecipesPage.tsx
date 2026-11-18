import { BookOpen, Clock3, Copy, Plus, Search, Sparkles, Star, Users } from 'lucide-react'
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
import { AddToPlannerModal } from './AddToPlannerModal'
import { RecipeDetailModal } from './RecipeDetailModal'
import { RecipeFormModal } from './RecipeFormModal'
import { RecommendedRecipes } from './RecommendedRecipes'
import { useCategories } from '../../hooks/useCategories'
import { useQuery } from '../../hooks/useQuery'
import { db } from '../../lib/supabase'
import { recipeCost, recipeNutrition } from '../../lib/calculations'
import { RECOMMENDED_RECIPES } from '../../lib/foodCatalog'
import { errorMessage, formatMoney, formatNumber } from '../../lib/utils'
import type { Category, RecipeWithIngredients } from '../../types'

export default function RecipesPage() {
  const { push } = useToast()
  const [view, setView] = useState<'mine' | 'recommended'>('mine')
  const [search, setSearch] = useState('')
  const [favoritesOnly, setFavoritesOnly] = useState(false)
  const [tagFilter, setTagFilter] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<RecipeWithIngredients | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<RecipeWithIngredients | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [plannerRecipe, setPlannerRecipe] = useState<RecipeWithIngredients | null>(null)
  const [plannerServings, setPlannerServings] = useState(1)
  const categories = useCategories('recipe')

  const query = useQuery<RecipeWithIngredients[]>(
    async () => {
      const { data, error } = await db()
        .from('recipes')
        .select('*, recipe_ingredients(*, foods(*))')
        .order('is_favorite', { ascending: false })
        .order('name')
      if (error) throw error
      return (data ?? []) as RecipeWithIngredients[]
    },
    [],
    [],
  )

  const selected = query.data.find((recipe) => recipe.id === selectedId) ?? null
  const tags = useMemo(
    () => Array.from(new Set(query.data.flatMap((recipe) => recipe.tags))).sort((a, b) => a.localeCompare(b)),
    [query.data],
  )
  const existingNames = useMemo(
    () => new Set(query.data.map((recipe) => recipe.name.trim().toLowerCase())),
    [query.data],
  )

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return query.data
      .filter(
        (recipe) =>
          !term ||
          recipe.name.toLowerCase().includes(term) ||
          recipe.description?.toLowerCase().includes(term) ||
          recipe.recipe_ingredients.some((ingredient) => ingredient.name.toLowerCase().includes(term)),
      )
      .filter((recipe) => !favoritesOnly || recipe.is_favorite)
      .filter((recipe) => !tagFilter || recipe.tags.includes(tagFilter))
  }, [query.data, search, favoritesOnly, tagFilter])

  async function toggleFavorite(recipe: RecipeWithIngredients) {
    try {
      const { error } = await db().from('recipes').update({ is_favorite: !recipe.is_favorite }).eq('id', recipe.id)
      if (error) throw error
      query.reload()
    } catch (reason) {
      push(errorMessage(reason), 'error')
    }
  }

  async function duplicate(recipe: RecipeWithIngredients) {
    try {
      const { error } = await db().rpc('save_recipe', {
        p_recipe_id: null,
        p_recipe: {
          name: `${recipe.name} (copia)`,
          description: recipe.description,
          instructions: recipe.instructions,
          prep_minutes: recipe.prep_minutes,
          servings: recipe.servings,
          category_id: recipe.category_id,
          is_favorite: false,
          tags: recipe.tags,
        },
        p_ingredients: recipe.recipe_ingredients
          .slice()
          .sort((a, b) => a.position - b.position)
          .map((ingredient) => ({
            food_id: ingredient.food_id,
            name: ingredient.name,
            quantity: ingredient.quantity,
            unit: ingredient.unit,
            notes: ingredient.notes,
          })),
      })
      if (error) throw error
      push('Receta duplicada')
      setSelectedId(null)
      query.reload()
    } catch (reason) {
      push(errorMessage(reason), 'error')
    }
  }

  async function deleteRecipe() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const { error } = await db().from('recipes').delete().eq('id', deleteTarget.id)
      if (error) throw error
      push('Receta eliminada')
      setSelectedId(null)
      setDeleteTarget(null)
      query.reload()
    } catch (reason) {
      push(errorMessage(reason), 'error')
    } finally {
      setDeleting(false)
    }
  }

  function openNew() {
    setEditing(null)
    setFormOpen(true)
  }

  if (query.loading || categories.loading) return <LoadingState label="Cargando recetas" />
  if (query.error) return <ErrorState message={query.error} onRetry={query.reload} />

  return (
    <div className="space-y-5 animate-fade-up">
      <PageHeader
        eyebrow="Alimentación"
        title="Recetas"
        description="Tu recetario con nutrición automática, conectado al planificador y a la lista de mercado."
        actions={
          view === 'mine' ? (
            <Button variant="primary" onClick={openNew}>
              <Plus className="h-4 w-4" /> Nueva receta
            </Button>
          ) : undefined
        }
      />

      <div className="grid grid-cols-2 gap-1 rounded-xl border border-ink-700 bg-ink-900 p-1">
        <button
          onClick={() => setView('mine')}
          className={`inline-flex h-9 items-center justify-center gap-1.5 rounded-lg text-xs font-medium transition ${
            view === 'mine' ? 'bg-ink-750 text-white' : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          <BookOpen className="h-3.5 w-3.5" /> Mis recetas
        </button>
        <button
          onClick={() => setView('recommended')}
          className={`inline-flex h-9 items-center justify-center gap-1.5 rounded-lg text-xs font-medium transition ${
            view === 'recommended' ? 'bg-ink-750 text-white' : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          <Sparkles className="h-3.5 w-3.5" /> Recomendadas
        </button>
      </div>

      {view === 'recommended' ? (
        <RecommendedRecipes
          recipes={RECOMMENDED_RECIPES}
          existingNames={existingNames}
          onImported={() => {
            setView('mine')
            query.reload()
          }}
        />
      ) : (
        <>
      <Card className="space-y-2 p-3">
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-600" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por receta o ingrediente"
              className="pl-9"
            />
          </div>
          <Button
            variant={favoritesOnly ? 'primary' : 'secondary'}
            onClick={() => setFavoritesOnly((current) => !current)}
          >
            <Star className={favoritesOnly ? 'h-4 w-4 fill-current' : 'h-4 w-4'} /> Favoritas
          </Button>
        </div>
        {tags.length > 0 && (
          <div className="no-scrollbar flex gap-1.5 overflow-x-auto pt-1">
            <button
              onClick={() => setTagFilter('')}
              className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] ${!tagFilter ? 'bg-lime/10 text-lime' : 'bg-ink-800 text-zinc-500'}`}
            >
              Todas
            </button>
            {tags.map((tag) => (
              <button
                key={tag}
                onClick={() => setTagFilter(tag === tagFilter ? '' : tag)}
                className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] ${tagFilter === tag ? 'bg-lime/10 text-lime' : 'bg-ink-800 text-zinc-500'}`}
              >
                #{tag}
              </button>
            ))}
          </div>
        )}
      </Card>

      {filtered.length ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((recipe) => {
            const nutrition = recipeNutrition(recipe.recipe_ingredients, recipe.servings)
            const cost = recipeCost(recipe.recipe_ingredients, recipe.servings)
            return (
            <Card
              key={recipe.id}
              className="group cursor-pointer overflow-hidden transition hover:border-ink-600"
              onClick={() => setSelectedId(recipe.id)}
            >
              <div className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="truncate text-sm font-semibold text-white">{recipe.name}</h3>
                      {recipe.is_favorite && <Star className="h-3.5 w-3.5 shrink-0 fill-lime text-lime" />}
                    </div>
                    <p className="mt-1 line-clamp-2 min-h-8 text-[11px] leading-relaxed text-zinc-500">
                      {recipe.description || 'Sin descripción'}
                    </p>
                  </div>
                  <button
                    onClick={(event) => {
                      event.stopPropagation()
                      toggleFavorite(recipe)
                    }}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-zinc-600 transition hover:bg-ink-800 hover:text-lime"
                    aria-label={recipe.is_favorite ? 'Quitar de favoritas' : 'Marcar como favorita'}
                  >
                    <Star className={`h-4 w-4 ${recipe.is_favorite ? 'fill-lime text-lime' : ''}`} />
                  </button>
                </div>
                <div className="mt-3 flex items-center gap-3 text-[10px] text-zinc-500">
                  {recipe.prep_minutes !== null && (
                    <span className="inline-flex items-center gap-1">
                      <Clock3 className="h-3 w-3" /> {recipe.prep_minutes} min
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1">
                    <Users className="h-3 w-3" /> {formatNumber(recipe.servings)}
                  </span>
                  <span>{recipe.recipe_ingredients.length} ingr.</span>
                </div>
                <div className="mt-3 rounded-lg border border-ink-700/60 bg-ink-900/50 px-2.5 py-2">
                  <p className="text-[11px] font-medium text-lime">
                    {formatNumber(nutrition.perServing.calories, 0)} kcal por porción
                  </p>
                  <p className="mt-0.5 text-[10px] tabular-nums text-zinc-500">
                    P {formatNumber(nutrition.perServing.protein)} g · C {formatNumber(nutrition.perServing.carbs)} g · G{' '}
                    {formatNumber(nutrition.perServing.fat)} g · Fibra {formatNumber(nutrition.perServing.fiber)} g
                  </p>
                  <p className="mt-1 text-[10px] tabular-nums text-zinc-500">
                    {formatMoney(cost.total)} total · {formatMoney(cost.perServing)} por porción
                  </p>
                  {cost.unresolved > 0 && (
                    <p className="mt-1 text-[9px] text-amber-300/70">{cost.unresolved} ingrediente(s) sin precio</p>
                  )}
                  {nutrition.unresolved > 0 && (
                    <p className="mt-1 text-[9px] text-amber-300/70">{nutrition.unresolved} ingrediente(s) sin calcular</p>
                  )}
                </div>
                {recipe.tags.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1">
                    {recipe.tags.slice(0, 3).map((tag) => (
                      <Badge key={tag} tone="muted">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex items-center justify-between border-t border-ink-700/60 bg-ink-900/50 px-4 py-2">
                <button
                  onClick={(event) => {
                    event.stopPropagation()
                    setPlannerRecipe(recipe)
                    setPlannerServings(recipe.servings)
                  }}
                  className="text-[10px] font-medium text-lime hover:text-lime-soft"
                >
                  Añadir al plan
                </button>
                <button
                  onClick={(event) => {
                    event.stopPropagation()
                    duplicate(recipe)
                  }}
                  className="inline-flex items-center gap-1 text-[10px] text-zinc-500 hover:text-white"
                >
                  <Copy className="h-3 w-3" /> Duplicar
                </button>
              </div>
            </Card>
            )
          })}
        </div>
      ) : (
        <Card>
          <EmptyState
            icon={<BookOpen className="h-5 w-5" />}
            title={query.data.length ? 'No hay recetas con estos filtros' : 'Tu recetario está vacío'}
            description={
              query.data.length
                ? 'Prueba con otra búsqueda, etiqueta o desactiva favoritas.'
                : 'Crea tu primera receta con ingredientes y porciones. Después podrás planificarla y escalar cantidades.'
            }
            action={
              query.data.length ? (
                <Button
                  variant="secondary"
                  onClick={() => {
                    setSearch('')
                    setFavoritesOnly(false)
                    setTagFilter('')
                  }}
                >
                  Limpiar filtros
                </Button>
              ) : (
                <Button onClick={openNew}>
                  <Plus className="h-4 w-4" /> Crear receta
                </Button>
              )
            }
          />
        </Card>
      )}
        </>
      )}

      <RecipeFormModal
        open={formOpen}
        onClose={() => {
          setFormOpen(false)
          setEditing(null)
        }}
        onSaved={query.reload}
        recipe={editing}
        categories={categories.data as Category[]}
        onCategoriesChanged={categories.reload}
      />

      <RecipeDetailModal
        open={Boolean(selected)}
        onClose={() => setSelectedId(null)}
        recipe={selected}
        onEdit={(recipe) => {
          setSelectedId(null)
          setEditing(recipe)
          setFormOpen(true)
        }}
        onDuplicate={duplicate}
        onDelete={(recipe) => setDeleteTarget(recipe)}
        onAddToPlanner={(recipe, portions) => {
          setPlannerRecipe(recipe)
          setPlannerServings(portions)
        }}
        onToggleFavorite={toggleFavorite}
      />

      <AddToPlannerModal
        open={Boolean(plannerRecipe)}
        onClose={() => setPlannerRecipe(null)}
        onSaved={query.reload}
        recipe={plannerRecipe}
        servings={plannerServings}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Eliminar receta"
        description="Se eliminará la receta y sus ingredientes. Las comidas ya planificadas conservarán su nombre como comida libre."
        onCancel={() => setDeleteTarget(null)}
        onConfirm={deleteRecipe}
        loading={deleting}
      />
    </div>
  )
}
