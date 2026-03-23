import { createContext, useContext, useEffect, useState } from 'react'

const WorkspaceContext = createContext(null)

const STORAGE_KEY = 'pyxis_workspace_state'

const DEFAULT_STATE = { workspaces: [], activeId: null }

/* ── Compact context string for AI prompt injection ─────────── */
const TYPE_LABELS = {
  research: '📋 research', code: '💻 code', image: '🖼 image',
  document: '📄 document', voice: '🎤 voice', prompt: '📝 prompt', chat: '💬 chat',
}

function buildContextString(workspace) {
  if (!workspace) return ''
  const lines = [`Active task: ${workspace.goal || workspace.name}`]
  if (workspace.artifacts?.length) {
    lines.push('\nGathered context:')
    // Keep newest artifacts first, cap at 6 to stay within ~1500 chars
    const recent = [...workspace.artifacts].reverse().slice(0, 6)
    for (const a of recent) {
      const label = TYPE_LABELS[a.type] || a.type
      const snippet = a.content ? a.content.slice(0, 200).replace(/\n+/g, ' ') : ''
      lines.push(`- [${label}] ${a.title}: ${snippet}`)
    }
  }
  return lines.join('\n').slice(0, 1500)
}

export function WorkspaceProvider({ children }) {
  const [state, setState] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) return { ...DEFAULT_STATE, ...JSON.parse(saved) }
    } catch {}
    return DEFAULT_STATE
  })

  // Persist every change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  }, [state])

  const activeWorkspace = state.workspaces.find(w => w.id === state.activeId) ?? null

  /* ── Create & activate a new workspace ──────────────────────── */
  const createWorkspace = (name, goal = '') => {
    const ws = {
      id: crypto.randomUUID(),
      name,
      goal,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      artifacts: [],
    }
    setState(prev => ({
      workspaces: [ws, ...prev.workspaces],
      activeId: ws.id,
    }))
    return ws
  }

  /* ── Switch active workspace ─────────────────────────────────── */
  const setActiveWorkspace = (id) => {
    setState(prev => ({ ...prev, activeId: id }))
  }

  /* ── Deactivate (workspace still saved) ─────────────────────── */
  const clearActiveWorkspace = () => {
    setState(prev => ({ ...prev, activeId: null }))
  }

  /* ── Add artifact to active workspace ───────────────────────── */
  const addArtifact = (artifact) => {
    if (!state.activeId) return
    const entry = {
      id: crypto.randomUUID(),
      type: artifact.type || 'note',
      title: artifact.title || 'Untitled',
      content: (artifact.content || '').slice(0, 800),
      imageUrl: artifact.imageUrl ?? null,
      source: artifact.source || '',
      addedAt: Date.now(),
    }
    setState(prev => ({
      ...prev,
      workspaces: prev.workspaces.map(w =>
        w.id === prev.activeId
          ? { ...w, updatedAt: Date.now(), artifacts: [...w.artifacts, entry] }
          : w
      ),
    }))
  }

  /* ── Remove artifact from active workspace ──────────────────── */
  const removeArtifact = (artifactId) => {
    if (!state.activeId) return
    setState(prev => ({
      ...prev,
      workspaces: prev.workspaces.map(w =>
        w.id === prev.activeId
          ? { ...w, artifacts: w.artifacts.filter(a => a.id !== artifactId) }
          : w
      ),
    }))
  }

  /* ── Delete workspace entirely ──────────────────────────────── */
  const deleteWorkspace = (id) => {
    setState(prev => ({
      workspaces: prev.workspaces.filter(w => w.id !== id),
      activeId: prev.activeId === id ? null : prev.activeId,
    }))
  }

  /* ── Build compact context string for AI injection ──────────── */
  const getContextString = () => buildContextString(activeWorkspace)

  return (
    <WorkspaceContext.Provider value={{
      activeWorkspace,
      workspaces: state.workspaces,
      createWorkspace,
      setActiveWorkspace,
      clearActiveWorkspace,
      addArtifact,
      removeArtifact,
      deleteWorkspace,
      getContextString,
    }}>
      {children}
    </WorkspaceContext.Provider>
  )
}

export const useWorkspace = () => useContext(WorkspaceContext)
