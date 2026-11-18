import type {
  ExerciseLog,
  Food,
  FoodLog,
  Goal,
  GoalProgress,
  PantryItem,
  RecipeIngredient,
  ShoppingListItem,
  Task,
  WorkoutSession,
} from '../types'

export interface NutritionValues {
  calories: number
  protein: number
  carbs: number
  fat: number
  fiber: number
}

export function emptyNutrition(): NutritionValues {
  return { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 }
}

export function sumNutrition(values: NutritionValues[]) {
  return values.reduce(
    (total, value) => ({
      calories: total.calories + value.calories,
      protein: total.protein + value.protein,
      carbs: total.carbs + value.carbs,
      fat: total.fat + value.fat,
      fiber: total.fiber + value.fiber,
    }),
    emptyNutrition(),
  )
}

export function scaleNutrition(value: NutritionValues, factor: number): NutritionValues {
  return {
    calories: value.calories * factor,
    protein: value.protein * factor,
    carbs: value.carbs * factor,
    fat: value.fat * factor,
    fiber: value.fiber * factor,
  }
}

export function foodNutritionFactor(food: Food, quantity: number, unit: string) {
  if (!Number.isFinite(quantity) || quantity <= 0) return 0
  const normalizedUnit = unit.toLowerCase()
  if (normalizedUnit === food.nutrition_unit) return quantity / food.reference_amount
  if (normalizedUnit === 'kg' && food.nutrition_unit === 'g') return (quantity * 1000) / food.reference_amount
  if (normalizedUnit === 'l' && food.nutrition_unit === 'ml') return (quantity * 1000) / food.reference_amount
  if (normalizedUnit === 'ud' && food.grams_per_unit) return (quantity * food.grams_per_unit) / food.reference_amount
  return 0
}

export function foodNutrition(food: Food, quantity: number, unit: string): NutritionValues {
  const factor = foodNutritionFactor(food, quantity, unit)
  return {
    calories: (food.calories ?? 0) * factor,
    protein: (food.protein_g ?? 0) * factor,
    carbs: (food.carbs_g ?? 0) * factor,
    fat: (food.fat_g ?? 0) * factor,
    fiber: (food.fiber_g ?? 0) * factor,
  }
}

export function recipeNutrition(ingredients: RecipeIngredient[], servings: number) {
  let unresolved = 0
  const total = sumNutrition(
    ingredients.map((ingredient) => {
      if (!ingredient.foods) {
        unresolved += 1
        return emptyNutrition()
      }
      const factor = foodNutritionFactor(ingredient.foods, ingredient.quantity, ingredient.unit)
      if (factor <= 0) unresolved += 1
      return foodNutrition(ingredient.foods, ingredient.quantity, ingredient.unit)
    }),
  )
  const portions = servings > 0 ? servings : 1
  return { total, perServing: scaleNutrition(total, 1 / portions), unresolved }
}

export function foodCost(food: Food, quantity: number, unit: string) {
  if (food.price === null) return 0
  return food.price * foodNutritionFactor(food, quantity, unit)
}

export function recipeCost(ingredients: RecipeIngredient[], servings: number) {
  let unresolved = 0
  const total = ingredients.reduce((cost, ingredient) => {
    if (!ingredient.foods || ingredient.foods.price === null) {
      unresolved += 1
      return cost
    }
    const factor = foodNutritionFactor(ingredient.foods, ingredient.quantity, ingredient.unit)
    if (factor <= 0) unresolved += 1
    return cost + foodCost(ingredient.foods, ingredient.quantity, ingredient.unit)
  }, 0)
  const portions = servings > 0 ? servings : 1
  return { total, perServing: total / portions, unresolved }
}

export function sum(values: number[]) {
  return values.reduce((total, value) => total + (Number.isFinite(value) ? value : 0), 0)
}

export function percentage(part: number, total: number) {
  if (!Number.isFinite(part) || !Number.isFinite(total) || total <= 0) return 0
  return Math.min(100, Math.max(0, (part / total) * 100))
}

export function average(values: number[]) {
  return values.length ? sum(values) / values.length : 0
}

export function taskCompletionRate(tasks: Task[]) {
  if (!tasks.length) return 0
  return percentage(tasks.filter((task) => task.status === 'completed').length, tasks.length)
}

export function isTaskOverdue(task: Task, todayISO: string) {
  return task.status === 'pending' && Boolean(task.due_date) && task.due_date! < todayISO
}

export function taskDueLabel(task: Task, todayISO: string) {
  if (!task.due_date) return 'Sin fecha'
  if (task.due_date < todayISO) return 'Atrasada'
  if (task.due_date === todayISO) return 'Hoy'
  return task.due_date
}

export function trainingVolume(logs: ExerciseLog[]) {
  return sum(logs.map((log) => (log.sets ?? 0) * (log.reps ?? 0) * (log.weight_kg ?? 0)))
}

export function cardioTotals(logs: ExerciseLog[]) {
  return {
    distance: sum(logs.map((log) => log.distance_m ?? 0)),
    seconds: sum(logs.map((log) => log.duration_sec ?? 0)),
  }
}

export function sessionMinutes(sessions: WorkoutSession[]) {
  return sum(sessions.filter((session) => session.status === 'completed').map((session) => session.duration_min))
}

export function nutritionTotals(logs: FoodLog[]) {
  return {
    calories: sum(logs.map((log) => log.calories ?? 0)),
    protein: sum(logs.map((log) => log.protein_g ?? 0)),
    carbs: sum(logs.map((log) => log.carbs_g ?? 0)),
    fat: sum(logs.map((log) => log.fat_g ?? 0)),
    fiber: sum(logs.map((log) => log.fiber_g ?? 0)),
    withNutrition: logs.filter((log) => log.calories !== null).length,
  }
}

export function goalProgressTotal(goal: Goal, progress: GoalProgress[]) {
  return sum(progress.filter((entry) => entry.goal_id === goal.id).map((entry) => entry.value))
}

export function goalPercentage(goal: Goal, progress: GoalProgress[]) {
  return percentage(goalProgressTotal(goal, progress), goal.target_value)
}

export type PantryStatus = 'out' | 'low' | 'ok'

export function pantryStatus(item: PantryItem): PantryStatus {
  if (item.quantity <= 0) return 'out'
  if (item.quantity <= item.min_quantity) return 'low'
  return 'ok'
}

export function pantryStatusLabel(item: PantryItem) {
  const status = pantryStatus(item)
  if (status === 'out') return 'Agotado'
  if (status === 'low') return 'Por agotarse'
  return 'Disponible'
}

export function shoppingLineTotal(quantity: number, unitPrice: number) {
  if (!Number.isFinite(quantity) || !Number.isFinite(unitPrice)) return 0
  return Math.round(quantity * unitPrice * 100) / 100
}

export function shoppingUnitPrice(lineTotal: number, quantity: number) {
  if (!Number.isFinite(lineTotal) || !Number.isFinite(quantity) || quantity <= 0) return 0
  return Math.round((lineTotal / quantity) * 10000) / 10000
}

export function shoppingTotal(items: ShoppingListItem[], price: 'estimated' | 'actual' = 'estimated') {
  return sum(
    items.map((item) => {
      const value = price === 'actual' ? item.actual_price ?? item.estimated_price : item.estimated_price
      return value ?? 0
    }),
  )
}

export function daysUntil(dateISO: string, today = new Date()) {
  const [year, month, day] = dateISO.split('-').map(Number)
  const target = Date.UTC(year, (month || 1) - 1, day || 1)
  const start = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())
  return Math.round((target - start) / 86400000)
}

export function bestSet(logs: ExerciseLog[]) {
  if (!logs.length) return null
  return logs.reduce((best, log) => {
    const currentScore = (log.weight_kg ?? 0) * (log.reps ?? 0)
    const bestScore = (best.weight_kg ?? 0) * (best.reps ?? 0)
    return currentScore > bestScore ? log : best
  }, logs[0])
}

export function weeklyBuckets(dates: Date[], values: number[]) {
  const map = new Map<string, number>()
  dates.forEach((date, index) => {
    const monday = new Date(date)
    const day = monday.getDay()
    monday.setDate(monday.getDate() + (day === 0 ? -6 : 1 - day))
    const key = `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}`
    map.set(key, (map.get(key) ?? 0) + (values[index] ?? 0))
  })
  return Array.from(map.entries()).map(([week, value]) => ({ week, value }))
}
