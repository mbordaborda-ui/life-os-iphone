import type { NutritionUnit } from '../types'
import type { NutritionValues } from './calculations'

export interface CatalogFood {
  name: string
  category: string
  nutritionUnit: NutritionUnit
  calories: number
  protein: number
  carbs: number
  fat: number
  fiber: number
  gramsPerUnit?: number
}

export interface RecommendedIngredient {
  food: string
  quantity: number
  unit: 'g' | 'ml' | 'ud'
  notes?: string
}

export interface RecommendedRecipe {
  slug: string
  name: string
  description: string
  instructions: string
  prepMinutes: number
  servings: number
  tags: string[]
  ingredients: RecommendedIngredient[]
}

export const BASIC_FOODS: CatalogFood[] = [
  { name: 'Plátano', category: 'Frutas', nutritionUnit: 'g', calories: 89, protein: 1.1, carbs: 22.8, fat: 0.3, fiber: 2.6 },
  { name: 'Manzana', category: 'Frutas', nutritionUnit: 'g', calories: 52, protein: 0.3, carbs: 13.8, fat: 0.2, fiber: 2.4 },
  { name: 'Naranja', category: 'Frutas', nutritionUnit: 'g', calories: 47, protein: 0.9, carbs: 11.8, fat: 0.1, fiber: 2.4 },
  { name: 'Fresas', category: 'Frutas', nutritionUnit: 'g', calories: 32, protein: 0.7, carbs: 7.7, fat: 0.3, fiber: 2 },
  { name: 'Arándanos', category: 'Frutas', nutritionUnit: 'g', calories: 57, protein: 0.7, carbs: 14.5, fat: 0.3, fiber: 2.4 },
  { name: 'Aguacate', category: 'Frutas', nutritionUnit: 'g', calories: 160, protein: 2, carbs: 8.5, fat: 14.7, fiber: 6.7 },
  { name: 'Limón', category: 'Frutas', nutritionUnit: 'g', calories: 29, protein: 1.1, carbs: 9.3, fat: 0.3, fiber: 2.8 },
  { name: 'Brócoli', category: 'Verduras', nutritionUnit: 'g', calories: 34, protein: 2.8, carbs: 6.6, fat: 0.4, fiber: 2.6 },
  { name: 'Espinacas', category: 'Verduras', nutritionUnit: 'g', calories: 23, protein: 2.9, carbs: 3.6, fat: 0.4, fiber: 2.2 },
  { name: 'Tomate', category: 'Verduras', nutritionUnit: 'g', calories: 18, protein: 0.9, carbs: 3.9, fat: 0.2, fiber: 1.2 },
  { name: 'Tomate triturado', category: 'Verduras', nutritionUnit: 'g', calories: 32, protein: 1.6, carbs: 7, fat: 0.3, fiber: 1.9 },
  { name: 'Zanahoria', category: 'Verduras', nutritionUnit: 'g', calories: 41, protein: 0.9, carbs: 9.6, fat: 0.2, fiber: 2.8 },
  { name: 'Cebolla', category: 'Verduras', nutritionUnit: 'g', calories: 40, protein: 1.1, carbs: 9.3, fat: 0.1, fiber: 1.7 },
  { name: 'Pimiento rojo', category: 'Verduras', nutritionUnit: 'g', calories: 31, protein: 1, carbs: 6, fat: 0.3, fiber: 2.1 },
  { name: 'Calabacín', category: 'Verduras', nutritionUnit: 'g', calories: 17, protein: 1.2, carbs: 3.1, fat: 0.3, fiber: 1 },
  { name: 'Patata', category: 'Verduras', nutritionUnit: 'g', calories: 77, protein: 2, carbs: 17, fat: 0.1, fiber: 2.2 },
  { name: 'Espárragos', category: 'Verduras', nutritionUnit: 'g', calories: 20, protein: 2.2, carbs: 3.9, fat: 0.1, fiber: 2.1 },
  { name: 'Ajo', category: 'Verduras', nutritionUnit: 'g', calories: 149, protein: 6.4, carbs: 33, fat: 0.5, fiber: 2.1 },
  { name: 'Pechuga de pollo', category: 'Proteína', nutritionUnit: 'g', calories: 165, protein: 31, carbs: 0, fat: 3.6, fiber: 0 },
  { name: 'Pechuga de pavo', category: 'Proteína', nutritionUnit: 'g', calories: 135, protein: 30, carbs: 0, fat: 1, fiber: 0 },
  { name: 'Salmón', category: 'Proteína', nutritionUnit: 'g', calories: 208, protein: 20, carbs: 0, fat: 13, fiber: 0 },
  { name: 'Atún al natural', category: 'Proteína', nutritionUnit: 'g', calories: 116, protein: 26, carbs: 0, fat: 1, fiber: 0 },
  { name: 'Huevo', category: 'Proteína', nutritionUnit: 'g', calories: 143, protein: 12.6, carbs: 0.7, fat: 9.5, fiber: 0, gramsPerUnit: 50 },
  { name: 'Lentejas secas', category: 'Legumbres', nutritionUnit: 'g', calories: 352, protein: 25, carbs: 63, fat: 1.1, fiber: 10.7 },
  { name: 'Garbanzos cocidos', category: 'Legumbres', nutritionUnit: 'g', calories: 164, protein: 8.9, carbs: 27.4, fat: 2.6, fiber: 7.6 },
  { name: 'Yogur griego natural', category: 'Lácteos', nutritionUnit: 'g', calories: 97, protein: 9, carbs: 3.9, fat: 5, fiber: 0 },
  { name: 'Leche desnatada', category: 'Lácteos', nutritionUnit: 'ml', calories: 34, protein: 3.4, carbs: 5, fat: 0.1, fiber: 0 },
  { name: 'Queso feta', category: 'Lácteos', nutritionUnit: 'g', calories: 264, protein: 14, carbs: 4.1, fat: 21.3, fiber: 0 },
  { name: 'Queso fresco batido', category: 'Lácteos', nutritionUnit: 'g', calories: 61, protein: 8, carbs: 4, fat: 1, fiber: 0 },
  { name: 'Avena', category: 'Cereales', nutritionUnit: 'g', calories: 389, protein: 16.9, carbs: 66.3, fat: 6.9, fiber: 10.6 },
  { name: 'Arroz integral', category: 'Cereales', nutritionUnit: 'g', calories: 354, protein: 7.5, carbs: 76.2, fat: 2.7, fiber: 3.5 },
  { name: 'Pasta integral', category: 'Cereales', nutritionUnit: 'g', calories: 348, protein: 13, carbs: 75, fat: 2.5, fiber: 8 },
  { name: 'Pan integral', category: 'Cereales', nutritionUnit: 'g', calories: 247, protein: 13, carbs: 41, fat: 3.4, fiber: 7 },
  { name: 'Tortilla integral', category: 'Cereales', nutritionUnit: 'g', calories: 310, protein: 8, carbs: 53, fat: 7, fiber: 6, gramsPerUnit: 40 },
  { name: 'Quinoa', category: 'Cereales', nutritionUnit: 'g', calories: 368, protein: 14, carbs: 64, fat: 6, fiber: 7 },
  { name: 'Aceite de oliva', category: 'Grasas', nutritionUnit: 'ml', calories: 884, protein: 0, carbs: 0, fat: 100, fiber: 0 },
  { name: 'Nueces', category: 'Grasas', nutritionUnit: 'g', calories: 654, protein: 15.2, carbs: 13.7, fat: 65.2, fiber: 6.7 },
  { name: 'Almendras', category: 'Grasas', nutritionUnit: 'g', calories: 579, protein: 21.2, carbs: 21.6, fat: 49.9, fiber: 12.5 },
  { name: 'Crema de cacahuete', category: 'Grasas', nutritionUnit: 'g', calories: 588, protein: 25, carbs: 20, fat: 50, fiber: 6 },
  { name: 'Semillas de chía', category: 'Grasas', nutritionUnit: 'g', calories: 486, protein: 16.5, carbs: 42.1, fat: 30.7, fiber: 34.4 },
  { name: 'Hummus', category: 'Despensa', nutritionUnit: 'g', calories: 166, protein: 7.9, carbs: 14.3, fat: 9.6, fiber: 6 },
  { name: 'Miel', category: 'Despensa', nutritionUnit: 'g', calories: 304, protein: 0.3, carbs: 82.4, fat: 0, fiber: 0.2 },
  { name: 'Salsa de soja', category: 'Despensa', nutritionUnit: 'ml', calories: 53, protein: 8, carbs: 4.9, fat: 0.6, fiber: 0.8 },
  { name: 'Cacao puro', category: 'Despensa', nutritionUnit: 'g', calories: 228, protein: 19.6, carbs: 57.9, fat: 13.7, fiber: 33.2 },
]

const FOOD_MAP = new Map(BASIC_FOODS.map((food) => [food.name, food]))

const BASIC_FOOD_PRICES: Record<string, number> = {
  'Plátano': 250,
  'Manzana': 800,
  'Naranja': 300,
  'Fresas': 1200,
  'Arándanos': 3500,
  'Aguacate': 1000,
  'Limón': 500,
  'Brócoli': 700,
  'Espinacas': 800,
  'Tomate': 400,
  'Tomate triturado': 600,
  'Zanahoria': 300,
  'Cebolla': 300,
  'Pimiento rojo': 600,
  'Calabacín': 600,
  'Patata': 400,
  'Espárragos': 2500,
  'Ajo': 800,
  'Pechuga de pollo': 1500,
  'Pechuga de pavo': 1800,
  'Salmón': 5000,
  'Atún al natural': 2500,
  'Huevo': 1200,
  'Lentejas secas': 700,
  'Garbanzos cocidos': 800,
  'Yogur griego natural': 1200,
  'Leche desnatada': 400,
  'Queso feta': 3000,
  'Queso fresco batido': 1500,
  'Avena': 500,
  'Arroz integral': 700,
  'Pasta integral': 800,
  'Pan integral': 1200,
  'Tortilla integral': 1250,
  'Quinoa': 1500,
  'Aceite de oliva': 4000,
  'Nueces': 3500,
  'Almendras': 3000,
  'Crema de cacahuete': 2000,
  'Semillas de chía': 3000,
  'Hummus': 1500,
  'Miel': 2000,
  'Salsa de soja': 1500,
  'Cacao puro': 2500,
}

export function basicFoodByName(name: string) {
  return FOOD_MAP.get(name) ?? null
}

export function basicFoodPrice(name: string) {
  return BASIC_FOOD_PRICES[name] ?? null
}

function catalogFactor(food: CatalogFood, quantity: number, unit: string) {
  if (!Number.isFinite(quantity) || quantity <= 0) return 0
  if (unit === food.nutritionUnit) return quantity / 100
  if (unit === 'kg' && food.nutritionUnit === 'g') return (quantity * 1000) / 100
  if (unit === 'l' && food.nutritionUnit === 'ml') return (quantity * 1000) / 100
  if (unit === 'ud' && food.gramsPerUnit) return (quantity * food.gramsPerUnit) / 100
  return 0
}

export function catalogNutrition(food: CatalogFood, quantity: number, unit: string): NutritionValues {
  const factor = catalogFactor(food, quantity, unit)
  return {
    calories: food.calories * factor,
    protein: food.protein * factor,
    carbs: food.carbs * factor,
    fat: food.fat * factor,
    fiber: food.fiber * factor,
  }
}

export function catalogCost(food: CatalogFood, quantity: number, unit: string) {
  const price = basicFoodPrice(food.name)
  if (price === null) return 0
  return price * catalogFactor(food, quantity, unit)
}

export function recommendedRecipeCost(recipe: RecommendedRecipe) {
  let unresolved = 0
  const total = recipe.ingredients.reduce((cost, ingredient) => {
    const food = basicFoodByName(ingredient.food)
    if (!food || basicFoodPrice(food.name) === null) {
      unresolved += 1
      return cost
    }
    const factor = catalogFactor(food, ingredient.quantity, ingredient.unit)
    if (factor <= 0) {
      unresolved += 1
      return cost
    }
    return cost + catalogCost(food, ingredient.quantity, ingredient.unit)
  }, 0)
  return { total, perServing: total / recipe.servings, unresolved }
}

export function recommendedRecipeNutrition(recipe: RecommendedRecipe) {
  let unresolved = 0
  const total = recipe.ingredients.reduce(
    (sum, ingredient) => {
      const food = basicFoodByName(ingredient.food)
      if (!food) {
        unresolved += 1
        return sum
      }
      const value = catalogNutrition(food, ingredient.quantity, ingredient.unit)
      return {
        calories: sum.calories + value.calories,
        protein: sum.protein + value.protein,
        carbs: sum.carbs + value.carbs,
        fat: sum.fat + value.fat,
        fiber: sum.fiber + value.fiber,
      }
    },
    { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 },
  )
  const perServing = {
    calories: total.calories / recipe.servings,
    protein: total.protein / recipe.servings,
    carbs: total.carbs / recipe.servings,
    fat: total.fat / recipe.servings,
    fiber: total.fiber / recipe.servings,
  }
  return { total, perServing, unresolved }
}

export const RECOMMENDED_RECIPES: RecommendedRecipe[] = [
  {
    slug: 'desayuno-huevos-aguacate-avena',
    name: 'Desayuno con huevo, aguacate, tostadas y avena',
    description: 'Desayuno completo con proteína, grasas saludables y carbohidratos para empezar con energía.',
    instructions:
      '1. Cocina la avena con la leche a fuego medio hasta que espese.\n2. Prepara los huevos al gusto en una sartén.\n3. Tuesta el pan integral.\n4. Sirve los huevos con el aguacate y las tostadas, y acompaña con la avena.',
    prepMinutes: 12,
    servings: 1,
    tags: ['desayuno', 'alto en proteína'],
    ingredients: [
      { food: 'Huevo', quantity: 3, unit: 'ud' },
      { food: 'Aguacate', quantity: 100, unit: 'g' },
      { food: 'Pan integral', quantity: 60, unit: 'g' },
      { food: 'Avena', quantity: 40, unit: 'g' },
      { food: 'Leche desnatada', quantity: 200, unit: 'ml' },
    ],
  },
  {
    slug: 'bowl-pollo-arroz-brocoli',
    name: 'Bowl de pollo, arroz integral y brócoli',
    description: 'Un bowl completo y fácil de preparar en batch para dos comidas.',
    instructions:
      '1. Cocina el arroz integral según el paquete.\n2. Corta el pollo en tiras y cocínalo en una sartén con una parte del aceite hasta que esté dorado y hecho por dentro.\n3. Cocina el brócoli al vapor 4-5 minutos, hasta que esté tierno pero firme.\n4. Mezcla el resto del aceite con la salsa de soja y el ajo picado.\n5. Reparte el arroz, el pollo y el brócoli en dos bowls y aliña con la salsa.',
    prepMinutes: 25,
    servings: 2,
    tags: ['alto en proteína', 'meal prep'],
    ingredients: [
      { food: 'Pechuga de pollo', quantity: 300, unit: 'g' },
      { food: 'Arroz integral', quantity: 120, unit: 'g' },
      { food: 'Brócoli', quantity: 250, unit: 'g' },
      { food: 'Aceite de oliva', quantity: 10, unit: 'ml' },
      { food: 'Salsa de soja', quantity: 10, unit: 'ml' },
      { food: 'Ajo', quantity: 5, unit: 'g' },
    ],
  },
  {
    slug: 'avena-yogur-platano',
    name: 'Avena con yogur griego, plátano y nueces',
    description: 'Desayuno saciante con carbohidratos complejos, proteína y grasas saludables.',
    instructions:
      '1. Cocina la avena con la leche a fuego medio, removiendo hasta que espese.\n2. Retira del fuego y mezcla la mitad del yogur.\n3. Sirve con el plátano en rodajas, las nueces, la chía y la miel.\n4. Añade el resto del yogur por encima.',
    prepMinutes: 10,
    servings: 2,
    tags: ['desayuno', 'vegetariano'],
    ingredients: [
      { food: 'Avena', quantity: 80, unit: 'g' },
      { food: 'Leche desnatada', quantity: 200, unit: 'ml' },
      { food: 'Yogur griego natural', quantity: 300, unit: 'g' },
      { food: 'Plátano', quantity: 200, unit: 'g' },
      { food: 'Nueces', quantity: 20, unit: 'g' },
      { food: 'Semillas de chía', quantity: 10, unit: 'g' },
      { food: 'Miel', quantity: 10, unit: 'g' },
    ],
  },
  {
    slug: 'lentejas-verduras',
    name: 'Lentejas guisadas con verduras',
    description: 'Un guiso tradicional de legumbres, alto en fibra y perfecto para congelar.',
    instructions:
      '1. Pica la cebolla, el ajo, la zanahoria y el pimiento.\n2. Sofríe las verduras con el aceite 8 minutos.\n3. Añade el tomate triturado y cocina 5 minutos más.\n4. Incorpora las lentejas y cubre con agua. Cocina a fuego lento 25-30 minutos.\n5. Añade las espinacas al final y ajusta de sal.',
    prepMinutes: 45,
    servings: 4,
    tags: ['vegetariano', 'alto en fibra', 'batch cooking'],
    ingredients: [
      { food: 'Lentejas secas', quantity: 300, unit: 'g' },
      { food: 'Zanahoria', quantity: 200, unit: 'g' },
      { food: 'Cebolla', quantity: 150, unit: 'g' },
      { food: 'Tomate triturado', quantity: 400, unit: 'g' },
      { food: 'Pimiento rojo', quantity: 150, unit: 'g' },
      { food: 'Aceite de oliva', quantity: 20, unit: 'ml' },
      { food: 'Ajo', quantity: 10, unit: 'g' },
      { food: 'Espinacas', quantity: 100, unit: 'g' },
    ],
  },
  {
    slug: 'salmon-horno-patata',
    name: 'Salmón al horno con patata y espárragos',
    description: 'Una bandeja de horno con omega-3, hidratos y verduras.',
    instructions:
      '1. Precalienta el horno a 200 °C.\n2. Corta las patatas en gajos y hornéalas con la mitad del aceite durante 20 minutos.\n3. Añade el salmón y los espárragos, aliña con el resto del aceite y el limón.\n4. Hornea 12-15 minutos más, hasta que el salmón esté en su punto.',
    prepMinutes: 35,
    servings: 2,
    tags: ['horno', 'alto en proteína'],
    ingredients: [
      { food: 'Salmón', quantity: 300, unit: 'g' },
      { food: 'Patata', quantity: 400, unit: 'g' },
      { food: 'Espárragos', quantity: 250, unit: 'g' },
      { food: 'Aceite de oliva', quantity: 15, unit: 'ml' },
      { food: 'Limón', quantity: 50, unit: 'g' },
    ],
  },
  {
    slug: 'tortilla-espinacas-feta',
    name: 'Tortilla de espinacas y feta',
    description: 'Cena rápida con huevo, verduras y queso, lista en una sartén.',
    instructions:
      '1. Pica la cebolla y sofríela con el aceite 3 minutos.\n2. Añade las espinacas y cocina hasta que se reduzcan.\n3. Bate los huevos y viértelos en la sartén.\n4. Cocina a fuego medio, añade el feta desmenuzado y dobla la tortilla cuando cuaje.',
    prepMinutes: 15,
    servings: 2,
    tags: ['rápido', 'vegetariano', 'alto en proteína'],
    ingredients: [
      { food: 'Huevo', quantity: 4, unit: 'ud' },
      { food: 'Espinacas', quantity: 150, unit: 'g' },
      { food: 'Queso feta', quantity: 60, unit: 'g' },
      { food: 'Cebolla', quantity: 50, unit: 'g' },
      { food: 'Aceite de oliva', quantity: 10, unit: 'ml' },
    ],
  },
  {
    slug: 'pasta-atun-tomate',
    name: 'Pasta integral con atún y tomate',
    description: 'Una receta de despensa, rápida y con buena cantidad de proteína.',
    instructions:
      '1. Cocina la pasta integral según el paquete.\n2. Mientras tanto, sofríe la cebolla y el ajo con el aceite.\n3. Añade el tomate triturado y cocina 8 minutos.\n4. Incorpora el atún escurrido, mezcla con la pasta y sirve.',
    prepMinutes: 20,
    servings: 2,
    tags: ['rápido', 'despensa', 'alto en proteína'],
    ingredients: [
      { food: 'Pasta integral', quantity: 160, unit: 'g' },
      { food: 'Atún al natural', quantity: 160, unit: 'g' },
      { food: 'Tomate triturado', quantity: 400, unit: 'g' },
      { food: 'Cebolla', quantity: 100, unit: 'g' },
      { food: 'Aceite de oliva', quantity: 15, unit: 'ml' },
      { food: 'Ajo', quantity: 5, unit: 'g' },
    ],
  },
  {
    slug: 'wrap-pavo-hummus',
    name: 'Wrap de pavo, hummus y verduras',
    description: 'Comida fría para llevar, con proteína magra y verduras crujientes.',
    instructions:
      '1. Extiende el hummus sobre las tortillas.\n2. Coloca el pavo y las verduras cortadas en tiras.\n3. Aliña con unas gotas de limón y enrolla apretando bien.\n4. Corta por la mitad para servir.',
    prepMinutes: 10,
    servings: 2,
    tags: ['rápido', 'para llevar', 'alto en proteína'],
    ingredients: [
      { food: 'Tortilla integral', quantity: 2, unit: 'ud' },
      { food: 'Pechuga de pavo', quantity: 200, unit: 'g' },
      { food: 'Hummus', quantity: 80, unit: 'g' },
      { food: 'Tomate', quantity: 100, unit: 'g' },
      { food: 'Espinacas', quantity: 60, unit: 'g' },
      { food: 'Zanahoria', quantity: 80, unit: 'g' },
      { food: 'Limón', quantity: 20, unit: 'g' },
    ],
  },
  {
    slug: 'garbanzos-espinacas-yogur',
    name: 'Garbanzos crujientes con espinacas y yogur',
    description: 'Plato vegetariano con legumbre, hierro vegetal y una salsa fresca de yogur.',
    instructions:
      '1. Escurre y seca los garbanzos.\n2. Cocínalos en una sartén con el aceite y el ajo hasta que estén dorados.\n3. Añade las espinacas y cocina hasta que pierdan volumen.\n4. Sirve con yogur griego y un chorrito de limón.',
    prepMinutes: 20,
    servings: 2,
    tags: ['vegetariano', 'alto en fibra', 'rápido'],
    ingredients: [
      { food: 'Garbanzos cocidos', quantity: 400, unit: 'g' },
      { food: 'Espinacas', quantity: 200, unit: 'g' },
      { food: 'Yogur griego natural', quantity: 100, unit: 'g' },
      { food: 'Aceite de oliva', quantity: 10, unit: 'ml' },
      { food: 'Ajo', quantity: 5, unit: 'g' },
      { food: 'Limón', quantity: 30, unit: 'g' },
    ],
  },
]
