import { Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { FinanceTransaction, FinanceTransactionKind } from '../../types'
import { useAuth } from '../../hooks/useAuth'
import { db } from '../../lib/supabase'
import {
  FINANCE_EXPENSE_CATEGORIES,
  FINANCE_INCOME_CATEGORIES,
  FINANCE_SAVINGS_CATEGORIES,
  FINANCE_WITHDRAWAL_CATEGORIES,
} from '../../lib/constants'
import { toISODate } from '../../lib/dates'
import { errorMessage, toNumber } from '../../lib/utils'
import { Button, Field, Input, Modal, Segmented, Textarea, useToast } from '../ui'

export function TransactionModal({
  open,
  onClose,
  onSaved,
  transaction,
  onDelete,
  initialKind = 'expense',
}: {
  open: boolean
  onClose: () => void
  onSaved: () => void
  transaction?: FinanceTransaction | null
  onDelete?: (transaction: FinanceTransaction) => void
  initialKind?: FinanceTransactionKind
}) {
  const { user } = useAuth()
  const { push } = useToast()
  const [kind, setKind] = useState<FinanceTransactionKind>('expense')
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState('')
  const [txDate, setTxDate] = useState(toISODate(new Date()))
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  const categories =
    kind === 'expense'
      ? FINANCE_EXPENSE_CATEGORIES
      : kind === 'income'
        ? FINANCE_INCOME_CATEGORIES
        : kind === 'saving'
          ? FINANCE_SAVINGS_CATEGORIES
          : FINANCE_WITHDRAWAL_CATEGORIES
  const listId = `finance-${kind}-categories`
  const kindOptions: Array<{ value: FinanceTransactionKind; label: string }> = [
    { value: 'expense', label: 'Gasto' },
    { value: 'income', label: 'Ingreso' },
    ...(transaction?.kind === 'saving' || (!transaction && initialKind === 'saving')
      ? [{ value: 'saving' as const, label: 'Ahorro' }]
      : []),
    { value: 'withdrawal', label: 'Retiro' },
  ]

  useEffect(() => {
    if (!open) return
    if (transaction) {
      setKind(transaction.kind)
      setDescription(transaction.description)
      setAmount(String(transaction.amount))
      setCategory(transaction.category ?? '')
      setTxDate(transaction.tx_date)
      setNotes(transaction.notes ?? '')
    } else {
      setKind(initialKind)
      setDescription('')
      setAmount('')
      setCategory(
        initialKind === 'saving' ? 'Ahorro mensual' : initialKind === 'withdrawal' ? 'Retiro de ahorro' : '',
      )
      setTxDate(toISODate(new Date()))
      setNotes('')
    }
    setSaving(false)
  }, [open, transaction, initialKind])

  function changeKind(next: FinanceTransactionKind) {
    setKind(next)
    setCategory('')
  }

  async function save() {
    if (!user) return
    if (!description.trim()) {
      push('Describe el movimiento.', 'error')
      return
    }
    if (toNumber(amount) <= 0) {
      push('El valor debe ser mayor que cero.', 'error')
      return
    }
    setSaving(true)
    try {
      const payload = {
        tx_date: txDate,
        kind,
        category: category.trim() || null,
        description: description.trim(),
        amount: Math.round(toNumber(amount) * 100) / 100,
        notes: notes.trim() || null,
      }
      if (transaction) {
        const { error } = await db().from('finance_transactions').update(payload).eq('id', transaction.id)
        if (error) throw error
      } else {
        const { error } = await db().from('finance_transactions').insert({ ...payload, user_id: user.id })
        if (error) throw error
      }
      push(transaction ? 'Movimiento actualizado' : 'Movimiento registrado')
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
      title={transaction ? 'Editar movimiento' : 'Registrar movimiento'}
      description="Registra gastos, ingresos, aportes y retiros de tu ahorro."
      size="md"
      footer={
        <div className="flex items-center justify-between gap-2">
          <div>
            {transaction && onDelete && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onDelete(transaction)}
                className="text-red-400 hover:text-red-300"
              >
                <Trash2 className="h-4 w-4" /> Eliminar
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>
              Cancelar
            </Button>
            <Button variant="primary" onClick={save} loading={saving}>
              {transaction ? 'Guardar' : 'Registrar'}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <Segmented
          className="w-full [&>button]:flex-1"
          value={kind}
          onChange={changeKind}
          options={kindOptions}
        />
        <Field label="Descripción">
          <Input
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder={
              kind === 'expense'
                ? 'Ej. Mercado semanal'
                : kind === 'income'
                  ? 'Ej. Salario'
                  : kind === 'saving'
                    ? 'Ej. Aporte al ahorro'
                    : 'Ej. Retiro para emergencia'
            }
            autoFocus
          />
        </Field>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Valor">
            <Input
              type="number"
              min="0.01"
              step="0.01"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder="0"
            />
          </Field>
          <Field label="Fecha">
            <Input type="date" value={txDate} onChange={(event) => setTxDate(event.target.value)} />
          </Field>
        </div>
        <Field label="Categoría">
          <Input
            list={listId}
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            placeholder={
              kind === 'expense'
                ? 'Ej. Vivienda'
                : kind === 'income'
                  ? 'Ej. Salario'
                  : kind === 'saving'
                    ? 'Ej. Ahorro mensual'
                    : 'Ej. Retiro de ahorro'
            }
          />
          <datalist id={listId}>
            {categories.map((value) => (
              <option key={value} value={value} />
            ))}
          </datalist>
        </Field>
        {!categories.includes(category) && category.trim() !== '' && (
          <p className="text-[11px] leading-relaxed text-zinc-600">
            Se guardará como categoría personalizada. El panel la agrupará igual que las demás.
          </p>
        )}
        <Field label="Nota" hint="Opcional.">
          <Textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Detalle del movimiento"
            className="min-h-20"
          />
        </Field>
      </div>
    </Modal>
  )
}
