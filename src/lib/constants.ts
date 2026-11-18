import type { MealType, TaskPriority, WorkoutType } from '../types'

export const MEAL_LABELS: Record<MealType, string> = {
  breakfast: 'Desayuno',
  lunch: 'Comida',
  dinner: 'Cena',
  snack: 'Snack',
}

export const MEAL_TYPES: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack']

export const PRIORITY_LABELS: Record<TaskPriority, string> = {
  low: 'Baja',
  medium: 'Media',
  high: 'Alta',
}

export const WORKOUT_LABELS: Record<WorkoutType, string> = {
  strength: 'Fuerza',
  cardio: 'Cardio',
  other: 'Otro',
  rest: 'Descanso',
}

export const UNITS = ['ud', 'g', 'kg', 'ml', 'l', 'cucharada', 'cucharadita', 'taza', 'ración', 'paquete', 'lata']
export const MUSCLE_GROUPS = ['Pecho', 'Espalda', 'Piernas', 'Hombros', 'Brazos', 'Core', 'Glúteos', 'Full body', 'Cardio']
export const FOOD_CATEGORIES = ['Frutas', 'Verduras', 'Proteína', 'Lácteos', 'Cereales', 'Legumbres', 'Grasas', 'Despensa', 'Congelados', 'Otros']

export const FINANCE_EXPENSE_CATEGORIES = [
  'Vivienda',
  'Mercado',
  'Transporte',
  'Servicios',
  'Salud',
  'Educación',
  'Restaurantes',
  'Ocio',
  'Ropa',
  'Tecnología',
  'Deudas',
  'Otros',
]

export const FINANCE_INCOME_CATEGORIES = ['Salario', 'Freelance', 'Ventas', 'Inversiones', 'Bonos', 'Otros']

export const FINANCE_SAVINGS_CATEGORIES = ['Ahorro mensual', 'Ahorro extraordinario', 'Fondo de emergencia', 'Inversión', 'Otros']

export const FINANCE_WITHDRAWAL_CATEGORIES = ['Retiro de ahorro', 'Emergencia', 'Gasto imprevisto', 'Inversión', 'Otros']

export const CHART_COLORS = [
  '#b8f36b',
  '#7dd3fc',
  '#a78bfa',
  '#fbbf24',
  '#f472b6',
  '#fb923c',
  '#34d399',
  '#f87171',
  '#22d3ee',
  '#c084fc',
]
