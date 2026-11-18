import { CalendarDays, Trash2 } from 'lucide-react'
import { useState } from 'react'
import type { Goal, GoalProgress } from '../../types'
import { useAuth } from '../../hooks/useAuth'
import { db } from '../../lib/supabase'
import { endOfMonth, endOfWeek, formatDateShort, parseLocalDate, startOfMonth, startOfWeek, toISODate } from '../../lib/dates'
import { errorMessage, formatNumber } from '../../lib/utils'
import { Button, ConfirmDialog, Field, Input, Modal, Textarea, useToast } from '../ui'

export function GoalProgressModal({
  open,
  onClose,
  onSaved,
  goal,
  entries,
}: {
  open: boolean
  onClose: () => void
  onSaved: () => void
  goal: Goal | null
  entries: GoalProgress[]
}) {
  const { user } = useAuth()
  const { push } = useToast()
  const [value, setValue] = useState('')
  const [recordedOn, setRecordedOn] = useState(toISODate(new Date()))
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<GoalProgress | null>(null)
  const [deleting, setDeleting] = useState(false)

  if (!goal) return null

  const sorted = [...entries].sort((a, b) => b.recorded_on.localeCompare(a.recorded_on))
  const current = currentPeriod(goal)
  const currentEntries = entries.filter(
    (entry) => entry.recorded_on >= current.start && entry.recorded_on <= current.end,
  )
  const currentTotal = currentEntries.reduce((total, entry) => total + entry.value, 0)
  const total = entries.reduce((sum, entry) => sum + entry.value, 0)

  async function save() {
    if (!user) return
    const numeric = Number(value.replace(',', '.'))
    if (!Number.isFinite(numeric) || numeric === 0) {
      push('Introduce un avance distinto de cero', 'error')
      return
    }
    setSaving(true)
    try {
      const { error } = await db().from('goal_progress').insert({
        user_id: user.id,
        goal_id: goal!.id,
        value: numeric,
        recorded_on: recordedOn,
        note: note.trim() || null,
      })
      if (error) throw error
      push('Avance registrado')
      onSaved()
      setValue('')
      setNote('')
      onClose()
    } catch (reason) {
      push(errorMessage(reason), 'error')
    } finally {
      setSaving(false)
    }
  }

  async function remove() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const { error } = await db().from('goal_progress').delete().eq('id', deleteTarget.id)
      if (error) throw error
      push('Registro eliminado')
      setDeleteTarget(null)
      onSaved()
    } catch (reason) {
      push(errorMessage(reason), 'error')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title="Registrar avance"
        description={goal.title}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={onClose}>
              Cerrar
            </Button>
            <Button variant="primary" onClick={save} loading={saving} disabled={!value}>
              Registrar
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-ink-700 bg-ink-900 p-3">
              <p className="muted-label">Este periodo</p>
              <p className="mt-1.5 text-lg font-semibold text-white">
                {formatNumber(currentTotal, 2)}
                <span className="text-xs font-normal text-zinc-600"> / {formatNumber(goal.target_value, 2)}</span>
              </p>
              <p className="mt-0.5 text-[10px] text-zinc-600">
                {goal.period === 'weekly' ? 'Semana actual' : 'Mes actual'} · {goal.metric_unit}
              </p>
            </div>
            <div className="rounded-xl border border-ink-700 bg-ink-900 p-3">
              <p className="muted-label">Acumulado total</p>
              <p className="mt-1.5 text-lg font-semibold text-white">
                {formatNumber(total, 2)}
                <span className="ml-1 text-xs font-normal text-zinc-600">{goal.metric_unit}</span>
              </p>
              <p className="mt-0.5 text-[10px] text-zinc-600">{entries.length} registros</p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-[1fr_1fr]">
            <Field label="Avance">
              <Input
                type="number"
                step="any"
                value={value}
                onChange={(event) => setValue(event.target.value)}
                placeholder="Cantidad a sumar"
                autoFocus
              />
            </Field>
            <Field label="Fecha">
              <Input type="date" value={recordedOn} onChange={(event) => setRecordedOn(event.target.value)} />
            </Field>
          </div>
          <Field label="Nota" hint="Opcional. Qué hiciste o qué aprendiste.">
            <Textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              className="min-h-16"
              placeholder="Ej. Sesión de piernas completada"
            />
          </Field>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-medium uppercase tracking-[0.12em] text-zinc-500">Historial</p>
              <p className="text-[10px] text-zinc-600">{sorted.length} registros</p>
            </div>
            {sorted.length ? (
              <div className="space-y-1.5">
                {sorted.slice(0, 8).map((entry) => (
                  <div key={entry.id} className="group flex items-center gap-3 rounded-lg bg-ink-900 px-3 py-2">
                    <CalendarDays className="h-3.5 w-3.5 shrink-0 text-zinc-600" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs text-zinc-300">
                          {formatNumber(entry.value, 2)} {goal.metric_unit}
                        </p>
                        <p className="text-[10px] text-zinc-600">{formatDateShort(parseLocalDate(entry.recorded_on))}</p>
                      </div>
                      {entry.note && <p className="truncate text-[10px] text-zinc-600">{entry.note}</p>}
                    </div>
                    <button
                      onClick={() => setDeleteTarget(entry)}
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-zinc-700 transition hover:bg-red-950/30 hover:text-red-300"
                      aria-label="Eliminar registro"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="rounded-lg border border-dashed border-ink-700 px-3 py-4 text-center text-[11px] text-zinc-600">
                Todavía no hay avances registrados para este objetivo.
              </p>
            )}
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Eliminar registro"
        description="Este avance dejará de contar en el progreso del objetivo."
        onCancel={() => setDeleteTarget(null)}
        onConfirm={remove}
        loading={deleting}
      />
    </>
  )
}

function currentPeriod(goal: Goal) {
  const now = new Date()
  if (goal.period === 'weekly') {
    return { start: toISODate(startOfWeek(now)), end: toISODate(endOfWeek(now)) }
  }
  return { start: toISODate(startOfMonth(now)), end: toISODate(endOfMonth(now)) }
}
