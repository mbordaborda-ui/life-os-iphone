import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const sql = readFileSync(
  join(process.cwd(), 'supabase', 'migrations', '0004_market_totals_and_reuse.sql'),
  'utf8',
)
const restoreSql = readFileSync(
  join(process.cwd(), 'supabase', 'migrations', '0005_restore_empty_market.sql'),
  'utf8',
)

describe('market reuse', () => {
  it('sums line totals without multiplying by quantity', () => {
    expect(sql).toContain(
      'v_total := v_total + coalesce(v_item.actual_price, v_item.estimated_price, 0);',
    )
    expect(sql).not.toContain('* v_item.quantity')
  })

  it('creates a new open list from a completed purchase', () => {
    expect(sql).toContain('create or replace function public.reuse_shopping_list')
    expect(sql).toContain("where user_id = v_user_id and status = 'open'")
    expect(sql).toContain('insert into public.shopping_lists (user_id, name)')
    expect(sql).toContain('insert into public.shopping_list_items')
    expect(sql).toContain("'items', v_items")
  })

  it('recovers into an empty open list but protects one with products', () => {
    expect(restoreSql).toContain('v_new_list_id := v_open_list_id;')
    expect(restoreSql).toContain('Ya tienes una lista abierta con productos')
    expect(restoreSql).toContain('get diagnostics v_items = row_count')
  })
})
