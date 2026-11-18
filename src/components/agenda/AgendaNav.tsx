import { CalendarDays, ListTodo, NotebookPen } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { cn } from '../../lib/utils'

const LINKS = [
  { to: '/agenda', label: 'Calendario', icon: CalendarDays, end: true },
  { to: '/agenda/tasks', label: 'Tareas', icon: ListTodo, end: false },
  { to: '/agenda/notes', label: 'Notas', icon: NotebookPen, end: false },
]

export function AgendaNav() {
  return (
    <div className="no-scrollbar flex gap-1 overflow-x-auto rounded-xl border border-ink-700 bg-ink-900 p-1">
      {LINKS.map((link) => {
        const Icon = link.icon
        return (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.end}
            className={({ isActive }) =>
              cn(
                'inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg px-3.5 text-xs font-medium transition',
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
  )
}
