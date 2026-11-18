import { ArrowDownToLine, ArrowUpFromLine } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { PantryItem, PantryReason } from '../../types'
import { db } from '../../lib/supabase'
import { errorMessage, formatNumber, toNumber } from '../../lib/utils'
import { Button, Field, Input, Modal, Select, Textarea, useToast } from '../ui'

export function PantryAdjustModal({
  open,
  onClose,
  onSaved,
  item,
  initialDirection = 'consume',
}: {
  open: boolean
  onClose: () => void
  onSaved: () => void
  item: PantryItem | null
  initialDirection?: 'consume' | 'add'
}) {
  const { push } = useToast()
  const [direction, setDirection] = useState<'consume' | 'add'>(initialDirection)
  const [quantity, setQuantity] = useState('1')
  const [reason, setReason] = useState<PantryReason>('consumption')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setDirection(initialDirection)
    setQuantity('1')
    setReason(initialDirection === 'add' ? 'purchase' : 'consumption')
    setNote('')
    setSaving(false)
  }, [open, item, initialDirection])

  function setMode(mode: 'consume' | 'add') {
    setDirection(mode)
    setReason(mode === 'add' ? 'purchase' : 'consumption')
  }

  async function apply() {
    if (!item) return
    const amount = toNumber(quantity)
    if (amount <= 0) {
      push('Introduce una cantidad mayor que cero.', 'error')
      return
    }
    if (direction === 'consume' && amount > item.quantity) {
      push('No puedes consumir más de lo disponible.', 'error')
      return
    }
    setSaving(true)
    try {
      const { error } = await db().rpc('adjust_pantry_quantity', {
        p_item_id: item.id,
        p_delta: direction === 'consume' ? -amount : amount,
        p_reason: reason,
        p_note: note.trim() || null,
      })
      if (error) throw error
      push(direction === 'consume' ? 'Consumo registrado' : 'Existencias actualizadas')
      onSaved()
      onClose()
    } catch (reason) {
      push(errorMessage(reason), 'error')
    } finally {
      setSaving(false)
    }
  }

  if (!item) return null

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Actualizar existencias"
      description={`${item.name} · ${formatNumber(item.quantity)} ${item.unit} disponibles`}
      size="sm"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant={direction === 'consume' ? 'primary' : 'primary'} onClick={apply} loading={saving}>
            {direction === 'consume' ? 'Registrar consumo' : 'Añadir existencias'}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2 rounded-xl border border-ink-700 bg-ink-900 p-1">
          <button
            onClick={() => setMode('consume')}
            className={`flex h-10 items-center justify-center gap-2 rounded-lg text-xs font-medium ${
              direction === 'consume' ? 'bg-ink-750 text-white' : 'text-zinc-500'
            }`}
          >
            <ArrowDownToLine className="h-3.5 w-3.5" /> Consumir
          </button>
          <button
            onClick={() => setMode('add')}
            className={`flex h-10 items-center justify-center gap-2 rounded-lg text-xs font-medium ${
              direction === 'add' ? 'bg-ink-750 text-white' : 'text-zinc-500'
            }`}
          >
            <ArrowUpFromLine className="h-3.5 w-3.5" /> Reponer
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label={`Cantidad (${item.unit})`}>
            <Input
              type="number"
              min="0.001"
              step="0.01"
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
            />
          </Field>
          <Field label="Motivo">
            <Select value={reason} onChange={(event) => setReason(event.target.value as PantryReason)}>
              {direction === 'consume' ? (
                <>
                  <option value="consumption">Consumo</option>
                  <option value="waste">Desperdicio</option>
                  <option value="adjustment">Ajuste</option>
                </>
              ) : (
                <>
                  <option value="purchase">Compra</option>
                  <option value="adjustment">Ajuste</option>
                </>
              )}
            </Select>
          </Field>
        </div>
        <Field label="Nota">
          <Textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Opcional" className="min-h-20" />
        </Field>
        <p className="text-[11px] leading-relaxed text-zinc-600">
          Cada movimiento queda auditado. La cantidad final nunca puede ser negativa.
        </p>
      </div>
    </Modal>
  )
}
