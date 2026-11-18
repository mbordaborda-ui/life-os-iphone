export type CategoryKind = 'activity' | 'task' | 'recipe' | 'food'
export type Recurrence = 'none' | 'daily' | 'weekdays' | 'weekly' | 'monthly' | 'custom'
export type TaskPriority = 'low' | 'medium' | 'high'
export type TaskStatus = 'pending' | 'completed'
export type GoalPeriod = 'weekly' | 'monthly'
export type GoalStatus = 'active' | 'completed' | 'archived'
export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack'
export type FrequencyPeriod = 'weekly' | 'monthly'
export type PantryReason = 'purchase' | 'consumption' | 'waste' | 'adjustment'
export type ShoppingStatus = 'open' | 'completed'
export type WorkoutType = 'strength' | 'cardio' | 'other' | 'rest'
export type SessionStatus = 'completed' | 'skipped'
export type FinanceTransactionKind = 'expense' | 'income' | 'saving' | 'withdrawal'

export interface Profile {
  id: string
  display_name: string
  timezone: string
  unit_system: 'metric' | 'imperial'
  created_at: string
  updated_at: string
}

export interface Category {
  id: string
  user_id: string
  kind: CategoryKind
  name: string
  color: string
  created_at: string
  updated_at: string
}

export interface Activity {
  id: string
  user_id: string
  title: string
  notes: string | null
  location: string | null
  category_id: string | null
  start_at: string
  end_at: string
  all_day: boolean
  recurrence: Recurrence
  recurrence_until: string | null
  recurrence_weekdays: number[]
  recurrence_count: number | null
  completed: boolean
  completed_at: string | null
  created_at: string
  updated_at: string
}

export interface Task {
  id: string
  user_id: string
  title: string
  notes: string | null
  priority: TaskPriority
  due_date: string | null
  category_id: string | null
  status: TaskStatus
  completed_at: string | null
  created_at: string
  updated_at: string
}

export interface Note {
  id: string
  user_id: string
  title: string
  content: string
  tags: string[]
  is_pinned: boolean
  created_at: string
  updated_at: string
}

export interface Goal {
  id: string
  user_id: string
  title: string
  description: string | null
  period: GoalPeriod
  metric_unit: string
  target_value: number
  start_date: string
  end_date: string | null
  status: GoalStatus
  category_id: string | null
  created_at: string
  updated_at: string
}

export interface GoalProgress {
  id: string
  user_id: string
  goal_id: string
  value: number
  recorded_on: string
  note: string | null
  created_at: string
}

export interface GoalTaskLink {
  user_id: string
  goal_id: string
  task_id: string
  created_at: string
}

export interface Recipe {
  id: string
  user_id: string
  name: string
  description: string | null
  instructions: string
  prep_minutes: number | null
  servings: number
  category_id: string | null
  is_favorite: boolean
  tags: string[]
  created_at: string
  updated_at: string
}

export type NutritionUnit = 'g' | 'ml'

export interface Food {
  id: string
  user_id: string
  name: string
  brand: string | null
  category: string | null
  nutrition_unit: NutritionUnit
  reference_amount: number
  calories: number | null
  protein_g: number | null
  carbs_g: number | null
  fat_g: number | null
  fiber_g: number | null
  grams_per_unit: number | null
  price: number | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface RecipeIngredient {
  id: string
  user_id: string
  recipe_id: string
  food_id: string
  name: string
  quantity: number
  unit: string
  notes: string | null
  position: number
  created_at: string
  foods?: Food | null
}

export interface RecipeWithIngredients extends Recipe {
  recipe_ingredients: RecipeIngredient[]
}

export interface MealPlan {
  id: string
  user_id: string
  plan_date: string
  meal_type: MealType
  recipe_id: string | null
  title: string | null
  servings: number
  notes: string | null
  is_consumed: boolean
  consumed_at: string | null
  created_at: string
  updated_at: string
}

export interface MealPlanWithRecipe extends MealPlan {
  recipes:
    | (Pick<Recipe, 'id' | 'name' | 'servings'> & { recipe_ingredients?: RecipeIngredient[] })
    | null
}

export interface FoodLog {
  id: string
  user_id: string
  log_date: string
  meal_type: MealType
  food_id: string | null
  food_name: string
  quantity: number
  unit: string
  calories: number | null
  protein_g: number | null
  carbs_g: number | null
  fat_g: number | null
  fiber_g: number | null
  notes: string | null
  meal_plan_id: string | null
  recipe_id: string | null
  created_at: string
}

export interface PriorityFood {
  id: string
  user_id: string
  name: string
  category: string | null
  unit: string
  period: FrequencyPeriod
  target_count: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface PriorityFoodLog {
  id: string
  user_id: string
  priority_food_id: string
  logged_on: string
  quantity: number
  notes: string | null
  created_at: string
}

export interface PantryItem {
  id: string
  user_id: string
  name: string
  category: string | null
  location: string | null
  quantity: number
  unit: string
  min_quantity: number
  expires_on: string | null
  created_at: string
  updated_at: string
}

export interface PantryTransaction {
  id: string
  user_id: string
  pantry_item_id: string
  delta: number
  reason: PantryReason
  note: string | null
  created_at: string
}

export interface ShoppingList {
  id: string
  user_id: string
  name: string
  status: ShoppingStatus
  notes: string | null
  completed_at: string | null
  created_at: string
  updated_at: string
}

export interface ShoppingListItem {
  id: string
  user_id: string
  list_id: string
  name: string
  category: string | null
  quantity: number
  unit: string
  estimated_price: number | null
  actual_price: number | null
  is_checked: boolean
  pantry_item_id: string | null
  created_at: string
  updated_at: string
}

export interface FinancePlan {
  id: string
  user_id: string
  monthly_income: number
  savings_target: number
  emergency_target: number
  emergency_balance: number
  notes: string | null
  created_at: string
  updated_at: string
}

export interface FinanceTransaction {
  id: string
  user_id: string
  tx_date: string
  kind: FinanceTransactionKind
  category: string | null
  description: string
  amount: number
  notes: string | null
  created_at: string
  updated_at: string
}

export interface Exercise {
  id: string
  user_id: string
  name: string
  muscle_group: string | null
  exercise_type: Exclude<WorkoutType, 'rest'>
  notes: string | null
  created_at: string
}

export interface WorkoutRoutine {
  id: string
  user_id: string
  weekday: number
  title: string
  workout_type: WorkoutType
  muscle_groups: string[]
  is_rest: boolean
  notes: string | null
  created_at: string
  updated_at: string
}

export interface RoutineItem {
  id: string
  user_id: string
  routine_id: string
  exercise_id: string
  position: number
  sets: number | null
  reps: number | null
  distance_m: number | null
  duration_min: number | null
  notes: string | null
}

export interface WorkoutRoutineWithItems extends WorkoutRoutine {
  routine_items: Array<RoutineItem & { exercises: Pick<Exercise, 'id' | 'name' | 'muscle_group' | 'exercise_type'> | null }>
}

export interface WorkoutSession {
  id: string
  user_id: string
  session_date: string
  started_at: string | null
  duration_min: number
  workout_type: Exclude<WorkoutType, 'rest'>
  status: SessionStatus
  notes: string | null
  routine_id: string | null
  created_at: string
  updated_at: string
}

export interface ExerciseLog {
  id: string
  user_id: string
  session_id: string
  exercise_id: string | null
  exercise_name: string
  muscle_group: string | null
  sets: number | null
  reps: number | null
  weight_kg: number | null
  distance_m: number | null
  duration_sec: number | null
  notes: string | null
  position: number
  created_at: string
}

export interface WorkoutSessionWithLogs extends WorkoutSession {
  exercise_logs: ExerciseLog[]
}

export interface ActivityOccurrence extends Activity {
  occurrence_date: string
  occurrence_start: string
  occurrence_end: string
  is_recurring_instance: boolean
}
