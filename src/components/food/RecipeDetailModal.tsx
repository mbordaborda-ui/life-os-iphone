import { CalendarPlus, Copy, Minus, Pencil, Plus, Star, Trash2, Users } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { RecipeWithIngredients } from '../../types'
import { foodCost, foodNutrition, recipeCost, recipeNutrition, scaleNutrition } from '../../lib/calculations'
import { formatMoney, formatNumber } from '../../lib/utils'
import { Badge, Button, Modal } from '../ui'

export function RecipeDetailModal({
  open,
  onClose,
  recipe,
  onEdit,
  onDuplicate,
  onDelete,
  onAddToPlanner,
  onToggleFavorite,
}: {
  open: boolean
  onClose: () => void
  recipe: RecipeWithIngredients | null
  onEdit: (recipe: RecipeWithIngredients) => void
  onDuplicate: (recipe: RecipeWithIngredients) => void
  onDelete: (recipe: RecipeWithIngredients) => void
  onAddToPlanner: (recipe: RecipeWithIngredients, servings: number) => void
  onToggleFavorite: (recipe: RecipeWithIngredients) => void
}) {
  const [servings, setServings] = useState(1)

  useEffect(() => {
    if (open && recipe) setServings(recipe.servings)
  }, [open, recipe])

  if (!recipe) return null
  const ratio = servings / recipe.servings
  const ingredients = recipe.recipe_ingredients.slice().sort((a, b) => a.position - b.position)
  const nutrition = recipeNutrition(recipe.recipe_ingredients, recipe.servings)
  const selectedNutrition = scaleNutrition(nutrition.perServing, servings)
  const cost = recipeCost(recipe.recipe_ingredients, recipe.servings)
  const selectedCost = cost.perServing * servings

  return (
    <Modal open={open} onClose={onClose} title={recipe.name} description={recipe.description ?? undefined} size="lg">
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-2">
          {recipe.prep_minutes !== null && <Badge tone="muted">{recipe.prep_minutes} min</Badge>}
          <Badge tone="muted">
            <Users className="h-3 w-3" /> {formatNumber(recipe.servings)} porciones base
          </Badge>
          {recipe.tags.map((tag) => (
            <Badge key={tag} tone="neutral">
              #{tag}
            </Badge>
          ))}
        </div>

        <div className="rounded-xl border border-ink-700 bg-ink-900 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="muted-label">Ajustar porciones</p>
              <p className="mt-1 text-xs text-zinc-500">Las cantidades se recalculan automáticamente.</p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="icon"
                onClick={() => setServings((value) => Math.max(0.5, Math.round((value - 0.5) * 10) / 10))}
                aria-label="Menos porciones"
              >
                <Minus className="h-4 w-4" />
              </Button>
              <span className="w-12 text-center text-sm font-semibold text-white">{formatNumber(servings)}</span>
              <Button
                variant="secondary"
                size="icon"
                onClick={() => setServings((value) => Math.round((value + 0.5) * 10) / 10)}
                aria-label="Más porciones"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-lime/15 bg-lime/[0.035] p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="muted-label">Nutrición calculada</p>
              <p className="mt-1 text-lg font-semibold text-white">
                {formatNumber(selectedNutrition.calories, 0)} kcal
              </p>
              <p className="text-[10px] text-zinc-500">
                para {formatNumber(servings)} porción{servings === 1 ? '' : 'es'}
              </p>
            </div>
            <div className="text-right text-[10px] tabular-nums text-zinc-400">
              <p>P {formatNumber(selectedNutrition.protein)} g</p>
              <p>C {formatNumber(selectedNutrition.carbs)} g</p>
              <p>G {formatNumber(selectedNutrition.fat)} g</p>
              <p>Fibra {formatNumber(selectedNutrition.fiber)} g</p>
            </div>
          </div>
          <p className="mt-3 border-t border-lime/10 pt-2 text-[10px] text-zinc-500">
            Por porción: {formatNumber(nutrition.perServing.calories, 0)} kcal · P{' '}
            {formatNumber(nutrition.perServing.protein)} g · C {formatNumber(nutrition.perServing.carbs)} g · G{' '}
            {formatNumber(nutrition.perServing.fat)} g
          </p>
          {nutrition.unresolved > 0 && (
            <p className="mt-1 text-[10px] text-amber-300/70">
              {nutrition.unresolved} ingrediente(s) sin datos nutricionales completos.
            </p>
          )}
          <div className="mt-3 flex items-center justify-between border-t border-lime/10 pt-2 text-[11px]">
            <span className="text-zinc-400">Costo total</span>
            <span className="font-semibold text-white">{formatMoney(selectedCost)}</span>
          </div>
          <div className="mt-1 flex items-center justify-between text-[11px]">
            <span className="text-zinc-500">Costo por porción</span>
            <span className="text-lime">{formatMoney(cost.perServing)}</span>
          </div>
          {cost.unresolved > 0 && (
            <p className="mt-1 text-[10px] text-amber-300/70">
              {cost.unresolved} ingrediente(s) sin precio. Añádelo en Alimentos para completar el costo.
            </p>
          )}
        </div>

        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">Ingredientes</h3>
          {ingredients.length ? (
            <div className="divide-y divide-ink-700/60 overflow-hidden rounded-xl border border-ink-700">
              {ingredients.map((ingredient) => (
                <div key={ingredient.id} className="flex items-center justify-between gap-3 px-3.5 py-2.5">
                  <div>
                    <p className="text-sm text-zinc-200">{ingredient.name}</p>
                    {ingredient.notes && <p className="mt-0.5 text-[10px] text-zinc-600">{ingredient.notes}</p>}
                  </div>
                  <span className="shrink-0 text-right text-xs tabular-nums text-zinc-500">
                    {formatNumber(ingredient.quantity * ratio, 2)} {ingredient.unit}
                    {ingredient.foods && (
                      <span className="ml-1 block text-[9px] text-zinc-600">
                        {formatNumber(
                          foodNutrition(ingredient.foods, ingredient.quantity * ratio, ingredient.unit).calories,
                          0,
                        )}{' '}
                        kcal
                      </span>
                    )}
                    {ingredient.foods && (
                      <span className="ml-1 block text-[9px] text-zinc-600">
                        {ingredient.foods.price === null
                          ? 'Sin precio'
                          : formatMoney(
                              foodCost(ingredient.foods, ingredient.quantity * ratio, ingredient.unit),
                            )}
                      </span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-zinc-600">Esta receta todavía no tiene ingredientes.</p>
          )}
        </div>

        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">Instrucciones</h3>
          <p className="whitespace-pre-wrap text-sm leading-6 text-zinc-400">
            {recipe.instructions || 'Sin instrucciones todavía.'}
          </p>
        </div>

        <div className="flex flex-wrap gap-2 border-t border-ink-700/60 pt-4">
          <Button variant="primary" onClick={() => onAddToPlanner(recipe, servings)}>
            <CalendarPlus className="h-4 w-4" /> Añadir al plan
          </Button>
          <Button variant="secondary" onClick={() => onEdit(recipe)}>
            <Pencil className="h-4 w-4" /> Editar
          </Button>
          <Button variant="secondary" onClick={() => onToggleFavorite(recipe)}>
            <Star className={recipe.is_favorite ? 'h-4 w-4 fill-lime text-lime' : 'h-4 w-4'} />
            {recipe.is_favorite ? 'Favorita' : 'Favorito'}
          </Button>
          <Button variant="ghost" onClick={() => onDuplicate(recipe)}>
            <Copy className="h-4 w-4" /> Duplicar
          </Button>
          <Button variant="ghost" onClick={() => onDelete(recipe)} className="ml-auto text-red-400 hover:text-red-300">
            <Trash2 className="h-4 w-4" /> Eliminar
          </Button>
        </div>
      </div>
    </Modal>
  )
}
