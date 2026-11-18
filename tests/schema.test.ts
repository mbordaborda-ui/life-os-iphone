import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const sql = readFileSync(join(process.cwd(), 'supabase', 'migrations', '0001_life_os_schema.sql'), 'utf8')

function tableNames() {
  return Array.from(sql.matchAll(/create table public\.(\w+)/g)).map((match) => match[1])
}

function rlsTables() {
  return new Set(
    Array.from(sql.matchAll(/alter table public\.(\w+) enable row level security/g)).map((match) => match[1]),
  )
}

function policyTableList() {
  const block = sql.match(/tables text\[\] := array\[([\s\S]*?)\];/)
  if (!block) return []
  return Array.from(block[1].matchAll(/'([a-z_]+)'/g)).map((match) => match[1])
}

describe('migration static security checks', () => {
  it('enables row level security on every private table', () => {
    const tables = tableNames()
    expect(tables.length).toBeGreaterThanOrEqual(23)
    expect(tables.filter((table) => !rlsTables().has(table))).toEqual([])
  })

  it('creates authenticated ownership policies for every non-profile table', () => {
    const nonProfile = tableNames().filter((table) => table !== 'profiles')
    expect(policyTableList().sort()).toEqual(nonProfile.sort())
    expect(sql).toContain('for select using ((select auth.uid()) = user_id)')
    expect(sql).toContain('for insert with check ((select auth.uid()) = user_id)')
    expect(sql).toContain('for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)')
    expect(sql).toContain('for delete using ((select auth.uid()) = user_id)')
  })

  it('scopes profiles with auth.uid policies and no permissive policies', () => {
    expect(sql).toContain('profiles_select_own')
    expect(sql).toContain('profiles_insert_own')
    expect(sql).toContain('profiles_update_own')
    expect(sql).toContain('profiles_delete_own')
    expect(sql).not.toMatch(/using\s*\(\s*true\s*\)/i)
    expect(sql).not.toMatch(/with check\s*\(\s*true\s*\)/i)
  })

  it('defines the critical RPCs as security definer with a fixed search path', () => {
    const rpcs = [
      'complete_shopping_list',
      'adjust_pantry_quantity',
      'consume_meal_plan',
      'unconsume_meal_plan',
      'save_workout_session',
      'add_shopping_items',
      'save_recipe',
      'save_workout_routine',
      'save_goal',
    ]
    for (const name of rpcs) {
      const start = sql.indexOf(`create or replace function public.${name}(`)
      expect(start, `${name} should exist`).toBeGreaterThan(-1)
      const body = sql.slice(start, sql.indexOf('$$;', start))
      expect(body, `${name} should be security definer`).toContain('security definer')
      expect(body, `${name} should fix search_path`).toContain('set search_path = public, auth')
      expect(body, `${name} should check auth.uid()`).toContain('auth.uid()')
    }
  })

  it('bootstraps profiles and categories for new users', () => {
    expect(sql).toContain('create trigger on_auth_user_created')
    expect(sql).toContain('after insert on auth.users')
    expect(sql).toContain('insert into public.profiles')
    expect(sql).toContain("(new.id, 'task', 'Personal')")
  })

  it('preserves meal plan names with a single recipe delete trigger', () => {
    const triggers = Array.from(
      sql.matchAll(/create trigger (recipes_preserve_\w+) before delete on public\.recipes/g),
    )
    expect(triggers).toHaveLength(1)
    expect(triggers[0]?.[1]).toBe('recipes_preserve_meal_plan_name')
    expect(sql.match(/create or replace function public\.preserve_meal_plan_recipe_name\(/g)).toHaveLength(1)
  })

  it('keeps ownership composite foreign keys for child records', () => {
    expect(sql).toContain('foreign key (goal_id, user_id) references public.goals(id, user_id) on delete cascade')
    expect(sql).toContain('foreign key (task_id, user_id) references public.tasks(id, user_id) on delete cascade')
    expect(sql).toContain('foreign key (recipe_id, user_id) references public.recipes(id, user_id) on delete cascade')
  })

  it('defines unique id/user targets for every composite ownership foreign key', () => {
    const targets = new Set(
      Array.from(sql.matchAll(/references public\.(\w+)\(id, user_id\)/g)).map((match) => match[1]),
    )
    for (const table of targets) {
      const start = sql.indexOf(`create table public.${table} (`)
      expect(start, `${table} should exist`).toBeGreaterThan(-1)
      const block = sql.slice(start, sql.indexOf('\n);', start))
      expect(block, `${table} should allow (id, user_id) references`).toContain('unique (id, user_id)')
    }
  })
})
