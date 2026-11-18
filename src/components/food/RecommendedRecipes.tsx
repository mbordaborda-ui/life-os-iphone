import { Check, Clock3, Plus, Sparkles, Users } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Badge, Button, Card, Modal, useToast } from '../ui'
import { useAuth } from '../../hooks/useAuth'
import { db } from '../../lib/supabase'
import {
  BASIC_FOODS,
  basicFoodPrice,
  catalogCost,
  recommendedRecipeCost,
  recommendedRecipeNutrition,
  type RecommendedRecipe,
} from '../../lib/foodCatalog'
import { errorMessage, formatMoney, formatNumber } from '../../lib/utils'

function NutritionLine({ recipe }: { recipe: RecommendedRecipe }) {
  const nutrition = recommendedRecipeNutrition(recipe)
  const cost = recommendedRecipeCost(recipe)
  return (
    <>
      <p className="text-[10px] tabular-nums text-zinc-500">
        {formatNumber(nutrition.perServing.calories, 0)} kcal · P {formatNumber(nutrition.perServing.protein)} g · C{' '}
        {formatNumber(nutrition.perServing.carbs)} g · G {formatNumber(nutrition.perServing.fat)} g · Fibra{' '}
        {formatNumber(nutrition.perServing.fiber)} g
      </p>
      <p className="mt-1 text-[10px] tabular-nums text-zinc-500">
        {formatMoney(cost.total)} total · {formatMoney(cost.perServing)} por porción
      </p>
      {cost.unresolved > 0 && (
        <p className="mt-0.5 text-[9px] text-amber-300/70">{cost.unresolved} ingrediente(s) sin precio</p>
      )}
    </>
  )
}

export function RecommendedRecipes({
  recipes,
  existingNames,
  onImported,
}: {
  recipes: RecommendedRecipe[]
  existingNames: Set<string>
  onImported: () => void
}) {
  const { user } = useAuth()
  const { push } = useToast()
  const [selected, setSelected] = useState<RecommendedRecipe | null>(null)
  const [importing, setImporting] = useState<string | null>(null)

  const selectedNutrition = useMemo(
    () => (selected ? recommendedRecipeNutrition(selected) : null),
    [selected],
  )
  const selectedCost = useMemo(
    () => (selected ? recommendedRecipeCost(selected) : null),
    [selected],
  )

  async function importRecipe(recipe: RecommendedRecipe) {
    if (!user) return
    if (existingNames.has(recipe.name.toLowerCase())) {
      push('Esta receta ya está en tu recetario.', 'info')
      return
    }
    setImporting(recipe.slug)
    try {
      const ingredientFoods = Array.from(
        new Map(
          recipe.ingredients.map((ingredient) => {
            const food = BASIC_FOODS.find((item) => item.name === ingredient.food)
            if (!food) throw new Error(`Falta el alimento ${ingredient.food}`)
            return [food.name, food]
          }),
        ).values(),
      )

      const { error: foodsError } = await db()
        .from('foods')
        .upsert(
          ingredientFoods.map((food) => ({
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
          })),
          { onConflict: 'user_id,name', ignoreDuplicates: true },
        )
      if (foodsError) throw foodsError

      const names = ingredientFoods.map((food) => food.name)
      const { data: foods, error: lookupError } = await db()
        .from('foods')
        .select('id, name')
        .eq('user_id', user.id)
        .in('name', names)
      if (lookupError) throw lookupError
      const foodIds = new Map((foods ?? []).map((food) => [food.name, food.id]))

      const missing = recipe.ingredients.find((ingredient) => !foodIds.has(ingredient.food))
      if (missing) throw new Error(`No se pudo registrar ${missing.food}`)

      const { error } = await db().rpc('save_recipe', {
        p_recipe_id: null,
        p_recipe: {
          name: recipe.name,
          description: recipe.description,
          instructions: recipe.instructions,
          prep_minutes: recipe.prepMinutes,
          servings: recipe.servings,
          category_id: null,
          is_favorite: false,
          tags: recipe.tags,
        },
        p_ingredients: recipe.ingredients.map((ingredient) => ({
          food_id: foodIds.get(ingredient.food),
          name: ingredient.food,
          quantity: ingredient.quantity,
          unit: ingredient.unit,
          notes: ingredient.notes ?? null,
        })),
      })
      if (error) throw error
      push('Receta recomendada añadida a tu recetario')
      setSelected(null)
      onImported()
    } catch (reason) {
      push(errorMessage(reason), 'error')
    } finally {
      setImporting(null)
    }
  }

  return (
    <>
      <div className="rounded-2xl border border-lime/15 bg-lime/[0.035] px-4 py-3.5">
        <div className="flex items-start gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-lime/10 text-lime">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <p className="text-xs font-semibold text-white">Recetas recomendadas con nutrición calculada</p>
            <p className="mt-0.5 text-[11px] leading-relaxed text-zinc-500">
              Recetas reales con ingredientes, pasos y macros por porción. Al añadirlas, sus alimentos se registran
              automáticamente en tu catálogo.
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {recipes.map((recipe) => {
          const alreadyAdded = existingNames.has(recipe.name.toLowerCase())
          const busy = importing === recipe.slug
          return (
            <Card key={recipe.slug} className="flex flex-col overflow-hidden">
              <button onClick={() => setSelected(recipe)} className="flex-1 p-4 text-left">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold leading-snug text-white">{recipe.name}</h3>
                    <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-zinc-500">{recipe.description}</p>
                  </div>
                  <Sparkles className="h-4 w-4 shrink-0 text-lime" />
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-3 text-[10px] text-zinc-500">
                  <span className="inline-flex items-center gap-1">
                    <Clock3 className="h-3 w-3" /> {recipe.prepMinutes} min
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Users className="h-3 w-3" /> {recipe.servings} porciones
                  </span>
                  <span>{recipe.ingredients.length} ingr.</span>
                </div>
                <div className="mt-2">
                  <NutritionLine recipe={recipe} />
                </div>
                <div className="mt-3 flex flex-wrap gap-1">
                  {recipe.tags.slice(0, 3).map((tag) => (
                    <Badge key={tag} tone="muted">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </button>
              <div className="border-t border-ink-700/60 bg-ink-900/50 px-4 py-2">
                <Button
                  variant={alreadyAdded ? 'ghost' : 'primary'}
                  size="sm"
                  className="w-full"
                  onClick={() => importRecipe(recipe)}
                  loading={busy}
                  disabled={alreadyAdded}
                >
                  {alreadyAdded ? (
                    <>
                      <Check className="h-3.5 w-3.5" /> Ya en tu recetario
                    </>
                  ) : (
                    <>
                      <Plus className="h-3.5 w-3.5" /> Añadir a mis recetas
                    </>
                  )}
                </Button>
              </div>
            </Card>
          )
        })}
      </div>

      <Modal
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title={selected?.name ?? ''}
        description={selected?.description}
        size="lg"
        footer={
          selected ? (
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setSelected(null)}>
                Cerrar
              </Button>
              <Button
                variant="primary"
                onClick={() => importRecipe(selected)}
                loading={importing === selected.slug}
                disabled={existingNames.has(selected.name.toLowerCase())}
              >
                <Plus className="h-4 w-4" />
                {existingNames.has(selected.name.toLowerCase()) ? 'Ya en tu recetario' : 'Añadir a mis recetas'}
              </Button>
            </div>
          ) : null
        }
      >
        {selected && selectedNutrition && (
          <div className="space-y-5">
            <div className="flex flex-wrap gap-2">
              <Badge tone="muted">
                <Clock3 className="h-3 w-3" /> {selected.prepMinutes} min
              </Badge>
              <Badge tone="muted">
                <Users className="h-3 w-3" /> {selected.servings} porciones
              </Badge>
              {selected.tags.map((tag) => (
                <Badge key={tag} tone="neutral">
                  #{tag}
                </Badge>
              ))}
            </div>

            <div className="rounded-xl border border-lime/15 bg-lime/[0.035] p-4">
              <p className="muted-label">Por porción</p>
              <p className="mt-1 text-xl font-semibold text-white">
                {formatNumber(selectedNutrition.perServing.calories, 0)} kcal
              </p>
              <p className="mt-1 text-[11px] text-zinc-400">
                Proteína {formatNumber(selectedNutrition.perServing.protein)} g · Carbohidratos{' '}
                {formatNumber(selectedNutrition.perServing.carbs)} g · Grasas {formatNumber(selectedNutrition.perServing.fat)} g ·
                Fibra {formatNumber(selectedNutrition.perServing.fiber)} g
              </p>
              {selectedCost && (
                <div className="mt-3 flex items-center justify-between border-t border-lime/10 pt-2 text-[11px]">
                  <span className="text-zinc-500">Costo total</span>
                  <span className="font-semibold text-white">{formatMoney(selectedCost.total)}</span>
                </div>
              )}
              {selectedCost && (
                <div className="mt-1 flex items-center justify-between text-[11px]">
                  <span className="text-zinc-500">Costo por porción</span>
                  <span className="text-lime">{formatMoney(selectedCost.perServing)}</span>
                </div>
              )}
              {selectedCost && selectedCost.unresolved > 0 && (
                <p className="mt-1 text-[10px] text-amber-300/70">
                  {selectedCost.unresolved} ingrediente(s) sin precio.
                </p>
              )}
            </div>

            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">Ingredientes</h3>
              <div className="divide-y divide-ink-700/60 overflow-hidden rounded-xl border border-ink-700">
                {selected.ingredients.map((ingredient) => {
                  const food = BASIC_FOODS.find((item) => item.name === ingredient.food)
                  const cost = food ? catalogCost(food, ingredient.quantity, ingredient.unit) : null
                  return (
                    <div
                      key={`${ingredient.food}-${ingredient.unit}`}
                      className="flex items-center justify-between gap-3 px-3.5 py-2.5"
                    >
                      <span className="text-sm text-zinc-200">{ingredient.food}</span>
                      <span className="shrink-0 text-right text-xs tabular-nums text-zinc-500">
                        <span className="block">
                          {formatNumber(ingredient.quantity)} {ingredient.unit}
                        </span>
                        {cost !== null && <span className="block text-[9px] text-zinc-600">{formatMoney(cost)}</span>}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>

            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">Preparación</h3>
              <p className="whitespace-pre-wrap text-sm leading-6 text-zinc-400">{selected.instructions}</p>
            </div>

            <p className="text-[10px] leading-relaxed text-zinc-600">
              Valores calculados a partir de tablas de composición de alimentos. Pueden variar según la marca y la
              preparación.
            </p>
          </div>
        )}
      </Modal>
    </>
  )
}
