import { useCallback } from 'react'
import type { Category, CategoryKind } from '../types'
import { db } from '../lib/supabase'
import { useQuery } from './useQuery'

export function useCategories(kind?: CategoryKind) {
  const query = useQuery<Category[]>(
    async () => {
      const client = db()
      let request = client.from('categories').select('*').order('name')
      if (kind) request = request.eq('kind', kind)
      const { data, error } = await request
      if (error) throw error
      return (data ?? []) as Category[]
    },
    [kind],
    [],
  )

  const createCategory = useCallback(
    async (name: string, categoryKind: CategoryKind = kind ?? 'task') => {
      const client = db()
      const { data: auth } = await client.auth.getUser()
      if (!auth.user) throw new Error('No hay una sesión activa.')
      const { data, error } = await client
        .from('categories')
        .insert({ user_id: auth.user.id, kind: categoryKind, name: name.trim() })
        .select('*')
        .single()
      if (error) throw error
      query.reload()
      return data as Category
    },
    [kind, query],
  )

  return { ...query, createCategory }
}
