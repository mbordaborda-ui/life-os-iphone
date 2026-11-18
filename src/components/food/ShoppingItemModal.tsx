import { Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { ShoppingListItem } from '../../types'
import { db } from '../../lib/supabase'
import { errorMessage, formatMoney, formatMoneyPrecise, formatNumber, toNumber } from '../../lib/utils'
import { FOOD_CATEGORIES, UNITS } from '../../lib/constants'
import { shoppingLineTotal, shoppingUnitPrice } from '../../lib/calculations'
import { Button, Field, Input, Modal, Select, useToast } from '../ui'

export function ShoppingItemModal({
  open,
  onClose,
  onSaved,
  listId,
  item,
  onDelete,
}: {
  open: boolean
  onClose: () => void
  onSaved: () => void
  listId: string | null
  item?: ShoppingListItem | null
  onDelete?: (item: ShoppingListItem) => void
}) {
  const { push } = useToast()
  const [name, setName] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [unit, setUnit] = useState('ud')
  const [category, setCategory] = useState('')
  const [estimatedUnitPrice, setEstimatedUnitPrice] = useState('')
  const [actualUnitPrice, setActualUnitPrice] = useState('')
  const [saving, setSaving] = useState(false)

  const quantityValue = toNumber(quantity, 1)
  const unitLabel = unit.trim() || 'ud'
  const priceUnitLabel = unitLabel === 'ud' ? 'unidad' : unitLabel
  const estimatedLine =
    estimatedUnitPrice.trim() === '' ? null : shoppingLineTotal(quantityValue, toNumber(estimatedUnitPrice))
  const actualLine = actualUnitPrice.trim() === '' ? null : shoppingLineTotal(quantityValue, toNumber(actualUnitPrice))

  useEffect(() => {
    if (!open) return
    if (item) {
      setName(item.name)
      setQuantity(String(item.quantity))
      setUnit(item.unit)
      setCategory(item.category ?? '')
      setEstimatedUnitPrice(item.estimated_price === null ? '' : String(shoppingUnitPrice(item.estimated_price, item.quantity)))
      setActualUnitPrice(item.actual_price === null ? '' : String(shoppingUnitPrice(item.actual_price, item.quantity)))
    } else {
      setName('')
      setQuantity('1')
      setUnit('ud')
      setCategory('')
      setEstimatedUnitPrice('')
      setActualUnitPrice('')
    }
    setSaving(false)
  }, [open, item])

  async function save() {
    if (!name.trim() || !listId) return
    if (toNumber(quantity) <= 0) {
      push('La cantidad debe ser mayor que cero.', 'error')
      return
    }
    const estimated =
      estimatedUnitPrice.trim() === '' ? null : shoppingLineTotal(toNumber(quantity, 1), toNumber(estimatedUnitPrice))
    const actual =
      actualUnitPrice.trim() === '' ? null : shoppingLineTotal(toNumber(quantity, 1), toNumber(actualUnitPrice))
    setSaving(true)
    try {
      if (item) {
        const { error } = await db()
          .from('shopping_list_items')
          .update({
            name: name.trim(),
            quantity: toNumber(quantity, 1),
            unit: unit.trim() || 'ud',
            category: category.trim() || null,
            estimated_price: estimated,
            actual_price: actual,
          })
          .eq('id', item.id)
        if (error) throw error
      } else {
        const { error } = await db().rpc('add_shopping_items', {
          p_list_id: listId,
          p_items: [
            {
              name: name.trim(),
              quantity: toNumber(quantity, 1),
              unit: unit.trim() || 'ud',
              category: category.trim() || null,
              estimated_price: estimated,
            },
          ],
        })
        if (error) throw error
      }
      push(item ? 'Producto actualizado' : 'Producto añadido')
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
      title={item ? 'Editar producto' : 'Añadir al mercado'}
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
        <Field label="Producto">
          <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Ej. Leche de avena" autoFocus />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Cantidad">
            <Input type="number" min="0.01" step="0.01" value={quantity} onChange={(event) => setQuantity(event.target.value)} />
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
        <Field label="Categoría">
          <Input
            list="shopping-categories"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            placeholder="Ej. Lácteos"
          />
          <datalist id="shopping-categories">
            {FOOD_CATEGORIES.map((value) => (
              <option key={value} value={value} />
            ))}
          </datalist>
        </Field>
        <div className={item ? 'grid grid-cols-2 gap-3' : ''}>
          <Field label={`Precio por ${priceUnitLabel} (estimado)`} hint="Se multiplica por la cantidad.">
            <Input
              type="number"
              min="0"
              step="0.01"
              value={estimatedUnitPrice}
              onChange={(event) => setEstimatedUnitPrice(event.target.value)}
              placeholder="Opcional"
            />
          </Field>
          {item && (
            <Field label={`Precio por ${priceUnitLabel} (real)`} hint={`Lo que pagaste por cada ${priceUnitLabel}.`}>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={actualUnitPrice}
                onChange={(event) => setActualUnitPrice(event.target.value)}
                placeholder="Opcional"
              />
            </Field>
          )}
        </div>
        {estimatedLine === null && actualLine === null ? (
          <p className="text-[11px] leading-relaxed text-zinc-600">
            Introduce el precio por {priceUnitLabel}. El total de la línea se calcula como cantidad × precio unitario y se suma
            al total del carrito.
          </p>
        ) : (
          <div className="space-y-1.5 rounded-xl border border-ink-700 bg-ink-900 px-3.5 py-3 text-[11px]">
            {estimatedLine !== null && (
              <div className="flex justify-between gap-3">
                <span className="text-zinc-500">
                  Estimado: {formatNumber(quantityValue)} {unitLabel} × {formatMoneyPrecise(toNumber(estimatedUnitPrice))}
                </span>
                <span className="shrink-0 font-medium text-lime">{formatMoney(estimatedLine)}</span>
              </div>
            )}
            {actualLine !== null && (
              <div className="flex justify-between gap-3">
                <span className="text-zinc-500">
                  Real: {formatNumber(quantityValue)} {unitLabel} × {formatMoneyPrecise(toNumber(actualUnitPrice))}
                </span>
                <span className="shrink-0 font-medium text-white">{formatMoney(actualLine)}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  )
}
