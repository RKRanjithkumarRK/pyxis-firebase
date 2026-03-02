import Groq from 'groq-sdk'
import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'
import { GoogleGenerativeAI } from '@google/generative-ai'

export const MODELS = {
  'groq-llama-70b':  { provider: 'groq',      id: 'llama-3.3-70b-versatile',       name: 'Llama 3.3 70B',     badge: '⚡ Fast',    free: true  },
  'groq-llama-8b':   { provider: 'groq',      id: 'llama-3.1-8b-instant',          name: 'Llama 3.1 8B',      badge: '⚡ Fastest', free: true  },
  'groq-gemma2':     { provider: 'groq',      id: 'gemma2-9b-it',                  name: 'Gemma 2 9B',        badge: '⚡ Groq',    free: true  },
  'groq-deepseek':   { provider: 'groq',      id: 'deepseek-r1-distill-llama-70b', name: 'DeepSeek R1 70B',   badge: '⚡ Groq',    free: true  },
  'claude-sonnet':   { provider: 'anthropic', id: 'claude-3-5-sonnet-20241022',    name: 'Claude 3.5 Sonnet', badge: '🔶 Smart',   free: false },
  'claude-haiku':    { provider: 'anthropic', id: 'claude-3-haiku-20240307',       name: 'Claude 3 Haiku',    badge: '🔶 Fast',    free: false },
  'gpt-4o':          { provider: 'openai',    id: 'gpt-4o',                        name: 'GPT-4o',            badge: '🔷 OpenAI',  free: false },
  'gpt-4o-mini':     { provider: 'openai',    id: 'gpt-4o-mini',                   name: 'GPT-4o Mini',       badge: '🔷 Fast',    free: false },
  'gemini-pro':      { provider: 'gemini',    id: 'gemini-2.0-flash',              name: 'Gemini 2.0 Flash',  badge: '🔮 Google',  free: false },
  'gemini-flash':    { provider: 'gemini',    id: 'gemini-2.0-flash-lite',         name: 'Gemini 2.0 Lite',   badge: '🔮 Fast',    free: false },
} as const

export type ModelKey = keyof typeof MODELS

function getKey(provider: string, userKeys: Record<string,string> = {}) {
  if (userKeys[provider]) return userKeys[provider]
  const map: Record<string, string|undefined> = {
    groq: process.env.GROQ_API_KEY,
    anthropic: process.env.ANTHROPIC_API_KEY,
    openai: process.env.OPENAI_API_KEY,
    gemini: process.env.GOOGLE_API_KEY,
  }
  const key = map[provider]
  if (!key || key === 'not-configured') throw new Error(`No API key for ${provider}. Add your key in Settings.`)
  return key
}

export async function streamChat(
  messages: any[],
  model: string,
  systemPrompt: string,
  userKeys: Record<string,string> = {}
): Promise<ReadableStream> {
  const m = MODELS[model as ModelKey]
  if (!m) throw new Error(`Unknown model: ${model}`)
  const key = getKey(m.provider, userKeys)
  const enc = new TextEncoder()
  const userMsgs = messages.filter(msg => msg.role !== 'system')

  if (m.provider === 'groq') {
    const groq = new Groq({ apiKey: key })
    const stream = await groq.chat.completions.create({
      model: m.id, stream: true, max_tokens: 4096,
      messages: [{ role: 'system', content: systemPrompt }, ...userMsgs],
    })
    return new ReadableStream({ async start(ctrl) {
      for await (const chunk of stream) {
        const t = chunk.choices[0]?.delta?.content || ''
        if (t) ctrl.enqueue(enc.encode(`data: ${JSON.stringify({t})}\n\n`))
      }
      ctrl.enqueue(enc.encode('data: [DONE]\n\n'))
      ctrl.close()
    }})
  }

  if (m.provider === 'anthropic') {
    const ant = new Anthropic({ apiKey: key })
    const stream = ant.messages.stream({
      model: m.id, max_tokens: 4096, system: systemPrompt,
      messages: userMsgs.map(x => ({ role: x.role, content: x.content })),
    })
    return new ReadableStream({ async start(ctrl) {
      for await (const e of stream) {
        if (e.type === 'content_block_delta' && e.delta.type === 'text_delta')
          ctrl.enqueue(enc.encode(`data: ${JSON.stringify({t: e.delta.text})}\n\n`))
      }
      ctrl.enqueue(enc.encode('data: [DONE]\n\n'))
      ctrl.close()
    }})
  }

  if (m.provider === 'openai') {
    const oai = new OpenAI({ apiKey: key })
    const stream = await oai.chat.completions.create({
      model: m.id, stream: true, max_tokens: 4096,
      messages: [{ role: 'system', content: systemPrompt }, ...userMsgs],
    })
    return new ReadableStream({ async start(ctrl) {
      for await (const chunk of stream) {
        const t = chunk.choices[0]?.delta?.content || ''
        if (t) ctrl.enqueue(enc.encode(`data: ${JSON.stringify({t})}\n\n`))
      }
      ctrl.enqueue(enc.encode('data: [DONE]\n\n'))
      ctrl.close()
    }})
  }

  if (m.provider === 'gemini') {
    const genAI = new GoogleGenerativeAI(key)
    const gm = genAI.getGenerativeModel({ model: m.id })
    const history = userMsgs.slice(0, -1).map(x => ({
      role: x.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: x.content }]
    }))
    const chat = gm.startChat({ history })
    const result = await chat.sendMessageStream(userMsgs.at(-1)?.content || '')
    return new ReadableStream({ async start(ctrl) {
      for await (const chunk of result.stream) {
        const t = chunk.text()
        if (t) ctrl.enqueue(enc.encode(`data: ${JSON.stringify({t})}\n\n`))
      }
      ctrl.enqueue(enc.encode('data: [DONE]\n\n'))
      ctrl.close()
    }})
  }

  throw new Error('Unknown provider')
}