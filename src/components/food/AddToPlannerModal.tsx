import { useEffect, useState } from 'react'
import type { MealType, RecipeWithIngredients } from '../../types'
import { useAuth } from '../../hooks/useAuth'
import { db } from '../../lib/supabase'
import { toISODate } from '../../lib/dates'
import { MEAL_LABELS, MEAL_TYPES } from '../../lib/constants'
import { toNumber, errorMessage } from '../../lib/utils'
import { Button, Field, Input, Modal, Select, useToast } from '../ui'

export function AddToPlannerModal({
  open,
  onClose,
  onSaved,
  recipe,
  servings,
}: {
  open: boolean
  onClose: () => void
  onSaved: () => void
  recipe: RecipeWithIngredients | null
  servings: number
}) {
  const { user } = useAuth()
  const { push } = useToast()
  const [date, setDate] = useState(toISODate(new Date()))
  const [mealType, setMealType] = useState<MealType>('lunch')
  const [portionValue, setPortionValue] = useState(String(servings))
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setDate(toISODate(new Date()))
      setMealType('lunch')
      setPortionValue(String(servings))
      setSaving(false)
    }
  }, [open, servings])

  async function save() {
    if (!user || !recipe) return
    if (toNumber(portionValue) <= 0) {
      push('Las raciones deben ser mayores que cero.', 'error')
      return
    }
    setSaving(true)
    try {
      const { error } = await db().from('meal_plans').insert({
        user_id: user.id,
        plan_date: date,
        meal_type: mealType,
        recipe_id: recipe.id,
        servings: toNumber(portionValue, recipe.servings),
      })
      if (error) throw error
      push('Receta añadida al planificador')
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
      title="Añadir al planificador"
      description={recipe ? recipe.name : undefined}
      size="sm"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={save} loading={saving}>
            Añadir al plan
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <Field label="Día">
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
        <Field label="Raciones">
          <Input
            type="number"
            min="0.1"
            step="0.1"
            value={portionValue}
            onChange={(event) => setPortionValue(event.target.value)}
          />
        </Field>
      </div>
    </Modal>
  )
}
