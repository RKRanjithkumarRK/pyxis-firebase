'use client'

import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import {
  Activity,
  CheckCircle,
  Clock,
  Cpu,
  RefreshCw,
  Zap,
  MessageSquare,
  Mic,
  Image,
  TrendingUp,
  AlertCircle,
} from 'lucide-react'

// ── Types ──────────────────────────────────────────────────────────────
interface ProviderStat {
  provider: string
  count: number
}

interface FeatureStat {
  feature: string
  count: number
}

interface DailyCount {
  day: string
  count: number
}

interface RecentRequest {
  feature: string
  provider: string
  model: string
  latency_ms: number
  success: boolean
  time: string
}

interface DashboardData {
  total_requests: number
  success_rate: number
  avg_latency_ms: number
  top_model: string
  by_provider: ProviderStat[]
  by_feature: FeatureStat[]
  daily_requests: DailyCount[]
  recent_requests: RecentRequest[]
}

// ── Provider color map ─────────────────────────────────────────────────
const PROVIDER_COLORS: Record<string, string> = {
  gemini:      'bg-blue-500',
  groq:        'bg-orange-500',
  cerebras:    'bg-purple-500',
  sambanova:   'bg-green-500',
  openai:      'bg-emerald-500',
  openrouter:  'bg-pink-500',
  huggingface: 'bg-yellow-500',
  pollinations:'bg-teal-500',
}

const PROVIDER_BADGE: Record<string, string> = {
  gemini:      'bg-blue-500/20 text-blue-400',
  groq:        'bg-orange-500/20 text-orange-400',
  cerebras:    'bg-purple-500/20 text-purple-400',
  sambanova:   'bg-green-500/20 text-green-400',
  openai:      'bg-emerald-500/20 text-emerald-400',
  openrouter:  'bg-pink-500/20 text-pink-400',
  huggingface: 'bg-yellow-500/20 text-yellow-400',
  pollinations:'bg-teal-500/20 text-teal-400',
}

const FEATURE_ICONS: Record<string, JSX.Element> = {
  chat:  <MessageSquare className="w-4 h-4" />,
  voice: <Mic className="w-4 h-4" />,
  image: <Image className="w-4 h-4" />,
}

// ── Stat card ──────────────────────────────────────────────────────────
function StatCard({
  icon, label, value, sub, color,
}: {
  icon: React.ReactNode
  label: string
  value: string | number
  sub?: string
  color: string
}) {
  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-neutral-400 text-sm font-medium">{label}</span>
        <div className={`p-2 rounded-xl ${color}`}>{icon}</div>
      </div>
      <div className="text-3xl font-bold text-white mb-1">{value}</div>
      {sub && <div className="text-neutral-500 text-xs">{sub}</div>}
    </div>
  )
}

// ── Provider bar chart (pure CSS) ──────────────────────────────────────
function ProviderChart({ data }: { data: ProviderStat[] }) {
  const max = Math.max(...data.map(d => d.count), 1)
  return (
    <div className="space-y-3">
      {data.map(d => (
        <div key={d.provider}>
          <div className="flex items-center justify-between mb-1">
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${PROVIDER_BADGE[d.provider] || 'bg-neutral-700 text-neutral-300'}`}>
              {d.provider}
            </span>
            <span className="text-neutral-400 text-xs">{d.count.toLocaleString()} reqs</span>
          </div>
          <div className="h-2 bg-neutral-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ${PROVIDER_COLORS[d.provider] || 'bg-neutral-500'}`}
              style={{ width: `${(d.count / max) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Daily sparkline (pure CSS) ─────────────────────────────────────────
function DailyChart({ data }: { data: DailyCount[] }) {
  const max = Math.max(...data.map(d => d.count), 1)
  const days = data.slice(-7)
  return (
    <div className="flex items-end gap-1 h-16">
      {days.map((d, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1">
          <div
            className="w-full bg-blue-500 rounded-sm transition-all duration-500 opacity-80 hover:opacity-100"
            style={{ height: `${Math.max(4, (d.count / max) * 52)}px` }}
            title={`${d.day}: ${d.count} requests`}
          />
          <span className="text-neutral-600 text-[9px]">
            {d.day ? new Date(d.day).toLocaleDateString([], { weekday: 'short' }) : ''}
          </span>
        </div>
      ))}
    </div>
  )
}

// ── Main dashboard ─────────────────────────────────────────────────────
export default function DashboardPage() {
  const { currentUser } = useAuth()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const fetchDashboard = useCallback(async () => {
    if (!currentUser) return
    setLoading(true)
    try {
      const token = await currentUser.getIdToken()
      const res = await fetch('/api/analytics?endpoint=dashboard', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const json = await res.json()
        setData(json)
        setLastUpdated(new Date())
      }
    } catch (err) {
      console.error('Dashboard fetch error:', err)
    } finally {
      setLoading(false)
    }
  }, [currentUser])

  useEffect(() => {
    fetchDashboard()
    // Auto-refresh every 60 seconds
    const interval = setInterval(fetchDashboard, 60_000)
    return () => clearInterval(interval)
  }, [fetchDashboard])

  if (loading && !data) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
        <div className="flex items-center gap-3 text-neutral-400">
          <RefreshCw className="w-5 h-5 animate-spin" />
          <span>Loading analytics...</span>
        </div>
      </div>
    )
  }

  const d = data!

  return (
    <div className="min-h-screen bg-neutral-950 text-white">
      <div className="max-w-6xl mx-auto px-6 py-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <TrendingUp className="w-6 h-6 text-blue-400" />
              Analytics Dashboard
            </h1>
            <p className="text-neutral-500 text-sm mt-1">
              Real-time metrics for Pyxis One
            </p>
          </div>
          <div className="flex items-center gap-4">
            {lastUpdated && (
              <span className="text-neutral-600 text-xs">
                Updated {lastUpdated.toLocaleTimeString()}
              </span>
            )}
            <button
              onClick={fetchDashboard}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-neutral-800 hover:bg-neutral-700 rounded-xl text-sm text-neutral-300 transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <StatCard
            icon={<Activity className="w-4 h-4 text-blue-400" />}
            label="Total Requests"
            value={d.total_requests.toLocaleString()}
            sub="All time"
            color="bg-blue-500/10"
          />
          <StatCard
            icon={<CheckCircle className="w-4 h-4 text-green-400" />}
            label="Success Rate"
            value={`${d.success_rate}%`}
            sub="Last 30 days"
            color="bg-green-500/10"
          />
          <StatCard
            icon={<Clock className="w-4 h-4 text-orange-400" />}
            label="Avg Latency"
            value={`${d.avg_latency_ms}ms`}
            sub="Successful requests"
            color="bg-orange-500/10"
          />
          <StatCard
            icon={<Zap className="w-4 h-4 text-purple-400" />}
            label="Top Model"
            value={d.top_model || '—'}
            sub="Most used"
            color="bg-purple-500/10"
          />
        </div>

        {/* Middle row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">

          {/* Provider chart */}
          <div className="md:col-span-2 bg-neutral-900 border border-neutral-800 rounded-2xl p-6">
            <h2 className="text-sm font-semibold text-neutral-300 mb-4 flex items-center gap-2">
              <Cpu className="w-4 h-4 text-blue-400" />
              Requests by Provider
              <span className="text-neutral-600 text-xs font-normal ml-1">(last 30 days)</span>
            </h2>
            {d.by_provider.length > 0 ? (
              <ProviderChart data={d.by_provider} />
            ) : (
              <EmptyState label="No provider data yet" />
            )}
          </div>

          {/* Feature breakdown */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6">
            <h2 className="text-sm font-semibold text-neutral-300 mb-4 flex items-center gap-2">
              <Activity className="w-4 h-4 text-purple-400" />
              By Feature
            </h2>
            {d.by_feature.length > 0 ? (
              <div className="space-y-3">
                {d.by_feature.map(f => (
                  <div key={f.feature} className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-neutral-300 text-sm capitalize">
                      {FEATURE_ICONS[f.feature] || <Activity className="w-4 h-4" />}
                      {f.feature}
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-20 h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-purple-500 rounded-full"
                          style={{ width: `${(f.count / (d.total_requests || 1)) * 100}%` }}
                        />
                      </div>
                      <span className="text-neutral-400 text-xs w-8 text-right">{f.count}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState label="No feature data yet" />
            )}
          </div>
        </div>

        {/* Daily sparkline */}
        {d.daily_requests.length > 0 && (
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 mb-8">
            <h2 className="text-sm font-semibold text-neutral-300 mb-4 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-green-400" />
              Requests — Last 7 Days
            </h2>
            <DailyChart data={d.daily_requests} />
          </div>
        )}

        {/* Recent requests table */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6">
          <h2 className="text-sm font-semibold text-neutral-300 mb-4 flex items-center gap-2">
            <Clock className="w-4 h-4 text-orange-400" />
            Recent Requests
          </h2>
          {d.recent_requests.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-neutral-500 text-xs border-b border-neutral-800">
                    <th className="text-left pb-3 pr-4 font-medium">Feature</th>
                    <th className="text-left pb-3 pr-4 font-medium">Provider</th>
                    <th className="text-left pb-3 pr-4 font-medium">Model</th>
                    <th className="text-left pb-3 pr-4 font-medium">Latency</th>
                    <th className="text-left pb-3 pr-4 font-medium">Status</th>
                    <th className="text-left pb-3 font-medium">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800/50">
                  {d.recent_requests.map((r, i) => (
                    <tr key={i} className="hover:bg-neutral-800/30 transition-colors">
                      <td className="py-2.5 pr-4">
                        <div className="flex items-center gap-1.5 text-neutral-300 capitalize">
                          {FEATURE_ICONS[r.feature] || <Activity className="w-4 h-4" />}
                          {r.feature}
                        </div>
                      </td>
                      <td className="py-2.5 pr-4">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PROVIDER_BADGE[r.provider] || 'bg-neutral-700 text-neutral-300'}`}>
                          {r.provider}
                        </span>
                      </td>
                      <td className="py-2.5 pr-4 text-neutral-400 text-xs max-w-[160px] truncate">
                        {r.model || '—'}
                      </td>
                      <td className="py-2.5 pr-4">
                        <span className={`text-xs font-mono ${r.latency_ms < 1000 ? 'text-green-400' : r.latency_ms < 3000 ? 'text-yellow-400' : 'text-red-400'}`}>
                          {r.latency_ms}ms
                        </span>
                      </td>
                      <td className="py-2.5 pr-4">
                        {r.success ? (
                          <span className="flex items-center gap-1 text-green-400 text-xs">
                            <CheckCircle className="w-3 h-3" /> OK
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-red-400 text-xs">
                            <AlertCircle className="w-3 h-3" /> Failed
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 text-neutral-500 text-xs">
                        {r.time}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState label="No requests yet — start chatting to see data here" />
          )}
        </div>

      </div>
    </div>
  )
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-neutral-600">
      <Activity className="w-8 h-8 mb-2 opacity-40" />
      <p className="text-sm">{label}</p>
    </div>
  )
}
