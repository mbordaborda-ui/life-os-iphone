import { Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { FrequencyPeriod, PriorityFood } from '../../types'
import { useAuth } from '../../hooks/useAuth'
import { db } from '../../lib/supabase'
import { errorMessage, toNumber } from '../../lib/utils'
import { FOOD_CATEGORIES, UNITS } from '../../lib/constants'
import { Button, Field, Input, Modal, Select, useToast } from '../ui'

export function PriorityFoodModal({
  open,
  onClose,
  onSaved,
  food,
  onDelete,
}: {
  open: boolean
  onClose: () => void
  onSaved: () => void
  food?: PriorityFood | null
  onDelete?: (food: PriorityFood) => void
}) {
  const { user } = useAuth()
  const { push } = useToast()
  const [name, setName] = useState('')
  const [category, setCategory] = useState('')
  const [unit, setUnit] = useState('ración')
  const [period, setPeriod] = useState<FrequencyPeriod>('weekly')
  const [target, setTarget] = useState('3')
  const [active, setActive] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    if (food) {
      setName(food.name)
      setCategory(food.category ?? '')
      setUnit(food.unit)
      setPeriod(food.period)
      setTarget(String(food.target_count))
      setActive(food.is_active)
    } else {
      setName('')
      setCategory('')
      setUnit('ración')
      setPeriod('weekly')
      setTarget('3')
      setActive(true)
    }
    setSaving(false)
  }, [open, food])

  async function save() {
    if (!user || !name.trim()) return
    if (toNumber(target) <= 0) {
      push('El objetivo debe ser mayor que cero.', 'error')
      return
    }
    setSaving(true)
    try {
      const payload = {
        user_id: user.id,
        name: name.trim(),
        category: category.trim() || null,
        unit: unit.trim() || 'ud',
        period,
        target_count: Math.round(toNumber(target)),
        is_active: active,
      }
      if (food) {
        const { error } = await db().from('priority_foods').update(payload).eq('id', food.id)
        if (error) throw error
      } else {
        const { error } = await db().from('priority_foods').insert(payload)
        if (error) throw error
      }
      push(food ? 'Alimento prioritario actualizado' : 'Alimento prioritario añadido')
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
      title={food ? 'Editar alimento prioritario' : 'Nuevo alimento prioritario'}
      description="Define una frecuencia realista y registra cada día que lo consumas."
      size="md"
      footer={
        <div className="flex items-center justify-between gap-2">
          <div>
            {food && onDelete && (
              <Button variant="ghost" size="sm" onClick={() => onDelete(food)} className="text-red-400 hover:text-red-300">
                <Trash2 className="h-4 w-4" /> Eliminar
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>
              Cancelar
            </Button>
            <Button variant="primary" onClick={save} loading={saving} disabled={!name.trim()}>
              Guardar
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <Field label="Alimento o grupo">
          <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Ej. Verduras verdes" autoFocus />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Categoría">
            <Input
              list="priority-categories"
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              placeholder="Opcional"
            />
            <datalist id="priority-categories">
              {FOOD_CATEGORIES.map((value) => (
                <option key={value} value={value} />
              ))}
            </datalist>
          </Field>
          <Field label="Unidad">
            <Select value={unit} onChange={(event) => setUnit(event.target.value)}>
              {UNITS.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Periodo">
            <Select value={period} onChange={(event) => setPeriod(event.target.value as FrequencyPeriod)}>
              <option value="weekly">Semanal</option>
              <option value="monthly">Mensual</option>
            </Select>
          </Field>
          <Field label="Frecuencia objetivo">
            <Input type="number" min="1" step="1" value={target} onChange={(event) => setTarget(event.target.value)} />
          </Field>
        </div>
        <label className="flex cursor-pointer items-center justify-between rounded-xl border border-ink-700 bg-ink-900 px-3.5 py-3">
          <span className="text-sm text-zinc-300">Seguimiento activo</span>
          <input
            type="checkbox"
            checked={active}
            onChange={(event) => setActive(event.target.checked)}
            className="h-4 w-4 accent-[#b8f36b]"
          />
        </label>
      </div>
    </Modal>
  )
}
