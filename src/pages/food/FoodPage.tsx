import { Navigate, useParams } from 'react-router-dom'
import { FoodNav } from '../../components/food/FoodNav'
import FoodsPage from '../../components/food/FoodsPage'
import MealLog from '../../components/food/MealLog'
import MealPlanner from '../../components/food/MealPlanner'
import MarketPage from '../../components/food/MarketPage'
import PantryPage from '../../components/food/PantryPage'
import PriorityFoodsPage from '../../components/food/PriorityFoodsPage'
import RecipesPage from '../../components/food/RecipesPage'

const SECTIONS = ['planner', 'log', 'foods', 'recipes', 'pantry', 'market', 'priority'] as const
type Section = (typeof SECTIONS)[number]

export default function FoodPage() {
  const { section } = useParams<{ section: string }>()
  if (!section || !SECTIONS.includes(section as Section)) return <Navigate to="/food/planner" replace />

  return (
    <div className="space-y-5">
      <FoodNav />
      {section === 'planner' && <MealPlanner />}
      {section === 'log' && <MealLog />}
      {section === 'foods' && <FoodsPage />}
      {section === 'recipes' && <RecipesPage />}
      {section === 'pantry' && <PantryPage />}
      {section === 'market' && <MarketPage />}
      {section === 'priority' && <PriorityFoodsPage />}
    </div>
  )
}
