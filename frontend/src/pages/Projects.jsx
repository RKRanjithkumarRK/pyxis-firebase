import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { FolderOpen, Plus, Trash2, Edit2, Check, X, MessageSquare } from 'lucide-react'
import { apiJSON } from '../utils/api'
import toast from 'react-hot-toast'

const TAGS = ['Research', 'Coding', 'Writing', 'Work', 'Personal', 'Finance', 'Travel', 'Homework']

// Accent palette — these are intentional brand colors, not theme backgrounds
const TAG_COLORS = {
  Research: { backgroundColor: 'rgba(59,130,246,0.15)', color: '#93c5fd' },
  Coding:   { backgroundColor: 'rgba(234,179,8,0.15)',  color: '#fde68a' },
  Writing:  { backgroundColor: 'rgba(139,92,246,0.15)', color: '#c4b5fd' },
  Work:     { backgroundColor: 'rgba(34,197,94,0.15)',  color: '#86efac' },
  Personal: { backgroundColor: 'rgba(236,72,153,0.15)', color: '#f9a8d4' },
  Finance:  { backgroundColor: 'rgba(16,185,129,0.15)', color: '#6ee7b7' },
  Travel:   { backgroundColor: 'rgba(6,182,212,0.15)',  color: '#67e8f9' },
  Homework: { backgroundColor: 'rgba(249,115,22,0.15)', color: '#fdba74' },
}

export default function Projects() {
  const { id: selectedId } = useParams()
  const navigate = useNavigate()

  const [projects, setProjects] = useState([])
  const [convos,   setConvos]   = useState([])
  const [loading,  setLoading]  = useState(true)
  const [creating, setCreating] = useState(false)
  const [newName,  setNewName]  = useState('')
  const [newTags,  setNewTags]  = useState([])
  const [editId,   setEditId]   = useState(null)
  const [editName, setEditName] = useState('')
  const [hovered,  setHovered]  = useState(null)

  useEffect(() => {
    Promise.all([
      apiJSON('/api/projects'),
      apiJSON('/api/conversations'),
    ])
      .then(([p, c]) => { setProjects(p); setConvos(c) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const create = async () => {
    if (!newName.trim()) return
    try {
      const p = await apiJSON('/api/projects', {
        method: 'POST',
        body: JSON.stringify({ name: newName.trim(), tags: newTags }),
      })
      setProjects(prev => [p, ...prev])
      setCreating(false); setNewName(''); setNewTags([])
      navigate(`/projects/${p.id}`)
    } catch { toast.error('Create failed') }
  }

  const deleteProject = async (id) => {
    try {
      await apiJSON(`/api/projects/${id}`, { method: 'DELETE' })
      setProjects(prev => prev.filter(p => p.id !== id))
      if (selectedId === id) navigate('/projects')
    } catch { toast.error('Delete failed') }
  }

  const saveEdit = async (id) => {
    if (!editName.trim()) return
    try {
      const updated = await apiJSON(`/api/projects/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ name: editName.trim() }),
      })
      setProjects(prev => prev.map(p => p.id === id ? updated : p))
      setEditId(null)
    } catch { toast.error('Update failed') }
  }

  const toggleTag = (tag) => {
    setNewTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag])
  }

  const selected = projects.find(p => p.id === selectedId)
  const projectConvos = selectedId ? convos.filter(c => c.projectId === selectedId) : []

  return (
    <div className="flex h-screen" style={{ backgroundColor: 'var(--bg-app)' }}>

      {/* ── Left: project list ─────────────────────────────────── */}
      <div
        className="w-72 shrink-0 border-r flex flex-col"
        style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-sidebar)' }}
      >
        {/* Header */}
        <div
          className="p-4 border-b flex items-center justify-between"
          style={{ borderColor: 'var(--border-color)' }}
        >
          <div className="flex items-center gap-2">
            <FolderOpen className="w-4 h-4" style={{ color: 'var(--color-primary-light)' }} />
            <h1 className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
              Projects
            </h1>
          </div>
          <button
            onClick={() => setCreating(true)}
            className="p-1.5 rounded-lg transition-colors"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={e => {
              e.currentTarget.style.color = 'var(--text-primary)'
              e.currentTarget.style.backgroundColor = 'var(--bg-input)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.color = 'var(--text-muted)'
              e.currentTarget.style.backgroundColor = 'transparent'
            }}
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {/* Create form */}
        {creating && (
          <div
            className="p-3 border-b"
            style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-card)' }}
          >
            <input
              autoFocus
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && create()}
              placeholder="Project name"
              className="input text-xs py-2 mb-2"
            />
            <div className="flex flex-wrap gap-1 mb-2">
              {TAGS.map(tag => (
                <button
                  key={tag}
                  onClick={() => toggleTag(tag)}
                  className="text-[10px] px-2 py-0.5 rounded-full transition-colors"
                  style={
                    newTags.includes(tag)
                      ? (TAG_COLORS[tag] || { backgroundColor: 'var(--bg-input)', color: 'var(--text-secondary)' })
                      : { backgroundColor: 'var(--bg-input)', color: 'var(--text-muted)' }
                  }
                >
                  {tag}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={create} className="btn-primary text-xs py-1.5 px-3 flex-1 justify-center">
                Create
              </button>
              <button
                onClick={() => { setCreating(false); setNewName(''); setNewTags([]) }}
                className="btn-ghost text-xs py-1.5 px-3"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {loading ? (
            [...Array(3)].map((_, i) => (
              <div
                key={i}
                className="h-14 rounded-xl animate-pulse"
                style={{ backgroundColor: 'var(--bg-input)' }}
              />
            ))
          ) : projects.length === 0 ? (
            <p className="text-xs text-center py-8" style={{ color: 'var(--text-muted)' }}>
              No projects yet
            </p>
          ) : projects.map(p => (
            <div
              key={p.id}
              onClick={() => navigate(`/projects/${p.id}`)}
              onMouseEnter={() => setHovered(p.id)}
              onMouseLeave={() => setHovered(null)}
              className="px-3 py-2.5 rounded-xl cursor-pointer group transition-all"
              style={{
                backgroundColor:
                  selectedId === p.id
                    ? 'var(--bg-input)'
                    : hovered === p.id
                      ? 'color-mix(in srgb, var(--bg-input) 60%, transparent)'
                      : 'transparent',
              }}
            >
              {editId === p.id ? (
                <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                  <input
                    autoFocus
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && saveEdit(p.id)}
                    className="flex-1 rounded-lg px-2 py-1 text-xs focus:outline-none"
                    style={{
                      backgroundColor: 'var(--bg-app)',
                      color: 'var(--text-primary)',
                      border: '1px solid var(--border-color)',
                    }}
                  />
                  <button onClick={() => saveEdit(p.id)} className="text-green-400 p-0.5">
                    <Check className="w-3 h-3" />
                  </button>
                  <button onClick={() => setEditId(null)} style={{ color: 'var(--text-muted)' }} className="p-0.5">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2">
                    <FolderOpen className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--color-primary-light)' }} />
                    <span className="text-sm flex-1 truncate" style={{ color: 'var(--text-secondary)' }}>
                      {p.name}
                    </span>
                    <div className="hidden group-hover:flex items-center gap-1">
                      <button
                        onClick={e => { e.stopPropagation(); setEditId(p.id); setEditName(p.name) }}
                        className="p-0.5 transition-colors"
                        style={{ color: 'var(--text-muted)' }}
                        onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-primary)' }}
                        onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)' }}
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                      <button
                        onClick={e => { e.stopPropagation(); deleteProject(p.id) }}
                        className="p-0.5 transition-colors"
                        style={{ color: 'var(--text-muted)' }}
                        onMouseEnter={e => { e.currentTarget.style.color = '#f87171' }}
                        onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)' }}
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                  {p.tags?.length > 0 && (
                    <div className="flex gap-1 mt-1.5 flex-wrap">
                      {p.tags.map(tag => (
                        <span
                          key={tag}
                          className="text-[10px] px-1.5 py-0.5 rounded-full"
                          style={TAG_COLORS[tag] || { backgroundColor: 'var(--bg-input)', color: 'var(--text-muted)' }}
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── Right: project detail ──────────────────────────────── */}
      <div className="flex-1 p-6 overflow-auto">
        {!selected ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
            <FolderOpen className="w-12 h-12" style={{ color: 'var(--text-muted)', opacity: 0.35 }} />
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              Select or create a project
            </p>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Organize your conversations and work by project
            </p>
            <button onClick={() => setCreating(true)} className="btn-primary mt-2">
              <Plus className="w-4 h-4" /> New Project
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
                  {selected.name}
                </h2>
                {selected.tags?.length > 0 && (
                  <div className="flex gap-1.5 mt-2 flex-wrap">
                    {selected.tags.map(tag => (
                      <span
                        key={tag}
                        className="text-xs px-2 py-0.5 rounded-full"
                        style={TAG_COLORS[tag] || { backgroundColor: 'var(--bg-input)', color: 'var(--text-muted)' }}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <Link
                to={`/chat?projectId=${selected.id}`}
                className="btn-primary text-sm"
              >
                <MessageSquare className="w-4 h-4" /> New Chat
              </Link>
            </div>

            {projectConvos.length === 0 ? (
              <div className="card p-8 text-center">
                <MessageSquare className="w-8 h-8 mx-auto mb-2" style={{ color: 'var(--text-muted)', opacity: 0.35 }} />
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                  No conversations in this project yet
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {projectConvos.map(c => (
                  <Link
                    key={c.id}
                    to={`/chat/${c.id}`}
                    className="card flex items-center gap-3 px-4 py-3 no-underline transition-colors"
                    style={{ color: 'var(--text-secondary)' }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--color-primary)' }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-color)' }}
                  >
                    <MessageSquare className="w-4 h-4 shrink-0" style={{ color: 'var(--text-muted)' }} />
                    <span className="flex-1 text-sm truncate">{c.title}</span>
                  </Link>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
