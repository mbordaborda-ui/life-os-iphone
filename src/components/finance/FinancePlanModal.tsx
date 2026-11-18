import { useEffect, useState } from 'react'
import type { FinancePlan } from '../../types'
import { useAuth } from '../../hooks/useAuth'
import { db } from '../../lib/supabase'
import { errorMessage, formatMoney, toNumber } from '../../lib/utils'
import { Button, Field, Input, Modal, Textarea, useToast } from '../ui'

export function FinancePlanModal({
  open,
  onClose,
  onSaved,
  plan,
}: {
  open: boolean
  onClose: () => void
  onSaved: () => void
  plan: FinancePlan | null
}) {
  const { user } = useAuth()
  const { push } = useToast()
  const [monthlyIncome, setMonthlyIncome] = useState('')
  const [savingsTarget, setSavingsTarget] = useState('')
  const [emergencyTarget, setEmergencyTarget] = useState('')
  const [emergencyBalance, setEmergencyBalance] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setMonthlyIncome(plan ? String(plan.monthly_income) : '')
    setSavingsTarget(plan ? String(plan.savings_target) : '')
    setEmergencyTarget(plan ? String(plan.emergency_target) : '')
    setEmergencyBalance(plan ? String(plan.emergency_balance) : '')
    setNotes(plan?.notes ?? '')
    setSaving(false)
  }, [open, plan])

  const available = Math.max(0, toNumber(monthlyIncome) - toNumber(savingsTarget))

  async function save() {
    if (!user) return
    setSaving(true)
    try {
      const payload = {
        user_id: user.id,
        monthly_income: Math.max(0, toNumber(monthlyIncome)),
        savings_target: Math.max(0, toNumber(savingsTarget)),
        emergency_target: Math.max(0, toNumber(emergencyTarget)),
        emergency_balance: Math.max(0, toNumber(emergencyBalance)),
        notes: notes.trim() || null,
      }
      const { error } = await db().from('finance_plan').upsert(payload, { onConflict: 'user_id' })
      if (error) throw error
      push('Plan financiero guardado')
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
      title="Plan financiero"
      description="Define tu ingreso previsto, cuánto quieres ahorrar cada mes y el fondo de emergencia."
      size="md"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={save} loading={saving}>
            Guardar plan
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <Field label="Ingreso mensual previsto" hint="Lo que esperas recibir este mes.">
          <Input
            type="number"
            min="0"
            step="0.01"
            value={monthlyIncome}
            onChange={(event) => setMonthlyIncome(event.target.value)}
            placeholder="0"
            autoFocus
          />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Objetivo de ahorro mensual" hint="Lo que quieres guardar cada mes.">
            <Input
              type="number"
              min="0"
              step="0.01"
              value={savingsTarget}
              onChange={(event) => setSavingsTarget(event.target.value)}
              placeholder="0"
            />
          </Field>
          <Field label="Disponible para gastar" hint="Ingreso previsto menos ahorro.">
            <div className="flex h-11 items-center rounded-xl border border-ink-700 bg-ink-900 px-3.5 text-sm text-lime">
              {formatMoney(available)}
            </div>
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Meta fondo de emergencia" hint="Tu colchón ideal.">
            <Input
              type="number"
              min="0"
              step="0.01"
              value={emergencyTarget}
              onChange={(event) => setEmergencyTarget(event.target.value)}
              placeholder="0"
            />
          </Field>
          <Field label="Ahorrado en el fondo" hint="Lo que ya tienes disponible.">
            <Input
              type="number"
              min="0"
              step="0.01"
              value={emergencyBalance}
              onChange={(event) => setEmergencyBalance(event.target.value)}
              placeholder="0"
            />
          </Field>
        </div>
        <Field label="Notas" hint="Opcional.">
          <Textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Estrategia, recordatorios o detalles del plan"
            className="min-h-20"
          />
        </Field>
      </div>
    </Modal>
  )
}
