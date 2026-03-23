import { createContext, useContext, useState, useCallback } from 'react'
import { X, CheckCircle2 } from 'lucide-react'
import toast from 'react-hot-toast'

const TaskContext = createContext(null)

function TaskBar({ tasks, onDismiss }) {
  if (!tasks.length) return null
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2" style={{ maxWidth: 340 }}>
      {tasks.map(task => (
        <div
          key={task.id}
          className="flex items-center gap-3 px-4 py-3 rounded-2xl shadow-2xl"
          style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            backdropFilter: 'blur(12px)',
          }}
        >
          {task.status === 'running' ? (
            <div
              className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin shrink-0"
              style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }}
            />
          ) : (
            <CheckCircle2 className="w-4 h-4 shrink-0" style={{ color: '#4ade80' }} />
          )}
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
              {task.label}
            </p>
            <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
              {task.status === 'running' ? 'Running in background…' : 'Complete — navigate back to view'}
            </p>
          </div>
          <button onClick={() => onDismiss(task.id)} style={{ color: 'var(--text-muted)' }}>
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  )
}

export function TaskProvider({ children }) {
  const [tasks, setTasks] = useState([])

  const addTask = useCallback((label, type = 'generic') => {
    const id = crypto.randomUUID()
    setTasks(prev => [...prev, { id, label, type, status: 'running', startedAt: Date.now() }])
    return id
  }, [])

  const completeTask = useCallback((id) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, status: 'done' } : t))
    toast.success('Background task complete', { id: `task-done-${id}`, duration: 4000 })
    // Auto-dismiss after 6s
    setTimeout(() => setTasks(prev => prev.filter(t => t.id !== id)), 6000)
  }, [])

  const failTask = useCallback((id, message) => {
    setTasks(prev => prev.filter(t => t.id !== id))
    toast.error(message || 'Background task failed', { id: `task-fail-${id}` })
  }, [])

  const dismissTask = useCallback((id) => {
    setTasks(prev => prev.filter(t => t.id !== id))
  }, [])

  const visibleTasks = tasks.filter(t => t.status === 'running' || t.status === 'done')

  return (
    <TaskContext.Provider value={{ addTask, completeTask, failTask }}>
      {children}
      <TaskBar tasks={visibleTasks} onDismiss={dismissTask} />
    </TaskContext.Provider>
  )
}

export const useTask = () => useContext(TaskContext)
