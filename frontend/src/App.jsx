import { Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import { useEffect } from 'react'
import { useAuth } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import { WorkspaceProvider } from './context/WorkspaceContext'
import { ImageGenerationProvider, useImageGeneration } from './context/ImageGenerationContext'
import Sidebar       from './components/Sidebar'
import Login         from './pages/Login'
import Hub           from './pages/Hub'
import Chat          from './pages/Chat'
import Images        from './pages/Images'
import Voice         from './pages/Voice'
import Research      from './pages/Research'
import Agents        from './pages/Agents'
import CodeStudio    from './pages/CodeStudio'
import Rag           from './pages/Rag'
import Projects      from './pages/Projects'
import Settings      from './pages/Settings'
import Admin         from './pages/Admin'
import Arena         from './pages/Arena'
import PromptLibrary from './pages/PromptLibrary'
import Schedules     from './pages/Schedules'

function Spinner() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-5" style={{ backgroundColor: 'var(--bg-app)' }}>
      {/* Pyxis brand mark */}
      <div className="relative">
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-2xl"
          style={{ background: 'linear-gradient(135deg, var(--color-primary), var(--color-primary-light))' }}
        >
          {/* P letter mark */}
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
            <path d="M8 6h10a6 6 0 0 1 0 12H8V6z" fill="white" fillOpacity="0.95"/>
            <path d="M8 18v8" stroke="white" strokeWidth="3.5" strokeLinecap="round"/>
          </svg>
        </div>
        {/* Pulse ring */}
        <div
          className="absolute inset-0 rounded-2xl animate-ping"
          style={{ backgroundColor: 'var(--color-primary)', opacity: 0.2, animationDuration: '1.5s' }}
        />
      </div>
      {/* Brand name */}
      <div className="text-center">
        <p className="text-lg font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>Pyxis</p>
        <div className="flex items-center justify-center gap-1 mt-2">
          {[0, 1, 2].map(i => (
            <div
              key={i}
              className="w-1.5 h-1.5 rounded-full animate-bounce"
              style={{ backgroundColor: 'var(--color-primary)', animationDelay: `${i * 0.15}s` }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <Spinner />
  if (!user) return <Navigate to="/login" replace />
  return children
}

function AdminRoute({ children }) {
  const { user, loading, isAdmin } = useAuth()
  if (loading) return <Spinner />
  if (!user) return <Navigate to="/login" replace />
  if (!isAdmin) return <Navigate to="/hub" replace />
  return children
}

function AppLayout({ children }) {
  return (
    <div className="flex" style={{ height: '100dvh', overflow: 'hidden', backgroundColor: 'var(--bg-app)', color: 'var(--text-primary)' }}>
      <Sidebar />
      <main className="flex-1 min-w-0 overflow-auto" style={{ height: '100%' }}>
        {children}
      </main>
    </div>
  )
}

function CodeLayout({ children }) {
  return (
    <div className="flex" style={{ height: '100dvh', overflow: 'hidden', backgroundColor: 'var(--bg-app)', color: 'var(--text-primary)' }}>
      <Sidebar />
      <main className="flex-1 min-w-0 overflow-hidden" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        {children}
      </main>
    </div>
  )
}

function Protected({ children }) {
  return (
    <ProtectedRoute>
      <AppLayout>{children}</AppLayout>
    </ProtectedRoute>
  )
}

/** Registers navigate + exposes auth token globally for ImageGenerationContext */
function AppBootstrap({ children }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { setNavigate } = useImageGeneration()

  useEffect(() => {
    setNavigate(() => navigate)
  }, [navigate, setNavigate])

  // Expose token getter so ImageGenerationContext can attach auth headers
  useEffect(() => {
    window.__getAuthToken = async () => {
      try { return await user?.getIdToken() ?? '' }
      catch { return '' }
    }
  }, [user])

  return children
}

export default function App() {
  return (
    <ThemeProvider>
    <WorkspaceProvider>
    <ImageGenerationProvider>
    <AppBootstrap>
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/"      element={<Navigate to="/hub" replace />} />

      <Route path="/hub"            element={<Protected><Hub /></Protected>} />
      <Route path="/chat"           element={<Protected><Chat /></Protected>} />
      <Route path="/chat/:id"       element={<Protected><Chat /></Protected>} />
      <Route path="/images"         element={<Protected><Images /></Protected>} />
      <Route path="/voice"          element={<Protected><Voice /></Protected>} />
      <Route path="/research"       element={<Protected><Research /></Protected>} />
      <Route path="/agents"         element={<Protected><Agents /></Protected>} />
      <Route path="/code"           element={<ProtectedRoute><CodeLayout><CodeStudio /></CodeLayout></ProtectedRoute>} />
      <Route path="/rag"            element={<Protected><Rag /></Protected>} />
      <Route path="/projects"       element={<Protected><Projects /></Protected>} />
      <Route path="/projects/:id"   element={<Protected><Projects /></Protected>} />
      <Route path="/settings"       element={<Protected><Settings /></Protected>} />
      <Route path="/arena"          element={<Protected><Arena /></Protected>} />
      <Route path="/prompts"        element={<Protected><PromptLibrary /></Protected>} />
      <Route path="/schedules"      element={<Protected><Schedules /></Protected>} />
      <Route path="/admin"          element={
        <ProtectedRoute>
          <AppLayout><Admin /></AppLayout>
        </ProtectedRoute>
      } />

      <Route path="*" element={<Navigate to="/hub" replace />} />
    </Routes>
    </AppBootstrap>
    </ImageGenerationProvider>
    </WorkspaceProvider>
    </ThemeProvider>
  )
}
