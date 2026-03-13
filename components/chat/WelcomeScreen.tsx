'use client'

import {
  ArrowRight,
  BookOpen,
  Bot,
  Briefcase,
  Code2,
  FileSearch,
  Globe,
  PenTool,
  Radar,
  Workflow,
} from 'lucide-react'

const HIGHLIGHTS = [
  {
    title: 'Research with structure',
    detail: 'Turn live web signals into clean briefs, source-backed memos, and next actions.',
    icon: Radar,
  },
  {
    title: 'Build with context',
    detail: 'Move from coding questions to debugging, rewrites, and workflow design in one place.',
    icon: Code2,
  },
  {
    title: 'Write for real work',
    detail: 'Draft operator notes, strategy documents, launch copy, and client-facing messaging faster.',
    icon: PenTool,
  },
]

const STARTERS = [
  {
    title: 'Draft an executive brief',
    subtitle: 'Turn raw notes into a board-ready summary.',
    prompt: 'Turn my notes into a sharp executive brief with key decisions, risks, and next actions.',
    icon: Briefcase,
  },
  {
    title: 'Run deep research',
    subtitle: 'Build a cited competitive or market report.',
    prompt: 'Run deep research on this topic and structure the result into a cited competitive brief.',
    icon: Radar,
  },
  {
    title: 'Explain and simplify',
    subtitle: 'Break down a concept without losing nuance.',
    prompt: 'Explain this concept clearly, starting simple and then going deeper where it matters.',
    icon: BookOpen,
  },
  {
    title: 'Debug and improve code',
    subtitle: 'Find the bug and suggest the clean fix.',
    prompt: 'Help me debug this code, explain the root cause, and give me the cleanest fix.',
    icon: Code2,
  },
  {
    title: 'Summarize a long source',
    subtitle: 'Extract the signal from a dense document.',
    prompt: 'Summarize this document and pull out the key points, risks, and useful takeaways.',
    icon: FileSearch,
  },
  {
    title: 'Design an AI workflow',
    subtitle: 'Map a business task into a repeatable system.',
    prompt: 'Design an AI workflow for this process with steps, decisions, approvals, and outputs.',
    icon: Workflow,
  },
]

const PROVIDERS = ['Gemini 2.5', 'Llama 3.3', 'Mistral', 'DeepSeek']

interface Props {
  onSend?: (text: string) => void
}

export default function WelcomeScreen({ onSend }: Props) {
  return (
    <div className="space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
        <section className="panel relative overflow-hidden rounded-[32px] p-6 sm:p-8">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(82,180,255,0.12),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(105,216,180,0.12),transparent_34%)]" />
          <div className="relative grid gap-6 xl:grid-cols-[minmax(0,1.08fr)_minmax(300px,0.92fr)]">
            <div>
              <div className="pill text-xs text-text-secondary">
                <Bot size={12} />
                Session ready
              </div>
              <h1 className="mt-4 font-display text-[clamp(2rem,3vw,3.6rem)] leading-[0.96] text-text-primary">
                Start from a clearer brief, not a blank page.
              </h1>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-text-secondary sm:text-[15px]">
                Pyxis One is set up for everyday work across research, writing, code, and planning. Pick a starter below or ask directly in your own words.
              </p>

              <div className="mt-5 grid gap-3 md:grid-cols-3">
                {HIGHLIGHTS.map((item) => (
                  <div key={item.title} className="glass-panel rounded-[24px] p-4">
                    <item.icon className="text-cyan-300" size={18} />
                    <p className="mt-3 text-sm font-semibold text-text-primary">{item.title}</p>
                    <p className="mt-1.5 text-xs leading-6 text-text-secondary">{item.detail}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="glass-panel rounded-[28px] p-5">
              <p className="text-xs uppercase tracking-[0.28em] text-text-tertiary">How people start</p>
              <div className="mt-4 space-y-3">
                {[
                  'Turn notes into an executive update',
                  'Compare competitors with cited sources',
                  'Debug a failing build or script',
                  'Plan a workflow for a manual process',
                ].map((item) => (
                  <div key={item} className="flex items-start gap-3 rounded-[18px] bg-white/8 px-4 py-3">
                    <span className="mt-1 h-2 w-2 rounded-full bg-cyan-300" />
                    <p className="text-sm leading-6 text-text-secondary">{item}</p>
                  </div>
                ))}
              </div>

              <div className="mt-5 rounded-[22px] border border-border/70 bg-white/8 px-4 py-4">
                <p className="text-xs uppercase tracking-[0.24em] text-text-tertiary">Model lanes</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {PROVIDERS.map((provider) => (
                    <span key={provider} className="rounded-full border border-border/70 bg-white/10 px-3 py-1.5 text-xs font-semibold text-text-secondary">
                      {provider}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {STARTERS.map((starter) => (
            <button
              key={starter.title}
              onClick={() => onSend?.(starter.prompt)}
              className="group panel rounded-[28px] p-5 text-left transition-transform hover:-translate-y-1"
            >
              <div className="flex items-center justify-between">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 text-cyan-300">
                  <starter.icon size={18} />
                </div>
                <span className="pill text-[11px] text-text-tertiary">Starter</span>
              </div>
              <p className="mt-5 font-display text-[1.35rem] leading-tight text-text-primary">{starter.title}</p>
              <p className="mt-2 text-sm leading-6 text-text-secondary">{starter.subtitle}</p>
              <div className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-text-secondary transition-colors group-hover:text-text-primary">
                Launch prompt
                <ArrowRight size={14} />
              </div>
            </button>
          ))}
        </section>

        <div className="flex flex-wrap items-center gap-2 text-xs text-text-tertiary">
          <Globe size={13} />
          <span>Search, writing, planning, debugging, and structured AI execution from one workspace.</span>
        </div>
      </div>
    </div>
  )
}
