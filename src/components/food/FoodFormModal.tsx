import { useEffect, useState } from 'react'
import type { Food, NutritionUnit } from '../../types'
import { useAuth } from '../../hooks/useAuth'
import { db } from '../../lib/supabase'
import { FOOD_CATEGORIES } from '../../lib/constants'
import { errorMessage, toNumber } from '../../lib/utils'
import { Button, Field, Input, Modal, Select, Textarea, useToast } from '../ui'

function optionalNumber(value: string) {
  return value.trim() === '' ? null : toNumber(value)
}

export function FoodFormModal({
  open,
  onClose,
  onSaved,
  food,
}: {
  open: boolean
  onClose: () => void
  onSaved: (food: Food) => void
  food?: Food | null
}) {
  const { user } = useAuth()
  const { push } = useToast()
  const [name, setName] = useState('')
  const [brand, setBrand] = useState('')
  const [category, setCategory] = useState('Otros')
  const [unit, setUnit] = useState<NutritionUnit>('g')
  const [calories, setCalories] = useState('')
  const [protein, setProtein] = useState('')
  const [carbs, setCarbs] = useState('')
  const [fat, setFat] = useState('')
  const [fiber, setFiber] = useState('')
  const [price, setPrice] = useState('')
  const [gramsPerUnit, setGramsPerUnit] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setName(food?.name ?? '')
    setBrand(food?.brand ?? '')
    setCategory(food?.category ?? 'Otros')
    setUnit(food?.nutrition_unit ?? 'g')
    setCalories(food?.calories === null || food?.calories === undefined ? '' : String(food.calories))
    setProtein(food?.protein_g === null || food?.protein_g === undefined ? '' : String(food.protein_g))
    setCarbs(food?.carbs_g === null || food?.carbs_g === undefined ? '' : String(food.carbs_g))
    setFat(food?.fat_g === null || food?.fat_g === undefined ? '' : String(food.fat_g))
    setFiber(food?.fiber_g === null || food?.fiber_g === undefined ? '' : String(food.fiber_g))
    setPrice(food?.price === null || food?.price === undefined ? '' : String(food.price))
    setGramsPerUnit(food?.grams_per_unit === null || food?.grams_per_unit === undefined ? '' : String(food.grams_per_unit))
    setNotes(food?.notes ?? '')
    setSaving(false)
  }, [open, food])

  async function save() {
    if (!user) return
    if (!name.trim()) {
      push('El nombre del alimento es obligatorio.', 'error')
      return
    }
    if (optionalNumber(gramsPerUnit) !== null && toNumber(gramsPerUnit) <= 0) {
      push('El peso por unidad debe ser mayor que cero.', 'error')
      return
    }
    if (optionalNumber(price) !== null && toNumber(price) < 0) {
      push('El precio no puede ser negativo.', 'error')
      return
    }
    setSaving(true)
    try {
      const payload = {
        user_id: user.id,
        name: name.trim(),
        brand: brand.trim() || null,
        category,
        nutrition_unit: unit,
        reference_amount: 100,
        calories: optionalNumber(calories),
        protein_g: optionalNumber(protein),
        carbs_g: optionalNumber(carbs),
        fat_g: optionalNumber(fat),
        fiber_g: optionalNumber(fiber),
        grams_per_unit: optionalNumber(gramsPerUnit),
        price: optionalNumber(price),
        notes: notes.trim() || null,
      }
      const request = food
        ? db().from('foods').update(payload).eq('id', food.id).select('*').single()
        : db().from('foods').insert(payload).select('*').single()
      const { data, error } = await request
      if (error) throw error
      push(food ? 'Alimento actualizado' : 'Alimento registrado')
      onSaved(data as Food)
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
      title={food ? 'Editar alimento' : 'Nuevo alimento'}
      description="Los valores nutricionales y el precio se guardan por 100 g o 100 ml."
      size="lg"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={save} loading={saving} disabled={!name.trim()}>
            {food ? 'Guardar cambios' : 'Registrar alimento'}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-[1fr_160px]">
          <Field label="Nombre">
            <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Ej. Arroz integral" autoFocus />
          </Field>
          <Field label="Categoría">
            <Select value={category} onChange={(event) => setCategory(event.target.value)}>
              {FOOD_CATEGORIES.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Marca" hint="Opcional.">
            <Input value={brand} onChange={(event) => setBrand(event.target.value)} placeholder="Ej. Hacendado" />
          </Field>
          <Field label="Nutrición por">
            <Select value={unit} onChange={(event) => setUnit(event.target.value as NutritionUnit)}>
              <option value="g">100 g</option>
              <option value="ml">100 ml</option>
            </Select>
          </Field>
        </div>

        <div className="rounded-xl border border-ink-700 bg-ink-900 p-3.5">
          <p className="mb-3 text-[11px] font-medium uppercase tracking-[0.12em] text-zinc-500">
            Valores por 100 {unit === 'ml' ? 'ml' : 'g'}
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <Field label="kcal">
              <Input type="number" min="0" step="0.1" value={calories} onChange={(event) => setCalories(event.target.value)} placeholder="0" />
            </Field>
            <Field label="Proteína">
              <Input type="number" min="0" step="0.1" value={protein} onChange={(event) => setProtein(event.target.value)} placeholder="0" />
            </Field>
            <Field label="Carbos">
              <Input type="number" min="0" step="0.1" value={carbs} onChange={(event) => setCarbs(event.target.value)} placeholder="0" />
            </Field>
            <Field label="Grasa">
              <Input type="number" min="0" step="0.1" value={fat} onChange={(event) => setFat(event.target.value)} placeholder="0" />
            </Field>
            <Field label="Fibra">
              <Input type="number" min="0" step="0.1" value={fiber} onChange={(event) => setFiber(event.target.value)} placeholder="0" />
            </Field>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field
            label={`Precio por 100 ${unit}`}
            hint={`En pesos colombianos. Si compras 500 ${unit}, divide el precio entre 5.`}
          >
            <Input
              type="number"
              min="0"
              step="1"
              value={price}
              onChange={(event) => setPrice(event.target.value)}
              placeholder="Ej. 1200"
            />
          </Field>
          <Field
            label={`Peso de 1 unidad (${unit})`}
            hint="Para usar el alimento en unidades. Ej. 1 huevo ≈ 50 g."
          >
            <Input
              type="number"
              min="0.1"
              step="0.1"
              value={gramsPerUnit}
              onChange={(event) => setGramsPerUnit(event.target.value)}
              placeholder="Opcional"
            />
          </Field>
        </div>

        <Field label="Notas">
          <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Opcional" className="min-h-20" />
        </Field>

        <p className="text-[11px] leading-relaxed text-zinc-600">
          Usa valores de la etiqueta o de una tabla de composición de alimentos. Los cálculos de recetas, costos y del diario
          se harán automáticamente con estos datos.
        </p>
      </div>
    </Modal>
  )
}
