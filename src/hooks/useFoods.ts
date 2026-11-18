import { useQuery } from './useQuery'
import { db } from '../lib/supabase'
import type { Food } from '../types'

export function useFoods() {
  return useQuery<Food[]>(
    async () => {
      const { data, error } = await db().from('foods').select('*').order('category').order('name')
      if (error) throw error
      return (data ?? []) as Food[]
    },
    [],
    [],
  )
}
