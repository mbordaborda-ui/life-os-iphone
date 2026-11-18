import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { formatMoney } from '../src/lib/utils'

const sql = readFileSync(join(process.cwd(), 'supabase', 'migrations', '0003_food_prices.sql'), 'utf8')

describe('food prices', () => {
  it('adds a non-negative price to the private food catalog', () => {
    expect(sql).toContain('alter table public.foods')
    expect(sql).toContain('add column price numeric(12, 2)')
    expect(sql).toContain('price is null or price >= 0')
  })

  it('formats prices in Colombian pesos', () => {
    const formatted = formatMoney(12500)
    expect(formatted).toContain('12.500')
    expect(formatted).not.toContain('€')
  })
})
