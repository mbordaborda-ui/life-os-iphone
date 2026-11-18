import { Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { PantryItem } from '../../types'
import { useAuth } from '../../hooks/useAuth'
import { db } from '../../lib/supabase'
import { errorMessage, toNumber } from '../../lib/utils'
import { FOOD_CATEGORIES, UNITS } from '../../lib/constants'
import { Button, Field, Input, Modal, Select, useToast } from '../ui'

export function PantryItemModal({
  open,
  onClose,
  onSaved,
  item,
  onDelete,
}: {
  open: boolean
  onClose: () => void
  onSaved: () => void
  item?: PantryItem | null
  onDelete?: (item: PantryItem) => void
}) {
  const { user } = useAuth()
  const { push } = useToast()
  const [name, setName] = useState('')
  const [quantity, setQuantity] = useState('0')
  const [unit, setUnit] = useState('ud')
  const [minQuantity, setMinQuantity] = useState('0')
  const [category, setCategory] = useState('')
  const [location, setLocation] = useState('')
  const [expiresOn, setExpiresOn] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    if (item) {
      setName(item.name)
      setQuantity(String(item.quantity))
      setUnit(item.unit)
      setMinQuantity(String(item.min_quantity))
      setCategory(item.category ?? '')
      setLocation(item.location ?? '')
      setExpiresOn(item.expires_on ?? '')
    } else {
      setName('')
      setQuantity('0')
      setUnit('ud')
      setMinQuantity('0')
      setCategory('')
      setLocation('')
      setExpiresOn('')
    }
    setSaving(false)
  }, [open, item])

  async function save() {
    if (!user || !name.trim()) return
    if (toNumber(quantity) < 0 || toNumber(minQuantity) < 0) {
      push('Las cantidades no pueden ser negativas.', 'error')
      return
    }
    setSaving(true)
    try {
      const payload = {
        user_id: user.id,
        name: name.trim(),
        quantity: toNumber(quantity),
        unit: unit.trim() || 'ud',
        min_quantity: toNumber(minQuantity),
        category: category.trim() || null,
        location: location.trim() || null,
        expires_on: expiresOn || null,
      }
      if (item) {
        const { error } = await db().from('pantry_items').update(payload).eq('id', item.id)
        if (error) throw error
      } else {
        const { error } = await db().from('pantry_items').insert(payload)
        if (error) throw error
      }
      push(item ? 'Alimento actualizado' : 'Alimento añadido a la despensa')
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
      title={item ? 'Editar alimento' : 'Añadir a despensa'}
      size="md"
      footer={
        <div className="flex items-center justify-between gap-2">
          <div>
            {item && onDelete && (
              <Button variant="ghost" size="sm" onClick={() => onDelete(item)} className="text-red-400 hover:text-red-300">
                <Trash2 className="h-4 w-4" /> Eliminar
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>
              Cancelar
            </Button>
            <Button variant="primary" onClick={save} loading={saving} disabled={!name.trim()}>
              {item ? 'Guardar' : 'Añadir'}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <Field label="Alimento">
          <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Ej. Arroz basmati" autoFocus />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Cantidad actual">
            <Input type="number" min="0" step="0.01" value={quantity} onChange={(event) => setQuantity(event.target.value)} />
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
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Cantidad mínima" hint="Se avisará cuando baje de este nivel.">
            <Input
              type="number"
              min="0"
              step="0.01"
              value={minQuantity}
              onChange={(event) => setMinQuantity(event.target.value)}
            />
          </Field>
          <Field label="Caducidad">
            <Input type="date" value={expiresOn} onChange={(event) => setExpiresOn(event.target.value)} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Categoría">
            <Input
              list="pantry-categories"
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              placeholder="Ej. Cereales"
            />
            <datalist id="pantry-categories">
              {FOOD_CATEGORIES.map((value) => (
                <option key={value} value={value} />
              ))}
            </datalist>
          </Field>
          <Field label="Ubicación">
            <Input value={location} onChange={(event) => setLocation(event.target.value)} placeholder="Ej. Armario" />
          </Field>
        </div>
      </div>
    </Modal>
  )
}
