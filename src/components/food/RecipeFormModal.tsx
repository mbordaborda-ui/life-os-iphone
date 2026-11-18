import { GripVertical, Plus, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import type { Category, RecipeWithIngredients } from '../../types'
import { useAuth } from '../../hooks/useAuth'
import { useFoods } from '../../hooks/useFoods'
import { db } from '../../lib/supabase'
import { foodCost, foodNutrition, scaleNutrition, sum, sumNutrition } from '../../lib/calculations'
import { errorMessage, formatMoney, formatNumber, splitTags, toNumber, uid } from '../../lib/utils'
import { CategoryPicker } from '../CategoryPicker'
import { Button, Field, Input, Modal, SearchSelect, Select, Textarea, useToast } from '../ui'
import { FoodFormModal } from './FoodFormModal'

type IngredientDraft = { key: string; foodId: string; quantity: string; unit: string; notes: string }

function emptyIngredient(): IngredientDraft {
  return { key: uid(), foodId: '', quantity: '100', unit: 'g', notes: '' }
}

export function RecipeFormModal({
  open,
  onClose,
  onSaved,
  recipe,
  categories,
  onCategoriesChanged,
}: {
  open: boolean
  onClose: () => void
  onSaved: () => void
  recipe?: RecipeWithIngredients | null
  categories: Category[]
  onCategoriesChanged: () => void
}) {
  const { user } = useAuth()
  const { push } = useToast()
  const foods = useFoods()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [instructions, setInstructions] = useState('')
  const [prepMinutes, setPrepMinutes] = useState('')
  const [servings, setServings] = useState('2')
  const [categoryId, setCategoryId] = useState<string | null>(null)
  const [tags, setTags] = useState('')
  const [favorite, setFavorite] = useState(false)
  const [ingredients, setIngredients] = useState<IngredientDraft[]>([emptyIngredient()])
  const [saving, setSaving] = useState(false)
  const [foodFormOpen, setFoodFormOpen] = useState(false)
  const [foodTargetKey, setFoodTargetKey] = useState<string | null>(null)

  const foodMap = useMemo(() => new Map(foods.data.map((food) => [food.id, food])), [foods.data])
  const foodOptions = useMemo(
    () =>
      foods.data.map((food) => ({
        value: food.id,
        label: food.name,
        group: food.category || 'Otros',
        hint: food.brand ?? undefined,
      })),
    [foods.data],
  )

  useEffect(() => {
    if (!open) return
    if (recipe) {
      setName(recipe.name)
      setDescription(recipe.description ?? '')
      setInstructions(recipe.instructions)
      setPrepMinutes(recipe.prep_minutes === null ? '' : String(recipe.prep_minutes))
      setServings(String(recipe.servings))
      setCategoryId(recipe.category_id)
      setTags(recipe.tags.join(', '))
      setFavorite(recipe.is_favorite)
      setIngredients(
        recipe.recipe_ingredients.length
          ? recipe.recipe_ingredients
              .slice()
              .sort((a, b) => a.position - b.position)
              .map((ingredient) => ({
                key: ingredient.id,
                foodId: ingredient.food_id,
                quantity: String(ingredient.quantity),
                unit: ingredient.unit,
                notes: ingredient.notes ?? '',
              }))
          : [emptyIngredient()],
      )
    } else {
      setName('')
      setDescription('')
      setInstructions('')
      setPrepMinutes('')
      setServings('2')
      setCategoryId(null)
      setTags('')
      setFavorite(false)
      setIngredients([emptyIngredient()])
    }
    setSaving(false)
    setFoodFormOpen(false)
    setFoodTargetKey(null)
  }, [open, recipe])

  function updateIngredient(key: string, values: Partial<IngredientDraft>) {
    setIngredients((current) => current.map((item) => (item.key === key ? { ...item, ...values } : item)))
  }

  function selectFood(key: string, foodId: string) {
    const food = foodMap.get(foodId)
    updateIngredient(key, { foodId, unit: food?.nutrition_unit ?? 'g' })
  }

  const preview = useMemo(() => {
    const values = ingredients
      .map((ingredient) => {
        const food = foodMap.get(ingredient.foodId)
        if (!food) return null
        return foodNutrition(food, toNumber(ingredient.quantity), ingredient.unit)
      })
      .filter((value): value is NonNullable<typeof value> => Boolean(value))
    const total = sumNutrition(values)
    const portionCount = toNumber(servings, 1)
    const portions = portionCount > 0 ? portionCount : 1
    const costValues = ingredients.map((ingredient) => {
      const food = foodMap.get(ingredient.foodId)
      if (!food || food.price === null) return null
      return foodCost(food, toNumber(ingredient.quantity), ingredient.unit)
    })
    const totalCost = sum(costValues.filter((value): value is number => value !== null))
    const pricedIngredients = ingredients.filter((ingredient) => {
      const food = foodMap.get(ingredient.foodId)
      return Boolean(food && food.price !== null)
    }).length
    const selectedIngredients = ingredients.filter((ingredient) => ingredient.foodId).length
    return {
      total,
      perServing: scaleNutrition(total, 1 / portions),
      totalCost,
      perServingCost: totalCost / portions,
      missingCost: selectedIngredients - pricedIngredients,
    }
  }, [ingredients, foodMap, servings])

  async function save() {
    if (!user) return
    if (!name.trim()) {
      push('El nombre de la receta es obligatorio.', 'error')
      return
    }
    if (toNumber(servings) <= 0) {
      push('Las porciones deben ser mayores que cero.', 'error')
      return
    }
    const selectedIngredients = ingredients.filter((ingredient) => ingredient.foodId)
    if (selectedIngredients.some((ingredient) => toNumber(ingredient.quantity) <= 0)) {
      push('Las cantidades de los ingredientes deben ser mayores que cero.', 'error')
      return
    }
    setSaving(true)
    try {
      const { error } = await db().rpc('save_recipe', {
        p_recipe_id: recipe?.id ?? null,
        p_recipe: {
          name: name.trim(),
          description: description.trim() || null,
          instructions: instructions.trim(),
          prep_minutes: prepMinutes.trim() === '' ? null : Math.round(toNumber(prepMinutes)),
          servings: toNumber(servings, 2),
          category_id: categoryId,
          is_favorite: favorite,
          tags: splitTags(tags),
        },
        p_ingredients: selectedIngredients.map((ingredient) => {
          const food = foodMap.get(ingredient.foodId)
          return {
            food_id: ingredient.foodId,
            name: food?.name ?? '',
            quantity: toNumber(ingredient.quantity),
            unit: ingredient.unit,
            notes: ingredient.notes.trim() || null,
          }
        }),
      })
      if (error) throw error
      push(recipe ? 'Receta actualizada' : 'Receta creada')
      onSaved()
      onClose()
    } catch (reason) {
      push(errorMessage(reason), 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title={recipe ? 'Editar receta' : 'Nueva receta'}
        description="Ingredientes para las porciones base. Podrás escalarlos después."
        size="lg"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={onClose}>
              Cancelar
            </Button>
            <Button variant="primary" onClick={save} loading={saving} disabled={!name.trim()}>
              {recipe ? 'Guardar receta' : 'Crear receta'}
            </Button>
          </div>
        }
      >
      <div className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-[1fr_120px]">
          <Field label="Nombre">
            <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Nombre de la receta" autoFocus />
          </Field>
          <Field label="Porciones base">
            <Input
              type="number"
              min="0.1"
              step="0.5"
              value={servings}
              onChange={(event) => setServings(event.target.value)}
            />
          </Field>
        </div>
        <Field label="Descripción breve">
          <Input value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Opcional" />
        </Field>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Tiempo (min)">
            <Input
              type="number"
              min="0"
              value={prepMinutes}
              onChange={(event) => setPrepMinutes(event.target.value)}
              placeholder="—"
            />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Categoría">
              <CategoryPicker
                categories={categories}
                value={categoryId}
                onChange={setCategoryId}
                kind="recipe"
                onCreated={onCategoriesChanged}
              />
            </Field>
          </div>
        </div>
        <Field label="Etiquetas" hint="Separadas por comas.">
          <Input value={tags} onChange={(event) => setTags(event.target.value)} placeholder="rápido, vegetariano, batch cooking" />
        </Field>

        <div>
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-xs font-medium uppercase tracking-[0.12em] text-zinc-500">Ingredientes</span>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setFoodTargetKey(ingredients[ingredients.length - 1]?.key ?? null)
                  setFoodFormOpen(true)
                }}
              >
                <Plus className="h-3.5 w-3.5" /> Alimento
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setIngredients((current) => [...current, emptyIngredient()])}
              >
                <Plus className="h-3.5 w-3.5" /> Línea
              </Button>
            </div>
          </div>

          {!foods.data.length && (
            <div className="mb-2 rounded-xl border border-amber-500/20 bg-amber-500/5 px-3 py-2.5 text-[11px] leading-relaxed text-amber-200/80">
              Todavía no tienes alimentos registrados. Crea el primero para poder añadirlo a la receta.
            </div>
          )}

          <div className="space-y-2">
            {ingredients.map((ingredient) => {
              const food = foodMap.get(ingredient.foodId)
              const nutrition = food ? foodNutrition(food, toNumber(ingredient.quantity), ingredient.unit) : null
              const cost = food ? foodCost(food, toNumber(ingredient.quantity), ingredient.unit) : null
              return (
                <div key={ingredient.key} className="rounded-xl border border-ink-700 bg-ink-900 p-2.5">
                  <div className="flex items-center gap-2">
                    <GripVertical className="h-4 w-4 shrink-0 text-zinc-700" />
                    <div className="min-w-0 flex-1">
                      <SearchSelect
                        value={ingredient.foodId}
                        onChange={(value) => selectFood(ingredient.key, value)}
                        options={foodOptions}
                        placeholder="Elegir alimento registrado…"
                        searchPlaceholder="Buscar alimento por nombre, marca o categoría…"
                        emptyMessage="No hay alimentos que coincidan."
                        size="sm"
                        ariaLabel="Alimento"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => setIngredients((current) => current.filter((item) => item.key !== ingredient.key))}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-zinc-600 hover:bg-red-500/10 hover:text-red-400"
                      aria-label="Eliminar ingrediente"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="mt-2 flex items-center gap-2 pl-6">
                    <Input
                      type="number"
                      min="0.001"
                      step="0.01"
                      value={ingredient.quantity}
                      onChange={(event) => updateIngredient(ingredient.key, { quantity: event.target.value })}
                      className="h-9 w-20"
                      aria-label="Cantidad"
                    />
                    <div className="w-20">
                      <Select
                        value={ingredient.unit}
                        onChange={(event) => updateIngredient(ingredient.key, { unit: event.target.value })}
                        className="h-9 text-xs"
                        disabled={!food}
                        aria-label="Unidad"
                      >
                        {food && <option value={food.nutrition_unit}>{food.nutrition_unit}</option>}
                        {food?.grams_per_unit && <option value="ud">ud</option>}
                      </Select>
                    </div>
                    <span className="ml-auto text-right text-[10px] tabular-nums">
                      <span className="block text-zinc-500">
                        {nutrition ? `${formatNumber(nutrition.calories, 0)} kcal` : 'Sin calcular'}
                      </span>
                      {food && (
                        <span className="block text-[9px] text-zinc-600">
                          {food.price === null ? 'Sin precio' : formatMoney(cost ?? 0)}
                        </span>
                      )}
                    </span>
                  </div>
                  <Input
                    value={ingredient.notes}
                    onChange={(event) => updateIngredient(ingredient.key, { notes: event.target.value })}
                    placeholder="Nota del ingrediente (opcional)"
                    className="mt-2 h-8 border-0 bg-transparent px-1 text-[11px] text-zinc-400"
                  />
                </div>
              )
            })}
          </div>

          <div className="mt-3 rounded-xl border border-lime/15 bg-lime/[0.035] p-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-zinc-400">Total de la receta</span>
              <span className="font-semibold text-white">{formatNumber(preview.total.calories, 0)} kcal</span>
            </div>
            <div className="mt-1 flex items-center justify-between text-[11px]">
              <span className="text-zinc-500">Por porción</span>
              <span className="text-lime">
                {formatNumber(preview.perServing.calories, 0)} kcal · P {formatNumber(preview.perServing.protein)} g · C{' '}
                {formatNumber(preview.perServing.carbs)} g · G {formatNumber(preview.perServing.fat)} g · Fibra{' '}
                {formatNumber(preview.perServing.fiber)} g
              </span>
            </div>
            <div className="mt-2 flex items-center justify-between border-t border-lime/10 pt-2 text-[11px]">
              <span className="text-zinc-500">Precio total</span>
              <span className="font-semibold text-white">{formatMoney(preview.totalCost)}</span>
            </div>
            <div className="mt-1 flex items-center justify-between text-[11px]">
              <span className="text-zinc-500">Precio por porción</span>
              <span className="text-lime">{formatMoney(preview.perServingCost)}</span>
            </div>
            {preview.missingCost > 0 && (
              <p className="mt-1 text-[10px] text-amber-300/70">
                {preview.missingCost} ingrediente(s) sin precio. Añádelo en Alimentos para completar el costo.
              </p>
            )}
          </div>
        </div>

        <Field label="Instrucciones">
          <Textarea
            value={instructions}
            onChange={(event) => setInstructions(event.target.value)}
            placeholder="Paso a paso…"
            className="min-h-36"
          />
        </Field>

        <label className="flex cursor-pointer items-center justify-between rounded-xl border border-ink-700 bg-ink-900 px-3.5 py-3">
          <span className="text-sm text-zinc-300">Marcar como favorita</span>
          <input
            type="checkbox"
            checked={favorite}
            onChange={(event) => setFavorite(event.target.checked)}
            className="h-4 w-4 accent-[#b8f36b]"
          />
        </label>
      </div>
      </Modal>

      <FoodFormModal
        open={foodFormOpen}
        onClose={() => setFoodFormOpen(false)}
        onSaved={(food) => {
          foods.reload()
          if (foodTargetKey) updateIngredient(foodTargetKey, { foodId: food.id, unit: food.nutrition_unit })
        }}
        food={null}
      />
    </>
  )
}
