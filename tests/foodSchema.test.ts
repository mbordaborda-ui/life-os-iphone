import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const sql = readFileSync(join(process.cwd(), 'supabase', 'migrations', '0002_food_catalog.sql'), 'utf8')

describe('food catalog migration', () => {
  it('creates a private food catalog with ownership policies', () => {
    expect(sql).toContain('create table public.foods')
    expect(sql).toContain('alter table public.foods enable row level security')
    expect(sql).toContain('create policy "own_select" on public.foods for select using ((select auth.uid()) = user_id)')
    expect(sql).toContain('grant select, insert, update, delete on public.foods to authenticated')
    expect(sql).toContain('unique (user_id, name)')
  })

  it('requires every recipe ingredient to reference an owned food', () => {
    expect(sql).toContain('alter table public.recipe_ingredients add column food_id uuid')
    expect(sql).toContain('alter table public.recipe_ingredients alter column food_id set not null')
    expect(sql).toContain(
      'foreign key (food_id, user_id) references public.foods(id, user_id) on delete restrict',
    )
  })

  it('adds nutrition to food logs and preserves plan-generated records', () => {
    expect(sql).toContain('alter table public.food_logs add column fiber_g')
    expect(sql).toContain(
      'foreign key (food_id, user_id) references public.foods(id, user_id) on delete set null (food_id)',
    )
  })

  it('validates food ownership in save_recipe', () => {
    expect(sql.match(/create or replace function public\.save_recipe\(/g)).toHaveLength(1)
    expect(sql).toContain("v_food_id := nullif(v_ingredient ->> 'food_id', '')::uuid")
    expect(sql).toContain('Cada ingrediente debe ser un alimento registrado')
    expect(sql).toContain('select name into v_food_name')
    expect(sql).toContain('grant execute on function public.save_recipe(uuid, jsonb, jsonb) to authenticated')
  })

  it('calculates recipe macros when a planned meal is consumed', () => {
    expect(sql.match(/create or replace function public\.consume_meal_plan\(/g)).toHaveLength(1)
    expect(sql).toContain('v_ratio := v_plan.servings / v_recipe_servings')
    expect(sql).toContain('when ri.unit = f.nutrition_unit then ri.quantity / f.reference_amount')
    expect(sql).toContain("when ri.unit = 'ud' and f.grams_per_unit is not null")
    expect(sql).toContain('calories, protein_g, carbs_g, fat_g, fiber_g')
  })
})
