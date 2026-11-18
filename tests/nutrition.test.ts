import { describe, expect, it } from 'vitest'
import { foodCost, foodNutrition, recipeCost, recipeNutrition, scaleNutrition } from '../src/lib/calculations'
import {
  BASIC_FOODS,
  RECOMMENDED_RECIPES,
  recommendedRecipeCost,
  recommendedRecipeNutrition,
} from '../src/lib/foodCatalog'
import type { Food, RecipeIngredient } from '../src/types'

const food = (overrides: Partial<Food> = {}): Food =>
  ({
    id: 'food',
    user_id: 'user',
    name: 'Pollo',
    brand: null,
    category: 'Proteína',
    nutrition_unit: 'g',
    reference_amount: 100,
    calories: 165,
    protein_g: 31,
    carbs_g: 0,
    fat_g: 3.6,
    fiber_g: 0,
    grams_per_unit: null,
    price: null,
    notes: null,
    created_at: '2026-10-19T10:00:00.000Z',
    updated_at: '2026-10-19T10:00:00.000Z',
    ...overrides,
  }) as Food

const ingredient = (overrides: Partial<RecipeIngredient>): RecipeIngredient =>
  ({
    id: 'ingredient',
    user_id: 'user',
    recipe_id: 'recipe',
    food_id: 'food',
    name: 'Pollo',
    quantity: 100,
    unit: 'g',
    notes: null,
    position: 0,
    created_at: '2026-10-19T10:00:00.000Z',
    foods: food(),
    ...overrides,
  }) as RecipeIngredient

describe('food nutrition', () => {
  it('scales nutrition by grams, kilograms and pieces', () => {
    expect(foodNutrition(food(), 150, 'g').calories).toBeCloseTo(247.5)
    expect(foodNutrition(food(), 0.15, 'kg').calories).toBeCloseTo(247.5)
    expect(foodNutrition(food({ grams_per_unit: 50 }), 3, 'ud').calories).toBeCloseTo(247.5)
  })

  it('returns zero for incompatible units', () => {
    expect(foodNutrition(food(), 100, 'ml').calories).toBe(0)
  })

  it('scales all macro values together', () => {
    expect(scaleNutrition(foodNutrition(food(), 200, 'g'), 0.5)).toEqual({
      calories: 165,
      protein: 31,
      carbs: 0,
      fat: 3.6,
      fiber: 0,
    })
  })
})

describe('recipe nutrition', () => {
  it('sums ingredients and divides by base servings', () => {
    const ingredients = [
      ingredient({ quantity: 200 }),
      ingredient({
        id: 'rice',
        name: 'Arroz',
        quantity: 100,
        foods: food({ calories: 354, protein_g: 7.5, carbs_g: 76.2, fat_g: 2.7, fiber_g: 3.5 }),
      }),
    ]
    const result = recipeNutrition(ingredients, 2)
    expect(result.total.calories).toBeCloseTo(684)
    expect(result.perServing.calories).toBeCloseTo(342)
    expect(result.unresolved).toBe(0)
  })

  it('reports ingredients without a linked food', () => {
    const result = recipeNutrition([ingredient({ foods: null })], 1)
    expect(result.total.calories).toBe(0)
    expect(result.unresolved).toBe(1)
  })
})

describe('food costs', () => {
  it('calculates ingredient, recipe and per-serving costs', () => {
    const chicken = food({ price: 1500 })
    const rice = food({
      id: 'rice',
      name: 'Arroz',
      calories: 354,
      protein_g: 7.5,
      carbs_g: 76.2,
      fat_g: 2.7,
      fiber_g: 3.5,
      price: 700,
    })
    const ingredients = [
      ingredient({ quantity: 200, foods: chicken }),
      ingredient({ id: 'rice-ingredient', name: 'Arroz', quantity: 100, foods: rice }),
    ]

    expect(foodCost(chicken, 200, 'g')).toBe(3000)
    expect(foodCost(food({ price: 1200, grams_per_unit: 50 }), 3, 'ud')).toBe(1800)

    const cost = recipeCost(ingredients, 2)
    expect(cost.total).toBe(3700)
    expect(cost.perServing).toBe(1850)
    expect(cost.unresolved).toBe(0)
  })

  it('reports ingredients without a price', () => {
    const cost = recipeCost([ingredient({ foods: food({ price: null }) })], 1)
    expect(cost.total).toBe(0)
    expect(cost.unresolved).toBe(1)
  })
})

describe('recommended recipes', () => {
  it('uses only catalog foods', () => {
    const catalog = new Set(BASIC_FOODS.map((food) => food.name))
    for (const recipe of RECOMMENDED_RECIPES) {
      for (const ingredient of recipe.ingredients) {
        expect(catalog.has(ingredient.food), `${recipe.name}: ${ingredient.food}`).toBe(true)
      }
    }
  })

  it('calculates real per-serving nutrition for every recipe', () => {
    for (const recipe of RECOMMENDED_RECIPES) {
      const nutrition = recommendedRecipeNutrition(recipe)
      expect(nutrition.unresolved, recipe.name).toBe(0)
      expect(nutrition.perServing.calories, recipe.name).toBeGreaterThan(100)
      expect(nutrition.perServing.protein, recipe.name).toBeGreaterThan(0)
    }
  })

  it('calculates a complete cost for every recipe', () => {
    for (const recipe of RECOMMENDED_RECIPES) {
      const cost = recommendedRecipeCost(recipe)
      expect(cost.unresolved, recipe.name).toBe(0)
      expect(cost.total, recipe.name).toBeGreaterThan(0)
      expect(cost.perServing, recipe.name).toBeGreaterThan(0)
    }
  })
})
