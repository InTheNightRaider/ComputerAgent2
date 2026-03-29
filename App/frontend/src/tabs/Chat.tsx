import { useState, useRef, useEffect } from 'react'
import { T } from '../theme'
import { Spinner } from '../components/Spinner'
import { useAppStore } from '../store'
import { apiChat, apiRequestModification, apiGetModification, getSidecarUrl, ModRecord } from '../api'

// ── Markdown renderer ──────────────────────────────────────────────────────────

function renderMD(text: string) {
  return text.split('\n').map((line, i) => {
    const inl = (l: string): React.ReactNode[] =>
      l.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((p, j) => {
        if (p.startsWith('**') && p.endsWith('**'))
          return <strong key={j}>{p.slice(2, -2)}</strong>
        if (p.startsWith('`') && p.endsWith('`'))
          return (
            <code key={j} style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, background: T.s3, padding: '1px 5px', borderRadius: 3, color: '#a9b4ff' }}>
              {p.slice(1, -1)}
            </code>
          )
        return <span key={j}>{p}</span>
      })
    if (line.startsWith('## '))
      return <div key={i} style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 15, marginTop: 8, marginBottom: 4 }}>{inl(line.slice(3))}</div>
    if (line.startsWith('# '))
      return <div key={i} style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 17, marginBottom: 6 }}>{inl(line.slice(2))}</div>
    if (line.match(/^[-•] /))
      return <div key={i} style={{ display: 'flex', gap: 7, marginBottom: 2 }}><span style={{ color: T.ac }}>›</span><span>{inl(line.slice(2))}</span></div>
    return <span key={i}>{i > 0 && <br />}{inl(line)}</span>
  })
}

// ── Live modification status card ──────────────────────────────────────────────

const PIPELINE_STAGES = [
  { status: 'classifying',         label: 'Classify'    },
  { status: 'generating_frontend', label: 'Generate UI' },
  { status: 'validating',          label: 'Validate'    },
  { status: 'applying',            label: 'Apply'       },
  { status: 'done',                label: 'Done'        },
]

const STAGE_ORDER = [
  'pending', 'classifying', 'generating_frontend', 'generating_backend',
  'validating', 'applying', 'done',
]

function stageIndex(status: string): number {
  return STAGE_ORDER.indexOf(status)
}

function LiveModCard({ modId, prompt }: { modId: string; prompt: string }) {
  const { addDynTab, setActiveTab } = useAppStore()
  const [mod, setMod] = useState<ModRecord | null>(null)
  const [tabOpened, setTabOpened] = useState(false)

  useEffect(() => {
    let pollId: ReturnType<typeof setInterval> | null = null

    const handleData = (data: Partial<ModRecord>) => {
      if (data.status) setMod(data as ModRecord)
    }

    const startPoll = () => {
      pollId = setInterval(async () => {
        try {
          const { modification } = await apiGetModification(modId)
          handleData(modification)
          if (modification.status === 'done' || modification.status === 'failed') {
            if (pollId) clearInterval(pollId)
            pollId = null
          }
        } catch { /* sidecar not yet ready */ }
      }, 1500)
    }

    // Try SSE first; fall back to polling on connection error
    const url = `${getSidecarUrl()}/api/app/modifications/${modId}/stream`
    let es: EventSource | null = null
    try {
      es = new EventSource(url)
      es.onmessage = (e) => {
        try {
          const data: ModRecord = JSON.parse(e.data)
          handleData(data)
          if (data.status === 'done' || data.status === 'failed') {
            es?.close()
            es = null
          }
        } catch { /* malformed JSON — ignore */ }
      }
      es.onerror = () => {
        es?.close()
        es = null
        startPoll()
      }
    } catch {
      startPoll()
    }

    return () => {
      es?.close()
      if (pollId) clearInterval(pollId)
    }
  }, [modId])

  const openTab = () => {
    const label = prompt.slice(0, 22) + (prompt.length > 22 ? '…' : '')
    addDynTab({ id: modId, label: `🔧 ${label}`, closeable: true, comp: modId })
    setActiveTab(modId)
    setTabOpened(true)
  }

  const status  = mod?.status ?? 'pending'
  const isDone  = status === 'done'
  const isFail  = status === 'failed'
  const curIdx  = stageIndex(status)
  const headerColor = isDone ? T.gr : isFail ? T.rd : T.amb

  return (
    <div style={{ marginTop: 8, padding: '12px 14px', background: headerColor + '10', border: `1px solid ${headerColor}33`, borderRadius: 10, fontSize: 12 }}>
      {/* Title row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 14 }}>{isDone ? '✓' : isFail ? '✕' : '🔨'}</span>
        <span style={{ color: headerColor, fontWeight: 700, fontSize: 12 }}>
          {isDone ? 'Built' : isFail ? 'Build failed' : 'Building…'}
        </span>
        <span style={{ color: T.mu, fontSize: 11, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {prompt.slice(0, 55)}{prompt.length > 55 ? '…' : ''}
        </span>
        {!isDone && !isFail && <Spinner size={11} />}
      </div>

      {/* Pipeline stage track */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 10 }}>
        {PIPELINE_STAGES.map((stage, i) => {
          const stIdx    = stageIndex(stage.status)
          const complete = curIdx > stIdx || isDone
          const active   = curIdx === stIdx && !isDone && !isFail
          const dotColor = isFail && active ? T.rd : complete ? T.gr : active ? T.ac : T.mu2
          return (
            <div key={stage.status} style={{ display: 'flex', alignItems: 'center', flex: i < PIPELINE_STAGES.length - 1 ? 1 : undefined }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                <div style={{
                  width: active ? 10 : 8,
                  height: active ? 10 : 8,
                  borderRadius: '50%',
                  background: dotColor,
                  boxShadow: active ? `0 0 6px ${T.ac}88` : 'none',
                  transition: 'all .3s',
                  flexShrink: 0,
                }} />
                <span style={{ fontSize: 9, color: complete || active ? T.mu : T.mu2, whiteSpace: 'nowrap' }}>
                  {stage.label}
                </span>
              </div>
              {i < PIPELINE_STAGES.length - 1 && (
                <div style={{ flex: 1, height: 1, background: complete ? T.gr + '60' : T.b, margin: '0 4px', marginBottom: 14 }} />
              )}
            </div>
          )
        })}
      </div>

      {/* Error message */}
      {isFail && mod?.error && (
        <div style={{ fontSize: 11, color: T.rd, padding: '6px 10px', background: T.rd + '12', borderRadius: 6, marginBottom: 8, whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
          {mod.error}
        </div>
      )}

      {/* Current status label */}
      {!isDone && !isFail && (
        <div style={{ fontSize: 11, color: T.mu, marginBottom: 8, fontFamily: "'JetBrains Mono',monospace" }}>
          {status.replace(/_/g, ' ')}…
        </div>
      )}

      {/* Change type notice when done */}
      {isDone && mod?.change_type && (() => {
        const ct = mod.change_type
        if (ct === 'live') return (
          <div style={{ fontSize: 11, color: T.gr, padding: '5px 10px', background: T.gr + '12', borderRadius: 6, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>⚡</span> Live — active immediately via hot-reload
          </div>
        )
        if (ct === 'restart_required') return (
          <div style={{ fontSize: 11, color: T.amb, padding: '5px 10px', background: T.amb + '12', borderRadius: 6, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>↺</span> Restart required — a backend route was added. Restart the sidecar to activate it.
          </div>
        )
        if (ct === 'build_required') return (
          <div style={{ fontSize: 11, color: T.rd, padding: '5px 10px', background: T.rd + '12', borderRadius: 6, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>⚙</span> Build required — a full rebuild is needed before this takes effect.
          </div>
        )
        return null
      })()}

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {isDone && (
          <button
            onClick={openTab}
            style={{
              padding: '5px 14px',
              background: tabOpened ? T.gr + '20' : T.ac + '20',
              border: `1px solid ${tabOpened ? T.gr : T.ac}55`,
              borderRadius: 6,
              color: tabOpened ? T.gr : T.ac,
              cursor: 'pointer',
              fontSize: 11,
              fontWeight: 600,
            }}
          >
            {tabOpened ? '✓ Opened' : '↗ Open Component'}
          </button>
        )}
        <button
          onClick={() => setActiveTab('modifications')}
          style={{ padding: '5px 12px', background: 'none', border: `1px solid ${T.b2}`, borderRadius: 6, color: T.mu, cursor: 'pointer', fontSize: 11 }}
        >
          Modifications tab →
        </button>
        {isDone && mod?.frontend_file && (
          <span style={{ fontSize: 10, color: T.mu2, fontFamily: "'JetBrains Mono',monospace", alignSelf: 'center' }}>
            {mod.frontend_file}
          </span>
        )}
      </div>
    </div>
  )
}

// ── Quick prompts ──────────────────────────────────────────────────────────────

const QUICK_PROMPTS = [
  "What models do I have?",
  "Build a summarizer tool",
  "Explain the Pipelines tab",
  "Check Ollama status",
]

// ── Chat component ─────────────────────────────────────────────────────────────

export function Chat() {
  const { messages, addMessage, ollamaOk, ollamaModels, settings } = useAppStore()
  const [input, setInput]     = useState('')
  const [thinking, setThinking] = useState(false)
  const [building, setBuilding] = useState(false)
  const [via, setVia]         = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, thinking])

  const send = async () => {
    if (!input.trim() || thinking) return
    const text = input.trim()
    setInput('')
    addMessage({ role: 'user', content: text })
    setThinking(true)

    const systemContent = `You are Universe AI assistant. Available tabs: Chat, Pipelines, Tools, Automations, Connections, Agents, Modifications, Settings. Ollama: ${ollamaOk ? 'connected (' + ollamaModels.slice(0, 3).join(', ') + ')' : 'not connected'}.`

    try {
      const resp = await apiChat({
        messages: [
          { role: 'system', content: systemContent },
          ...messages.slice(-8).map(m => ({ role: m.role, content: m.content })),
          { role: 'user', content: text },
        ],
        model: settings.ollamaModel,
        tone: settings.tone,
      })
      setVia(resp.via)
      addMessage({ role: 'assistant', content: resp.content, via: resp.via })
    } catch (e: unknown) {
      addMessage({ role: 'assistant', content: `Error: ${e instanceof Error ? e.message : String(e)}` })
    }
    setThinking(false)
  }

  /** Submit current input as a modification request — shows a live build card. */
  const build = async () => {
    if (!input.trim() || building) return
    const prompt = input.trim()
    setInput('')
    setBuilding(true)
    addMessage({ role: 'user', content: `🔨 Build: ${prompt}` })
    try {
      const { modification: mod } = await apiRequestModification(prompt)
      // Sentinel format: __MOD_CARD__<id>__<prompt>
      addMessage({ role: 'assistant', content: `__MOD_CARD__${mod.id}__${prompt}` })
    } catch (e: unknown) {
      addMessage({ role: 'assistant', content: `Build error: ${e instanceof Error ? e.message : String(e)}` })
    }
    setBuilding(false)
  }

  /** Render message — handles live mod card sentinel. */
  const renderContent = (content: string) => {
    if (content.startsWith('__MOD_CARD__')) {
      const rest   = content.slice('__MOD_CARD__'.length)
      const sepIdx = rest.indexOf('__')
      const modId  = sepIdx >= 0 ? rest.slice(0, sepIdx) : rest
      const prompt = sepIdx >= 0 ? rest.slice(sepIdx + 2) : ''
      return <LiveModCard modId={modId} prompt={prompt} />
    }
    return renderMD(content)
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* ── Messages ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {messages.map((m, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start', animation: 'fadeUp .2s ease' }}>
            <div style={{
              maxWidth: '78%',
              padding: '11px 15px',
              borderRadius: m.role === 'user' ? '14px 14px 3px 14px' : '14px 14px 14px 3px',
              background: m.role === 'user' ? T.ac2 : T.s2,
              border: `1px solid ${m.role === 'user' ? T.ac + '44' : T.b}`,
              fontSize: 13.5,
              lineHeight: 1.75,
            }}>
              {m.role === 'assistant' && (
                <div style={{ fontSize: 10, fontWeight: 700, color: T.ac, marginBottom: 6, letterSpacing: '1px', fontFamily: "'JetBrains Mono',monospace" }}>
                  UNIVERSE AI{m.via ? ` · ${m.via}` : ''}
                </div>
              )}
              <div>{renderContent(m.content)}</div>
            </div>
          </div>
        ))}

        {/* Thinking / Building indicator */}
        {(thinking || building) && (
          <div style={{ display: 'flex' }}>
            <div style={{ padding: '11px 15px', borderRadius: '14px 14px 14px 3px', background: T.s2, border: `1px solid ${T.b}` }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: building ? T.amb : T.ac, marginBottom: 6, letterSpacing: '1px', fontFamily: "'JetBrains Mono',monospace" }}>
                {building ? 'SUBMITTING BUILD…' : 'UNIVERSE AI'}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Spinner />
                <span style={{ fontSize: 12, color: T.mu }}>
                  {building ? 'Starting generation pipeline…' : 'Thinking…'}
                </span>
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* ── Quick prompts ── */}
      <div style={{ padding: '8px 14px 0', display: 'flex', gap: 6, overflowX: 'auto', flexShrink: 0 }}>
        {QUICK_PROMPTS.map(q => (
          <button key={q} onClick={() => setInput(q)} style={{ padding: '4px 11px', background: T.s3, border: `1px solid ${T.b}`, borderRadius: 20, color: T.mu, cursor: 'pointer', fontSize: 12, whiteSpace: 'nowrap', flexShrink: 0 }}>
            {q}
          </button>
        ))}
      </div>

      {via && (
        <div style={{ padding: '4px 14px', fontSize: 10, color: T.mu2, fontFamily: "'JetBrains Mono',monospace" }}>via {via}</div>
      )}

      {/* ── Input row ── */}
      <div style={{ padding: '10px 14px 14px', display: 'flex', gap: 8, flexShrink: 0 }}>
        <textarea
          rows={2}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
          placeholder="Chat with AI, or use 🔨 to build a new component…"
          style={{ flex: 1, background: T.s2, border: `1px solid ${T.b2}`, borderRadius: 10, padding: '10px 13px', color: T.tx, lineHeight: 1.6 }}
        />

        {/* 🔨 Build button */}
        <div style={{ display: 'flex', flexDirection: 'column', alignSelf: 'flex-end', gap: 3 }}>
          <button
            onClick={build}
            disabled={building || thinking}
            title="Generate a new UI component from this prompt"
            style={{
              padding: '9px 13px',
              background: T.amb + '20',
              border: `1px solid ${T.amb}55`,
              borderRadius: 10,
              color: T.amb,
              fontWeight: 700,
              cursor: (building || thinking) ? 'not-allowed' : 'pointer',
              fontSize: 14,
              opacity: (building || thinking) ? 0.5 : 1,
            }}
          >
            {building ? '…' : '🔨'}
          </button>
          <span style={{ fontSize: 9, color: T.mu2, textAlign: 'center' }}>build</span>
        </div>

        {/* Send button */}
        <button
          onClick={send}
          disabled={thinking}
          style={{
            padding: '10px 18px',
            background: T.ac,
            border: 'none',
            borderRadius: 10,
            color: T.tx,
            fontWeight: 600,
            cursor: thinking ? 'not-allowed' : 'pointer',
            alignSelf: 'flex-end',
            fontSize: 13,
            opacity: thinking ? 0.5 : 1,
          }}
        >
          {thinking ? '…' : 'Send'}
        </button>
      </div>
    </div>
  )
}
