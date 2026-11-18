import { Plus, X } from 'lucide-react'
import { useState } from 'react'
import type { Category, CategoryKind } from '../types'
import { errorMessage } from '../lib/utils'
import { Button, Input, Select, useToast } from './ui'
import { useAuth } from '../hooks/useAuth'
import { db } from '../lib/supabase'

export function CategoryPicker({
  categories,
  value,
  onChange,
  kind,
  onCreated,
}: {
  categories: Category[]
  value: string | null
  onChange: (value: string | null) => void
  kind: CategoryKind
  onCreated: () => void
}) {
  const { user } = useAuth()
  const { push } = useToast()
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const options = categories.filter((category) => category.kind === kind)

  async function create() {
    if (!name.trim() || !user) return
    setSaving(true)
    try {
      const { data, error } = await db()
        .from('categories')
        .insert({ user_id: user.id, kind, name: name.trim() })
        .select('*')
        .single()
      if (error) throw error
      onChange((data as Category).id)
      setName('')
      setAdding(false)
      onCreated()
      push('Categoría creada')
    } catch (reason) {
      push(errorMessage(reason), 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Select value={value ?? ''} onChange={(event) => onChange(event.target.value || null)} className="flex-1">
          <option value="">Sin categoría</option>
          {options.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </Select>
        <Button type="button" variant="secondary" size="icon" onClick={() => setAdding((current) => !current)} aria-label="Nueva categoría">
          {adding ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
        </Button>
      </div>
      {adding && (
        <div className="flex gap-2 animate-fade-in">
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Nombre de la categoría"
            autoFocus
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                create()
              }
            }}
          />
          <Button type="button" variant="primary" onClick={create} loading={saving} disabled={!name.trim()}>
            Añadir
          </Button>
        </div>
      )}
    </div>
  )
}
