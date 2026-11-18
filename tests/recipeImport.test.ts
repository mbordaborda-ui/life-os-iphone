import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const sql = readFileSync(join(process.cwd(), 'supabase', 'migrations', '0008_recipe_import.sql'), 'utf8')

describe('recipe import migration', () => {
  it('defines a hardened import function', () => {
    expect(sql).toContain('create or replace function public.import_recipe(')
    expect(sql).toContain('security definer')
    expect(sql).toContain('set search_path = public, auth')
    expect(sql).toContain('revoke all on function public.import_recipe(uuid, jsonb, jsonb) from public;')
    expect(sql).toContain('grant execute on function public.import_recipe(uuid, jsonb, jsonb) to service_role;')
  })

  it('inserts every recipe field and resolves the recipe category', () => {
    expect(sql).toContain('insert into public.recipes (')
    expect(sql).toContain("coalesce(p_recipe ->> 'instructions', '')")
    expect(sql).toContain("v_prep := (p_recipe ->> 'prep_minutes')::integer")
    expect(sql).toContain("coalesce((p_recipe ->> 'is_favorite')::boolean, false)")
    expect(sql).toContain('insert into public.categories (user_id, kind, name)')
    expect(sql).toContain('v_tags := array(select jsonb_array_elements_text(p_recipe -> \'tags\'))')
  })

  it('creates or reuses foods and links them to recipe ingredients', () => {
    expect(sql).toContain('insert into public.foods as food (')
    expect(sql).toContain('on conflict (user_id, name) do update set')
    expect(sql).toContain('insert into public.recipe_ingredients (')
    expect(sql).toContain('v_unit')
    expect(sql).toContain('grams_per_unit')
    expect(sql).toContain('price')
  })

  it('replaces ingredients when the recipe already exists', () => {
    expect(sql).toContain('delete from public.recipe_ingredients')
    expect(sql).toContain('where recipe_id = v_recipe_id and user_id = p_user_id;')
  })
})
