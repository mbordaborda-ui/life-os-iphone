import { Info, Plus, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import type { FoodLog, MealType } from '../../types'
import { useAuth } from '../../hooks/useAuth'
import { useFoods } from '../../hooks/useFoods'
import { db } from '../../lib/supabase'
import { foodNutrition } from '../../lib/calculations'
import { toNumber, errorMessage, formatNumber } from '../../lib/utils'
import { MEAL_LABELS, MEAL_TYPES } from '../../lib/constants'
import { Button, Field, Input, Modal, SearchSelect, Select, Textarea, useToast } from '../ui'
import { FoodFormModal } from './FoodFormModal'

export function FoodLogModal({
  open,
  onClose,
  onSaved,
  log,
  defaultDate,
  onDelete,
}: {
  open: boolean
  onClose: () => void
  onSaved: () => void
  log?: FoodLog | null
  defaultDate: string
  onDelete?: (log: FoodLog) => void
}) {
  const { user } = useAuth()
  const { push } = useToast()
  const foods = useFoods()
  const [date, setDate] = useState(defaultDate)
  const [mealType, setMealType] = useState<MealType>('lunch')
  const [foodId, setFoodId] = useState('')
  const [manualMode, setManualMode] = useState(false)
  const [foodName, setFoodName] = useState('')
  const [quantity, setQuantity] = useState('100')
  const [unit, setUnit] = useState('g')
  const [notes, setNotes] = useState('')
  const [calories, setCalories] = useState('')
  const [protein, setProtein] = useState('')
  const [carbs, setCarbs] = useState('')
  const [fat, setFat] = useState('')
  const [fiber, setFiber] = useState('')
  const [saving, setSaving] = useState(false)
  const [foodFormOpen, setFoodFormOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    if (log) {
      setDate(log.log_date)
      setMealType(log.meal_type)
      setFoodId(log.food_id ?? '')
      setManualMode(!log.food_id)
      setFoodName(log.food_name)
      setQuantity(String(log.quantity))
      setUnit(log.unit)
      setNotes(log.notes ?? '')
      setCalories(log.calories === null ? '' : String(log.calories))
      setProtein(log.protein_g === null ? '' : String(log.protein_g))
      setCarbs(log.carbs_g === null ? '' : String(log.carbs_g))
      setFat(log.fat_g === null ? '' : String(log.fat_g))
      setFiber(log.fiber_g === null ? '' : String(log.fiber_g))
    } else {
      setDate(defaultDate)
      setMealType('lunch')
      setFoodId('')
      setManualMode(false)
      setFoodName('')
      setQuantity('100')
      setUnit('g')
      setNotes('')
      setCalories('')
      setProtein('')
      setCarbs('')
      setFat('')
      setFiber('')
    }
    setSaving(false)
    setFoodFormOpen(false)
  }, [open, log, defaultDate])

  const food = useMemo(() => foods.data.find((item) => item.id === foodId) ?? null, [foods.data, foodId])
  const calculated = useMemo(
    () => (food ? foodNutrition(food, toNumber(quantity), unit) : null),
    [food, quantity, unit],
  )
  const foodOptions = useMemo(
    () =>
      foods.data.map((item) => ({
        value: item.id,
        label: item.name,
        group: item.category || 'Otros',
        hint: item.brand ?? undefined,
      })),
    [foods.data],
  )

  function chooseFood(nextFoodId: string) {
    const next = foods.data.find((item) => item.id === nextFoodId)
    setFoodId(nextFoodId)
    if (next) setUnit(next.nutrition_unit)
  }

  const optionalNumber = (value: string) => (value.trim() === '' ? null : toNumber(value))

  async function save() {
    if (!user) return
    if (!manualMode && !food) {
      push('Selecciona un alimento registrado.', 'error')
      return
    }
    if (manualMode && !foodName.trim()) {
      push('Escribe el nombre del registro.', 'error')
      return
    }
    if (toNumber(quantity) <= 0) {
      push('La cantidad debe ser mayor que cero.', 'error')
      return
    }
    setSaving(true)
    try {
      const payload = {
        user_id: user.id,
        log_date: date,
        meal_type: mealType,
        food_id: manualMode ? null : foodId,
        food_name: manualMode ? foodName.trim() : food?.name ?? '',
        quantity: toNumber(quantity, 1),
        unit: manualMode ? unit.trim() || 'ud' : unit,
        notes: notes.trim() || null,
        calories: manualMode ? optionalNumber(calories) : calculated?.calories ?? null,
        protein_g: manualMode ? optionalNumber(protein) : calculated?.protein ?? null,
        carbs_g: manualMode ? optionalNumber(carbs) : calculated?.carbs ?? null,
        fat_g: manualMode ? optionalNumber(fat) : calculated?.fat ?? null,
        fiber_g: manualMode ? optionalNumber(fiber) : calculated?.fiber ?? null,
      }
      if (log) {
        const { error } = await db().from('food_logs').update(payload).eq('id', log.id)
        if (error) throw error
      } else {
        const { error } = await db().from('food_logs').insert(payload)
        if (error) throw error
      }
      push(log ? 'Registro actualizado' : 'Alimento registrado')
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
        title={log ? 'Editar registro' : 'Registrar alimento'}
        description={
          manualMode
            ? 'Registro generado desde el plan. Puedes ajustar la cantidad y los valores.'
            : 'Elige un alimento del catálogo y LIFE OS calcula los macros automáticamente.'
        }
        size="lg"
        footer={
          <div className="flex items-center justify-between gap-2">
            <div>
              {log && onDelete && (
                <Button variant="ghost" size="sm" onClick={() => onDelete(log)} className="text-red-400 hover:text-red-300">
                  <Trash2 className="h-4 w-4" /> Eliminar
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={onClose}>
                Cancelar
              </Button>
              <Button variant="primary" onClick={save} loading={saving} disabled={!manualMode && !food}>
                {log ? 'Guardar cambios' : 'Registrar'}
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

          {manualMode ? (
            <Field label="Alimento o plato">
              <Input value={foodName} onChange={(event) => setFoodName(event.target.value)} placeholder="Ej. Arroz con pollo" />
            </Field>
          ) : (
            <div className="space-y-2">
              <Field as="div" label="Alimento registrado">
                <SearchSelect
                  value={foodId}
                  onChange={chooseFood}
                  options={foodOptions}
                  placeholder="Elegir alimento…"
                  searchPlaceholder="Buscar alimento por nombre, marca o categoría…"
                  emptyMessage="No hay alimentos que coincidan."
                  disabled={foods.loading}
                  ariaLabel="Alimento registrado"
                />
              </Field>
              <div className="flex items-center justify-between gap-2">
                <p className="text-[10px] leading-relaxed text-zinc-600">
                  {foods.data.length
                    ? 'El alimento debe estar registrado para calcular sus macros.'
                    : 'Todavía no tienes alimentos registrados.'}
                </p>
                <Button variant="ghost" size="sm" className="shrink-0 whitespace-nowrap" onClick={() => setFoodFormOpen(true)}>
                  <Plus className="h-3.5 w-3.5" /> Nuevo alimento
                </Button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Field label="Cantidad">
              <Input type="number" min="0.01" step="0.01" value={quantity} onChange={(event) => setQuantity(event.target.value)} />
            </Field>
            <Field label="Unidad">
              <Select value={unit} onChange={(event) => setUnit(event.target.value)} disabled={!manualMode && !food}>
                {(!manualMode && food) ? (
                  <>
                    <option value={food.nutrition_unit}>{food.nutrition_unit}</option>
                    {food.grams_per_unit && <option value="ud">ud</option>}
                  </>
                ) : (
                  <>
                    <option value="g">g</option>
                    <option value="ml">ml</option>
                    <option value="ud">ud</option>
                    <option value="ración">ración</option>
                  </>
                )}
              </Select>
            </Field>
          </div>

          {!manualMode ? (
            <div className="rounded-xl border border-lime/15 bg-lime/[0.035] p-3.5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="muted-label">Cálculo automático</p>
                  <p className="mt-1 text-lg font-semibold text-white">
                    {formatNumber(calculated?.calories ?? 0, 0)} kcal
                  </p>
                  <p className="text-[10px] text-zinc-500">
                    {food ? `${food.name} · ${formatNumber(toNumber(quantity))} ${unit}` : 'Selecciona un alimento'}
                  </p>
                </div>
                <div className="text-right text-[10px] tabular-nums text-zinc-400">
                  <p>P {formatNumber(calculated?.protein ?? 0)} g</p>
                  <p>C {formatNumber(calculated?.carbs ?? 0)} g</p>
                  <p>G {formatNumber(calculated?.fat ?? 0)} g</p>
                  <p>Fibra {formatNumber(calculated?.fiber ?? 0)} g</p>
                </div>
              </div>
              <p className="mt-2 text-[10px] leading-relaxed text-zinc-600">
                Los valores salen del alimento registrado. Si cambias la cantidad o la unidad, se recalculan.
              </p>
            </div>
          ) : (
            <div className="rounded-xl border border-ink-700 bg-ink-900 p-3.5">
              <div className="mb-3 flex items-start gap-2">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-zinc-500" />
                <p className="text-[11px] leading-relaxed text-zinc-500">
                  Este registro puede conservar los valores del plan o actualizarse manualmente.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                <Field label="kcal">
                  <Input type="number" min="0" step="0.1" value={calories} onChange={(event) => setCalories(event.target.value)} placeholder="—" />
                </Field>
                <Field label="Proteína">
                  <Input type="number" min="0" step="0.1" value={protein} onChange={(event) => setProtein(event.target.value)} placeholder="—" />
                </Field>
                <Field label="Carbos">
                  <Input type="number" min="0" step="0.1" value={carbs} onChange={(event) => setCarbs(event.target.value)} placeholder="—" />
                </Field>
                <Field label="Grasa">
                  <Input type="number" min="0" step="0.1" value={fat} onChange={(event) => setFat(event.target.value)} placeholder="—" />
                </Field>
                <Field label="Fibra">
                  <Input type="number" min="0" step="0.1" value={fiber} onChange={(event) => setFiber(event.target.value)} placeholder="—" />
                </Field>
              </div>
            </div>
          )}

          <Field label="Observaciones">
            <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Opcional" className="min-h-20" />
          </Field>
        </div>
      </Modal>

      <FoodFormModal
        open={foodFormOpen}
        onClose={() => setFoodFormOpen(false)}
        onSaved={(created) => {
          foods.reload()
          setManualMode(false)
          setFoodId(created.id)
          setUnit(created.nutrition_unit)
        }}
        food={null}
      />
    </>
  )
}
