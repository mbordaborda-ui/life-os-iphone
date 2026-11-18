import { Plus, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import type { Category, MealPlan, MealType, Recipe } from '../../types'
import { useAuth } from '../../hooks/useAuth'
import { db } from '../../lib/supabase'
import { toNumber, errorMessage } from '../../lib/utils'
import { MEAL_LABELS, MEAL_TYPES } from '../../lib/constants'
import { Button, Field, Input, Modal, SearchSelect, Select, Textarea, useToast } from '../ui'

const MOMENT_ALIASES: Record<MealType, string[]> = {
  breakfast: ['desayuno'],
  lunch: ['almuerzo', 'comida'],
  dinner: ['cena'],
  snack: ['snack', 'merienda', 'tentempié', 'refrigerio'],
}

function normalizeText(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function matchesMoment(value: string, aliases: string[]) {
  const normalized = normalizeText(value)
  return aliases.some((alias) => {
    const target = normalizeText(alias)
    return normalized === target || normalized === `${target}s` || normalized.startsWith(`${target} `)
  })
}

export function MealPlanModal({
  open,
  onClose,
  onSaved,
  meal,
  recipes,
  categories,
  defaultDate,
  defaultMealType,
  onDelete,
}: {
  open: boolean
  onClose: () => void
  onSaved: () => void
  meal?: MealPlan | null
  recipes: Recipe[]
  categories: Category[]
  defaultDate: string
  defaultMealType?: MealType
  onDelete?: (meal: MealPlan) => void
}) {
  const { user } = useAuth()
  const { push } = useToast()
  const [date, setDate] = useState(defaultDate)
  const [mealType, setMealType] = useState<MealType>(defaultMealType ?? 'lunch')
  const [recipeId, setRecipeId] = useState('')
  const [title, setTitle] = useState('')
  const [servings, setServings] = useState('1')
  const [notes, setNotes] = useState('')
  const [filterByMoment, setFilterByMoment] = useState(true)
  const [registerNow, setRegisterNow] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    if (meal) {
      setDate(meal.plan_date)
      setMealType(meal.meal_type)
      setRecipeId(meal.recipe_id ?? '')
      setTitle(meal.title ?? '')
      setServings(String(meal.servings))
      setNotes(meal.notes ?? '')
    } else {
      setDate(defaultDate)
      setMealType(defaultMealType ?? 'lunch')
      setRecipeId('')
      setTitle('')
      setServings('1')
      setNotes('')
    }
    setFilterByMoment(true)
    setRegisterNow(false)
    setSaving(false)
  }, [open, meal, defaultDate, defaultMealType])

  const categoryNames = useMemo(
    () => new Map(categories.map((category) => [category.id, category.name])),
    [categories],
  )

  const filteredRecipes = useMemo(() => {
    if (!filterByMoment) return recipes
    const aliases = MOMENT_ALIASES[mealType]
    return recipes.filter((recipe) => {
      const categoryName = recipe.category_id ? categoryNames.get(recipe.category_id) : null
      if (categoryName) return matchesMoment(categoryName, aliases)
      return recipe.tags.some((tag) => matchesMoment(tag, aliases))
    })
  }, [recipes, categoryNames, mealType, filterByMoment])

  const recipeOptions = useMemo(() => {
    const options = filteredRecipes.map((recipe) => ({ value: recipe.id, label: recipe.name }))
    if (filterByMoment && recipeId && !options.some((option) => option.value === recipeId)) {
      const current = recipes.find((recipe) => recipe.id === recipeId)
      if (current) {
        return [
          {
            value: current.id,
            label: current.name,
            group: 'Receta actual',
            hint: `No es de ${MEAL_LABELS[mealType].toLowerCase()}`,
          },
          ...options,
        ]
      }
    }
    return options
  }, [filteredRecipes, filterByMoment, recipeId, recipes, mealType])

  function selectRecipe(value: string) {
    setRecipeId(value)
    if (value) {
      const recipe = recipes.find((item) => item.id === value)
      if (recipe) setServings(String(recipe.servings))
    }
  }

  async function persistMealPlan(recipeIdValue: string, freeTitle: string | null) {
    if (!user) throw new Error('No hay una sesión activa.')
    const payload = {
      user_id: user.id,
      plan_date: date,
      meal_type: mealType,
      recipe_id: recipeIdValue || null,
      title: freeTitle,
      servings: toNumber(servings, 1),
      notes: notes.trim() || null,
    }
    if (meal) {
      const { data, error } = await db()
        .from('meal_plans')
        .update(payload)
        .eq('id', meal.id)
        .select('id')
        .single()
      if (error) throw error
      if (!data) throw new Error('No se pudo guardar la comida planificada.')
      return data.id as string
    }
    const { data, error } = await db().from('meal_plans').insert(payload).select('id').single()
    if (error) throw error
    if (!data) throw new Error('No se pudo guardar la comida planificada.')
    return data.id as string
  }

  async function save() {
    if (!user) return
    if (!recipeId && !title.trim()) {
      push('Elige una receta o escribe un nombre.', 'error')
      return
    }
    if (toNumber(servings) <= 0) {
      push('Las raciones deben ser mayores que cero.', 'error')
      return
    }
    setSaving(true)
    try {
      const planId = await persistMealPlan(recipeId, recipeId ? null : title.trim())
      if (registerNow) {
        const { error } = await db().rpc('consume_meal_plan', { p_meal_plan_id: planId })
        if (error) {
          push('La comida se guardó en el plan, pero no se pudo registrar el consumo.', 'error')
          onSaved()
          onClose()
          return
        }
      }
      push(
        registerNow
          ? 'Comida registrada en el diario'
          : meal
            ? 'Comida actualizada'
            : 'Comida añadida al plan',
      )
      onSaved()
      onClose()
    } catch (reason) {
      push(errorMessage(reason), 'error')
    } finally {
      setSaving(false)
    }
  }

  async function createRecipeAndPlan() {
    if (!user) return
    const name = title.trim()
    if (!name) {
      push('Escribe el nombre de la comida para guardarla como receta.', 'error')
      return
    }
    if (toNumber(servings) <= 0) {
      push('Las raciones deben ser mayores que cero.', 'error')
      return
    }
    setSaving(true)
    try {
      const existing = recipes.find((recipe) => normalizeText(recipe.name) === normalizeText(name))
      let newRecipeId = existing?.id ?? ''
      let created = false
      if (!newRecipeId) {
        const momentCategory = categories.find((category) =>
          matchesMoment(category.name, MOMENT_ALIASES[mealType]),
        )
        const { data, error } = await db().rpc('save_recipe', {
          p_recipe_id: null,
          p_recipe: {
            name,
            description: null,
            instructions: '',
            prep_minutes: null,
            servings: toNumber(servings, 1),
            category_id: momentCategory?.id ?? null,
            is_favorite: false,
            tags: [momentCategory?.name.toLowerCase() ?? MEAL_LABELS[mealType].toLowerCase()],
          },
          p_ingredients: [],
        })
        if (error) throw error
        newRecipeId = data as string
        created = true
      }
      if (!newRecipeId) throw new Error('No se pudo crear la receta.')
      const planId = await persistMealPlan(newRecipeId, null)
      if (registerNow) {
        const { error } = await db().rpc('consume_meal_plan', { p_meal_plan_id: planId })
        if (error) {
          push('La receta y el plan se guardaron, pero no se pudo registrar el consumo.', 'error')
          onSaved()
          onClose()
          return
        }
      }
      const action = registerNow ? 'registrada en el diario' : 'añadida al plan'
      push(created ? `Receta creada y ${action}` : `Receta existente ${action}`)
      onSaved()
      onClose()
    } catch (reason) {
      push(errorMessage(reason), 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={meal ? 'Editar comida planificada' : 'Planificar comida'}
      size="md"
      footer={
        <div className="flex items-center justify-between gap-2">
          <div>
            {meal && onDelete && (
              <Button variant="ghost" size="sm" onClick={() => onDelete(meal)} className="text-red-400 hover:text-red-300">
                <Trash2 className="h-4 w-4" /> Eliminar
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>
              Cancelar
            </Button>
            <Button variant="primary" onClick={save} loading={saving}>
              {meal ? 'Guardar' : recipeId ? 'Añadir al plan' : 'Añadir sin receta'}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Fecha">
            <Input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          </Field>
          <Field label="Momento">
            <Select value={mealType} onChange={(event) => setMealType(event.target.value as MealType)}>
              {MEAL_TYPES.map((type) => (
                <option key={type} value={type}>
                  {MEAL_LABELS[type]}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field as="div" label="Receta">
          <SearchSelect
            value={recipeId}
            onChange={selectRecipe}
            options={recipeOptions}
            placeholder="Sin receta · comida libre"
            searchPlaceholder={
              filterByMoment ? `Buscar receta de ${MEAL_LABELS[mealType].toLowerCase()}…` : 'Buscar receta por nombre…'
            }
            clearLabel="Sin receta · comida libre"
            emptyMessage={
              filterByMoment
                ? `No hay recetas de ${MEAL_LABELS[mealType].toLowerCase()}.`
                : 'No hay recetas que coincidan.'
            }
            ariaLabel="Receta"
          />
          <label className="mt-2 flex cursor-pointer items-center gap-2 text-[11px] text-zinc-500">
            <input
              type="checkbox"
              checked={filterByMoment}
              onChange={(event) => setFilterByMoment(event.target.checked)}
              className="h-3.5 w-3.5 accent-[#b8f36b]"
            />
            Mostrar solo recetas de {MEAL_LABELS[mealType].toLowerCase()}
          </label>
          {filterByMoment && !recipeOptions.length && (
            <p className="mt-1.5 text-[11px] leading-relaxed text-amber-300/70">
              No hay recetas de {MEAL_LABELS[mealType].toLowerCase()}. Puedes crear una o desmarcar el filtro para ver
              todas.
            </p>
          )}
        </Field>
        {!recipeId && (
          <>
            <Field label="Nombre de la comida">
              <Input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Ej. Tostadas con aguacate"
              />
            </Field>
            <div className="rounded-xl border border-ink-700/70 bg-ink-900/60 p-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-medium text-zinc-300">¿No está en tus recetas?</p>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-zinc-500">
                    Guárdala con este nombre y quedará añadida al plan.
                  </p>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={createRecipeAndPlan}
                  loading={saving}
                  disabled={!title.trim()}
                  className="shrink-0"
                >
                  <Plus className="h-3.5 w-3.5" /> Crear receta y planificar
                </Button>
              </div>
              <p className="mt-1.5 text-[10px] leading-relaxed text-zinc-600">
                Se guardará como receta de {MEAL_LABELS[mealType].toLowerCase()} y podrás completar sus
                ingredientes desde Recetas.
              </p>
            </div>
          </>
        )}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Raciones">
            <Input
              type="number"
              min="0.1"
              step="0.1"
              value={servings}
              onChange={(event) => setServings(event.target.value)}
            />
          </Field>
          <Field
            as="div"
            label="Estado"
            hint={
              meal?.is_consumed
                ? 'Ya registrada como consumida.'
                : registerNow
                  ? 'Se añadirá al diario al guardar.'
                  : 'Se marcará desde el planificador.'
            }
          >
            <div className="flex h-11 items-center rounded-xl border border-ink-700 bg-ink-900 px-3.5 text-xs text-zinc-500">
              {meal?.is_consumed ? 'Consumida' : registerNow ? 'Se registrará al guardar' : 'Planificada'}
            </div>
            {!meal?.is_consumed && (
              <label className="mt-2 flex cursor-pointer items-center gap-2 text-[11px] text-zinc-500">
                <input
                  type="checkbox"
                  checked={registerNow}
                  onChange={(event) => setRegisterNow(event.target.checked)}
                  className="h-3.5 w-3.5 accent-[#b8f36b]"
                />
                Registrar consumo ahora
              </label>
            )}
          </Field>
        </div>
        <Field label="Notas">
          <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Opcional" className="min-h-20" />
        </Field>
        <p className="text-[11px] leading-relaxed text-zinc-600">
          Planificar no registra la comida. Marca «Registrar consumo ahora» o usa «Registrar» cuando la hayas
          consumido: así el plan y el diario no se confunden.
        </p>
      </div>
    </Modal>
  )
}
