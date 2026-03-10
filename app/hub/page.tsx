'use client'
import { useRouter } from 'next/navigation'

const SKILLS = [
  { num: 1,  title: 'Prompt Engineering',    desc: 'Write & refine powerful prompts for any AI model',        icon: '✍️',  href: '/chat',           color: 'from-violet-500 to-purple-600',   free: true  },
  { num: 2,  title: 'AI Workflow',           desc: 'Chain AI tasks into automated multi-step pipelines',      icon: '⚙️',  href: '/tools/agents',   color: 'from-orange-500 to-amber-500',    free: true  },
  { num: 3,  title: 'AI Agents',             desc: 'AI-powered web search — find & synthesize live results',  icon: '🤖',  href: '/tools/search',   color: 'from-blue-500 to-cyan-500',       free: true  },
  { num: 4,  title: 'RAG',                   desc: 'Chat with your documents using AI',                       icon: '📄',  href: '/tools/rag',      color: 'from-emerald-500 to-green-500',   free: true  },
  { num: 5,  title: 'Multimodal AI',         desc: 'Generate images from text — free, no API key needed',    icon: '👁️',  href: '/images',         color: 'from-pink-500 to-rose-500',       free: true  },
  { num: 6,  title: 'Fine-Tuning',           desc: 'Custom AI prompts & system instructions library',         icon: '🎛️',  href: '/tools/prompts',  color: 'from-indigo-500 to-blue-500',     free: true  },
  { num: 7,  title: 'Voice AI',              desc: 'Talk to AI — speech-to-text & text-to-speech',            icon: '🎙️',  href: '/voice',          color: 'from-teal-500 to-cyan-500',       free: true  },
  { num: 8,  title: 'AI Tool Stacking',      desc: 'Run the same prompt across multiple AI models at once',   icon: '🔧',  href: '/tools/compare',  color: 'from-yellow-500 to-orange-500',   free: true  },
  { num: 9,  title: 'AI Video Content',      desc: 'Generate video scripts, storyboards & creative prompts',  icon: '🎬',  href: '/tools/code',     color: 'from-red-500 to-pink-500',        free: true  },
  { num: 10, title: 'SaaS Development',      desc: 'AI code generator & software architecture helper',        icon: '💻',  href: '/tools/code',     color: 'from-slate-500 to-gray-600',      free: true  },
  { num: 11, title: 'LLM Management',        desc: 'Compare top free AI models side-by-side in real time',   icon: '📊',  href: '/tools/compare',  color: 'from-purple-500 to-violet-600',   free: true  },
  { num: 12, title: 'Staying Updated',       desc: 'Live AI news from TechCrunch, Verge, MIT & more',        icon: '📰',  href: '/tools/news',     color: 'from-cyan-500 to-blue-500',       free: true  },
]

export default function HubPage() {
  const router = useRouter()
  return (
    <div className="min-h-[100dvh] bg-bg text-text-primary p-6 overflow-y-auto">
      {/* Hero */}
      <div className="max-w-5xl mx-auto mb-10 text-center pt-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-500/10 border border-indigo-500/20 rounded-full text-indigo-400 text-xs font-medium mb-4">
          ✨ 100% Free · No API Key Required
        </div>
        <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-white via-indigo-200 to-purple-400 bg-clip-text text-transparent">
          12 AI Skills Hub
        </h1>
        <p className="text-text-secondary text-lg max-w-xl mx-auto">
          Master every AI skill in one place — completely free, powered by Google Gemini AI.
        </p>
      </div>

      {/* Grid */}
      <div className="max-w-5xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {SKILLS.map((skill) => (
          <button
            key={skill.num}
            onClick={() => router.push(skill.href)}
            className="group text-left p-5 rounded-2xl bg-surface border border-border hover:border-indigo-500/40 transition-all duration-200 hover:-translate-y-0.5"
          >
            <div className="flex items-start gap-3 mb-3">
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${skill.color} flex items-center justify-center text-xl flex-shrink-0`}>
                {skill.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-xs text-text-tertiary font-mono">#{skill.num}</span>
                  <span className="text-xs bg-green-500/10 text-green-400 px-1.5 py-0.5 rounded-full font-medium">FREE</span>
                </div>
                <h3 className="text-text-primary font-semibold text-sm leading-tight">{skill.title}</h3>
              </div>
            </div>
            <p className="text-text-tertiary text-xs leading-relaxed">{skill.desc}</p>
          </button>
        ))}
      </div>

      {/* Footer */}
      <div className="max-w-5xl mx-auto mt-10 text-center text-text-tertiary text-xs pb-8">
        Powered by Google Gemini AI · Gemini 2.5 Flash · Gemini 2.0 Flash · and more
      </div>
    </div>
  )
}
