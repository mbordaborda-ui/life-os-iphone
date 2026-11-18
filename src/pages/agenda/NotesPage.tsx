import { ArrowLeft, NotebookPen, Pin, PinOff, Plus, Save, Search, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { AgendaNav } from '../../components/agenda/AgendaNav'
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  Input,
  LoadingState,
  PageHeader,
  SaveIndicator,
  Textarea,
  useToast,
} from '../../components/ui'
import { useAuth } from '../../hooks/useAuth'
import { useQuery } from '../../hooks/useQuery'
import { db } from '../../lib/supabase'
import { cn, errorMessage, splitTags } from '../../lib/utils'
import type { Note } from '../../types'

type Draft = { title: string; content: string; tags: string }

export default function NotesPage() {
  const { user } = useAuth()
  const { push } = useToast()
  const [search, setSearch] = useState('')
  const [tagFilter, setTagFilter] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [draft, setDraft] = useState<Draft>({ title: '', content: '', tags: '' })
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [deleteTarget, setDeleteTarget] = useState<Note | null>(null)
  const [deleting, setDeleting] = useState(false)
  const dirtyRef = useRef(false)

  const notesQuery = useQuery<Note[]>(
    async () => {
      const { data, error } = await db()
        .from('notes')
        .select('*')
        .order('is_pinned', { ascending: false })
        .order('updated_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as Note[]
    },
    [],
    [],
  )

  const selected = notesQuery.data.find((note) => note.id === selectedId) ?? null

  useEffect(() => {
    if (!selectedId) return
    const note = notesQuery.data.find((item) => item.id === selectedId)
    if (!note) return
    setDraft({ title: note.title, content: note.content, tags: note.tags.join(', ') })
    dirtyRef.current = false
    setSaveStatus('saved')
    // Solo se recarga al cambiar de nota, no en cada guardado.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId])

  async function persist(noteId: string, value: Draft) {
    const payload = {
      title: value.title.trim() || 'Sin título',
      content: value.content,
      tags: splitTags(value.tags),
    }
    const { data, error } = await db().from('notes').update(payload).eq('id', noteId).select('*').single()
    if (error) throw error
    notesQuery.setData((current) => current.map((note) => (note.id === noteId ? (data as Note) : note)))
    return data as Note
  }

  useEffect(() => {
    if (!selectedId || !dirtyRef.current) return
    setSaveStatus('saving')
    const timer = window.setTimeout(() => {
      persist(selectedId, draft)
        .then(() => {
          dirtyRef.current = false
          setSaveStatus('saved')
        })
        .catch((reason) => {
          setSaveStatus('error')
          push(errorMessage(reason), 'error')
        })
    }, 750)
    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, selectedId])

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
        event.preventDefault()
        if (selectedId) saveNow()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, draft])

  function updateDraft(next: Partial<Draft>) {
    setDraft((current) => ({ ...current, ...next }))
    dirtyRef.current = true
    setSaveStatus('idle')
  }

  async function saveNow(notify = true) {
    if (!selectedId) return
    setSaveStatus('saving')
    try {
      await persist(selectedId, draft)
      dirtyRef.current = false
      setSaveStatus('saved')
      if (notify) push('Nota guardada')
    } catch (reason) {
      setSaveStatus('error')
      push(errorMessage(reason), 'error')
    }
  }

  async function leaveNote() {
    if (selectedId && dirtyRef.current) {
      try {
        await persist(selectedId, draft)
      } catch (reason) {
        push(errorMessage(reason), 'error')
        return
      }
    }
    dirtyRef.current = false
    setSelectedId(null)
  }

  async function selectNote(id: string) {
    if (selectedId && dirtyRef.current) {
      try {
        await persist(selectedId, draft)
      } catch (reason) {
        push(errorMessage(reason), 'error')
        return
      }
    }
    dirtyRef.current = false
    setSelectedId(id)
  }

  async function createNote() {
    if (!user) return
    try {
      if (selectedId && dirtyRef.current) await persist(selectedId, draft)
      const { data, error } = await db()
        .from('notes')
        .insert({ user_id: user.id, title: 'Sin título', content: '' })
        .select('*')
        .single()
      if (error) throw error
      notesQuery.setData((current) => [data as Note, ...current])
      setSelectedId((data as Note).id)
      setDraft({ title: 'Sin título', content: '', tags: '' })
      dirtyRef.current = false
      setSaveStatus('saved')
    } catch (reason) {
      push(errorMessage(reason), 'error')
    }
  }

  async function togglePin(note: Note) {
    try {
      const { data, error } = await db()
        .from('notes')
        .update({ is_pinned: !note.is_pinned })
        .eq('id', note.id)
        .select('*')
        .single()
      if (error) throw error
      notesQuery.setData((current) =>
        current
          .map((item) => (item.id === note.id ? (data as Note) : item))
          .sort((a, b) => Number(b.is_pinned) - Number(a.is_pinned) || b.updated_at.localeCompare(a.updated_at)),
      )
    } catch (reason) {
      push(errorMessage(reason), 'error')
    }
  }

  async function deleteNote() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const { error } = await db().from('notes').delete().eq('id', deleteTarget.id)
      if (error) throw error
      notesQuery.setData((current) => current.filter((note) => note.id !== deleteTarget.id))
      if (selectedId === deleteTarget.id) {
        setSelectedId(null)
        dirtyRef.current = false
      }
      push('Nota eliminada')
      setDeleteTarget(null)
    } catch (reason) {
      push(errorMessage(reason), 'error')
    } finally {
      setDeleting(false)
    }
  }

  const tags = useMemo(
    () => Array.from(new Set(notesQuery.data.flatMap((note) => note.tags))).sort((a, b) => a.localeCompare(b)),
    [notesQuery.data],
  )

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return notesQuery.data
      .filter(
        (note) =>
          !term ||
          note.title.toLowerCase().includes(term) ||
          note.content.toLowerCase().includes(term) ||
          note.tags.some((tag) => tag.toLowerCase().includes(term)),
      )
      .filter((note) => !tagFilter || note.tags.includes(tagFilter))
      .sort((a, b) => Number(b.is_pinned) - Number(a.is_pinned) || b.updated_at.localeCompare(a.updated_at))
  }, [notesQuery.data, search, tagFilter])

  if (notesQuery.loading) return <LoadingState label="Cargando notas" />
  if (notesQuery.error) return <ErrorState message={notesQuery.error} onRetry={notesQuery.reload} />

  return (
    <div className="space-y-5 animate-fade-up">
      <PageHeader
        eyebrow="Agenda"
        title="Notas"
        description="Pensamientos, referencias y decisiones. Guardadas mientras escribes."
        actions={
          <Button variant="primary" onClick={createNote}>
            <Plus className="h-4 w-4" /> Nueva nota
          </Button>
        }
      />

      <AgendaNav />

      <div className="grid gap-4 lg:grid-cols-[330px_1fr]">
        <Card className={cn('overflow-hidden', selected && 'hidden lg:block')}>
          <div className="space-y-2 border-b border-ink-700/60 p-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-600" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar en título y contenido"
                className="pl-9"
              />
            </div>
            {tags.length > 0 && (
              <div className="no-scrollbar flex gap-1.5 overflow-x-auto pb-0.5">
                <button
                  onClick={() => setTagFilter('')}
                  className={cn(
                    'shrink-0 rounded-full px-2.5 py-1 text-[10px]',
                    !tagFilter ? 'bg-lime/10 text-lime' : 'bg-ink-800 text-zinc-500',
                  )}
                >
                  Todas
                </button>
                {tags.map((tag) => (
                  <button
                    key={tag}
                    onClick={() => setTagFilter(tag === tagFilter ? '' : tag)}
                    className={cn(
                      'shrink-0 rounded-full px-2.5 py-1 text-[10px]',
                      tagFilter === tag ? 'bg-lime/10 text-lime' : 'bg-ink-800 text-zinc-500',
                    )}
                  >
                    #{tag}
                  </button>
                ))}
              </div>
            )}
          </div>
          {filtered.length ? (
            <div className="max-h-[65vh] divide-y divide-ink-700/60 overflow-y-auto">
              {filtered.map((note) => (
                <button
                  key={note.id}
                  onClick={() => selectNote(note.id)}
                  className={cn(
                    'block w-full px-4 py-3 text-left transition hover:bg-ink-800/60',
                    selectedId === note.id && 'bg-ink-800',
                  )}
                >
                  <div className="flex items-center gap-2">
                    {note.is_pinned && <Pin className="h-3 w-3 shrink-0 fill-lime text-lime" />}
                    <p className="truncate text-xs font-semibold text-white">{note.title}</p>
                  </div>
                  <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-zinc-500">
                    {note.content || 'Nota vacía'}
                  </p>
                  <p className="mt-1.5 text-[9px] uppercase tracking-[0.1em] text-zinc-700">
                    {new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short' }).format(new Date(note.updated_at))}
                  </p>
                </button>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<NotebookPen className="h-5 w-5" />}
              title={notesQuery.data.length ? 'Sin resultados' : 'Aún no hay notas'}
              description={notesQuery.data.length ? 'Prueba otra búsqueda o etiqueta.' : 'Crea una nota para empezar.'}
              action={
                notesQuery.data.length ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setSearch('')
                      setTagFilter('')
                    }}
                  >
                    Limpiar filtros
                  </Button>
                ) : (
                  <Button size="sm" onClick={createNote}>
                    <Plus className="h-3.5 w-3.5" /> Nueva nota
                  </Button>
                )
              }
            />
          )}
        </Card>

        <Card className={cn('min-h-[520px]', !selected && 'hidden lg:block')}>
          {selected ? (
            <div className="flex h-full flex-col">
              <div className="flex items-center justify-between gap-2 border-b border-ink-700/60 px-3 py-2.5 sm:px-4">
                <div className="flex items-center gap-2">
                  <button
                    onClick={leaveNote}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 hover:bg-ink-800 lg:hidden"
                    aria-label="Volver a notas"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </button>
                  <SaveIndicator status={saveStatus} />
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" onClick={() => togglePin(selected)}>
                    {selected.is_pinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
                    {selected.is_pinned ? 'Desfijar' : 'Fijar'}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => void saveNow()} disabled={saveStatus === 'saving'}>
                    <Save className="h-3.5 w-3.5" /> Guardar
                  </Button>
                  <button
                    onClick={() => setDeleteTarget(selected)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-600 hover:bg-red-500/10 hover:text-red-400"
                    aria-label="Eliminar nota"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              <div className="flex-1 space-y-4 p-4 sm:p-6">
                <input
                  value={draft.title}
                  onChange={(event) => updateDraft({ title: event.target.value })}
                  onBlur={() => {
                    if (dirtyRef.current) void saveNow(false)
                  }}
                  className="w-full bg-transparent text-2xl font-semibold tracking-[-0.03em] text-white outline-none placeholder:text-zinc-700"
                  placeholder="Título de la nota"
                />
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    value={draft.tags}
                    onChange={(event) => updateDraft({ tags: event.target.value })}
                    onBlur={() => {
                      if (dirtyRef.current) void saveNow(false)
                    }}
                    placeholder="Etiquetas separadas por comas"
                    className="h-9 max-w-sm text-xs"
                  />
                  {selected.tags.slice(0, 3).map((tag) => (
                    <Badge key={tag} tone="muted">
                      #{tag}
                    </Badge>
                  ))}
                </div>
                <Textarea
                  value={draft.content}
                  onChange={(event) => updateDraft({ content: event.target.value })}
                  onBlur={() => {
                    if (dirtyRef.current) void saveNow(false)
                  }}
                  placeholder="Escribe sin interrupciones…"
                  className="min-h-[340px] resize-none border-0 bg-transparent px-0 text-[15px] leading-7 focus:ring-0"
                />
              </div>
              <div className="border-t border-ink-700/60 px-4 py-2.5 text-[10px] text-zinc-700 sm:px-6">
                Guardado automático activo · ⌘S para guardar ahora
              </div>
            </div>
          ) : (
            <EmptyState
              className="min-h-[520px]"
              icon={<NotebookPen className="h-5 w-5" />}
              title="Selecciona una nota"
              description="Elige una nota de la lista o crea una nueva para empezar a escribir."
              action={
                <Button onClick={createNote}>
                  <Plus className="h-4 w-4" /> Nueva nota
                </Button>
              }
            />
          )}
        </Card>
      </div>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Eliminar nota"
        description="La nota y su contenido se eliminarán de forma permanente."
        onCancel={() => setDeleteTarget(null)}
        onConfirm={deleteNote}
        loading={deleting}
      />
    </div>
  )
}
