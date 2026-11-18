import { Apple, BookOpen, CalendarRange, Package, ShoppingCart, Sparkles, UtensilsCrossed } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { cn } from '../../lib/utils'

const LINKS = [
  { to: '/food/planner', label: 'Plan', icon: CalendarRange },
  { to: '/food/log', label: 'Registro', icon: UtensilsCrossed },
  { to: '/food/foods', label: 'Alimentos', icon: Apple },
  { to: '/food/recipes', label: 'Recetas', icon: BookOpen },
  { to: '/food/pantry', label: 'Despensa', icon: Package },
  { to: '/food/market', label: 'Mercado', icon: ShoppingCart },
  { to: '/food/priority', label: 'Prioritarios', icon: Sparkles },
]

export function FoodNav() {
  const navRef = useRef<HTMLDivElement>(null)
  const { pathname } = useLocation()
  const [edges, setEdges] = useState({ start: false, end: false })

  const updateEdges = useCallback(() => {
    const nav = navRef.current
    if (!nav) return
    setEdges({
      start: nav.scrollLeft > 4,
      end: nav.scrollLeft + nav.clientWidth < nav.scrollWidth - 4,
    })
  }, [])

  useEffect(() => {
    const nav = navRef.current
    if (!nav) return
    updateEdges()
    nav.addEventListener('scroll', updateEdges, { passive: true })
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(updateEdges) : null
    observer?.observe(nav)
    return () => {
      nav.removeEventListener('scroll', updateEdges)
      observer?.disconnect()
    }
  }, [updateEdges])

  useEffect(() => {
    const nav = navRef.current
    const active = nav?.querySelector<HTMLElement>('[aria-current="page"]')
    if (!nav || !active) return
    const left = active.offsetLeft
    const right = left + active.offsetWidth
    if (left < nav.scrollLeft) {
      nav.scrollTo({ left: Math.max(0, left - 8), behavior: 'smooth' })
    } else if (right > nav.scrollLeft + nav.clientWidth) {
      nav.scrollTo({ left: right - nav.clientWidth + 8, behavior: 'smooth' })
    }
  }, [pathname])

  return (
    <div className="relative">
      {edges.start && (
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-9 rounded-l-xl bg-gradient-to-r from-ink-900 via-ink-900/85 to-transparent" />
      )}
      {edges.end && (
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-9 rounded-r-xl bg-gradient-to-l from-ink-900 via-ink-900/85 to-transparent" />
      )}
      <div
        ref={navRef}
        aria-label="Secciones de alimentación"
        className="no-scrollbar flex touch-pan-x gap-1 overflow-x-auto overscroll-x-contain rounded-xl border border-ink-700 bg-ink-900 p-1"
      >
        {LINKS.map((link) => {
          const Icon = link.icon
          return (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                cn(
                  'inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg px-3 text-xs font-medium transition',
                  isActive ? 'bg-ink-750 text-white' : 'text-zinc-500 hover:text-zinc-300',
                )
              }
            >
              <Icon className="h-3.5 w-3.5" />
              {link.label}
            </NavLink>
          )
        })}
      </div>
    </div>
  )
}
