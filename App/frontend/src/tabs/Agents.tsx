import { useState, useEffect, useRef } from 'react'
import { T, inputSx } from '../theme'
import { Btn } from '../components/Btn'
import { Tag, Dot } from '../components/Tag'
import { Spinner } from '../components/Spinner'
import { Field } from '../components/Field'
import {
  apiChat, apiRequestModification, apiGetModification, ModRecord,
  apiDevHealth, apiDevStartPolish, apiDevStopPolish, apiDevPolishStatus,
  HealthResult, PolishState,
} from '../api'

// ── Research Agent Panel ──────────────────────────────────────────────────────

function ResearchAgentPanel() {
  const [topic, setTopic] = useState('')
  const [sources, setSources] = useState({ arxiv: true, hn: true, web: false })
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState('')
  const [error, setError] = useState('')

  const run = async () => {
    if (!topic.trim() || running) return
    setRunning(true); setResult(''); setError('')
    const srcList = [sources.arxiv && 'arXiv', sources.hn && 'Hacker News', sources.web && 'web search'].filter(Boolean).join(', ')
    try {
      const resp = await apiChat({
        messages: [{
          role: 'user',
          content: `You are a research analyst. Research this topic: "${topic}".\nSources available: ${srcList}\n\n## Summary\n2-3 sentences on this topic.\n\n## Key Findings\n- 5-7 bullet points of most important recent developments\n\n## Notable Resources\n- 3-5 papers or resources with brief descriptions\n\n## Implications\nWhy this matters and where it\'s heading (1 paragraph)\n\nUse markdown. Be accurate and concise.`,
        }],
      })
      setResult(resp.content)
    } catch (e) { setError(e instanceof Error ? e.message : String(e)) }
    setRunning(false)
  }

  return (
    <div style={{ padding: 20, overflowY: 'auto', flex: 1 }}>
      <Field label="Research Topic / Query">
        <input type="text" value={topic} onChange={e => setTopic(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') run() }} placeholder="e.g. LLM reasoning improvements 2024" style={inputSx} />
      </Field>
      <Field label="Sources">
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {([['arxiv', '📚 arXiv'], ['hn', '🟠 Hacker News'], ['web', '🌐 Web (coming soon)']] as [keyof typeof sources, string][]).map(([k, label]) => (
            <label key={k} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: k === 'web' ? 'not-allowed' : 'pointer', opacity: k === 'web' ? 0.4 : 1 }}>
              <input type="checkbox" checked={sources[k]} disabled={k === 'web'} onChange={e => setSources(s => ({ ...s, [k]: e.target.checked }))} style={{ accentColor: T.ac }} />
              <span style={{ fontSize: 12 }}>{label}</span>
            </label>
          ))}
        </div>
      </Field>
      <Btn onClick={run} disabled={!topic.trim() || running} variant="ok" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {running ? <><Spinner size={13} /><span>Researching…</span></> : '▶ Run Research'}
      </Btn>
      {error && <div style={{ marginTop: 14, padding: '10px 14px', background: T.rd + '15', border: `1px solid ${T.rd}44`, borderRadius: 8, fontSize: 12, color: T.rd }}>{error}</div>}
      {result && (
        <div style={{ marginTop: 16, padding: '14px 16px', background: T.s2, border: `1px solid ${T.b2}`, borderRadius: 10, fontSize: 13, lineHeight: 1.75, whiteSpace: 'pre-wrap' }}>
          {result}
        </div>
      )}
    </div>
  )
}

// ── Meeting Intelligence Panel ────────────────────────────────────────────────

function MeetingAgentPanel() {
  const [transcript, setTranscript] = useState('')
  const [context, setContext] = useState('')
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState('')
  const [error, setError] = useState('')

  const run = async () => {
    if (!transcript.trim() || running) return
    setRunning(true); setResult(''); setError('')
    try {
      const resp = await apiChat({
        messages: [{
          role: 'user',
          content: `You are a meeting intelligence assistant. Analyze this meeting content.\n${context ? `\nContext: ${context}\n` : ''}\nMeeting content:\n${transcript}\n\n## Summary\nBrief 2-3 sentence overview.\n\n## Key Decisions\n- Each decision with context\n\n## Action Items\n| # | Task | Owner | Deadline | Priority |\n|---|------|-------|----------|---------|\n\n## Open Questions\n- Unresolved topics\n\n## Next Steps\nOrdered list of immediate actions.\n\nBe precise and actionable.`,
        }],
      })
      setResult(resp.content)
    } catch (e) { setError(e instanceof Error ? e.message : String(e)) }
    setRunning(false)
  }

  return (
    <div style={{ padding: 20, overflowY: 'auto', flex: 1 }}>
      <div style={{ padding: '8px 12px', background: T.amb + '15', border: `1px solid ${T.amb}44`, borderRadius: 8, fontSize: 12, marginBottom: 16 }}>
        <span style={{ color: T.amb, fontWeight: 600 }}>⚠ Audio transcription</span>
        <span style={{ color: T.mu }}> requires Whisper (not yet wired). Paste transcript text below.</span>
      </div>
      <Field label="Meeting Transcript or Notes">
        <textarea rows={6} value={transcript} onChange={e => setTranscript(e.target.value)} placeholder="Paste meeting transcript, notes, or recording text here…" style={inputSx} />
      </Field>
      <Field label="Context (optional)">
        <input type="text" value={context} onChange={e => setContext(e.target.value)} placeholder="e.g. Q3 planning call with marketing team" style={inputSx} />
      </Field>
      <Btn onClick={run} disabled={!transcript.trim() || running} variant="ok" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {running ? <><Spinner size={13} /><span>Processing…</span></> : '▶ Extract Notes & Actions'}
      </Btn>
      {error && <div style={{ marginTop: 14, padding: '10px 14px', background: T.rd + '15', border: `1px solid ${T.rd}44`, borderRadius: 8, fontSize: 12, color: T.rd }}>{error}</div>}
      {result && (
        <div style={{ marginTop: 16, padding: '14px 16px', background: T.s2, border: `1px solid ${T.b2}`, borderRadius: 10, fontSize: 13, lineHeight: 1.75, whiteSpace: 'pre-wrap' }}>
          {result}
        </div>
      )}
    </div>
  )
}

// ── App Builder Agent Panel ───────────────────────────────────────────────────

function AppBuilderAgentPanel() {
  const [prompt, setPrompt] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [activeMod, setActiveMod] = useState<ModRecord | null>(null)
  const [error, setError] = useState('')
  const [history, setHistory] = useState<ModRecord[]>([])

  const run = async () => {
    if (!prompt.trim() || submitting) return
    setSubmitting(true); setError('')
    try {
      const { modification } = await apiRequestModification(prompt)
      setActiveMod(modification)
      setPrompt('')
      const poll = setInterval(async () => {
        try {
          const { modification: m } = await apiGetModification(modification.id)
          setActiveMod(m)
          if (m.status === 'done' || m.status === 'failed') {
            clearInterval(poll)
            setHistory(h => [m, ...h.slice(0, 4)])
          }
        } catch { /* sidecar polling */ }
      }, 1500)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
    setSubmitting(false)
  }

  const sc = (s: string) => s === 'done' ? T.gr : s === 'failed' ? T.rd : T.amb

  return (
    <div style={{ padding: 20, overflowY: 'auto', flex: 1 }}>
      <div style={{ fontSize: 12, color: T.mu, marginBottom: 16, lineHeight: 1.6 }}>
        Describe a UI component, tool, or feature. The App Builder generates code and adds it live to the app.
      </div>
      <Field label="What do you want to build?">
        <textarea rows={3} value={prompt} onChange={e => setPrompt(e.target.value)} placeholder="e.g. Build a calculator tool with basic operations" style={inputSx} />
      </Field>
      <Btn onClick={run} disabled={!prompt.trim() || submitting} variant="warn" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {submitting ? <><Spinner size={13} /><span>Submitting…</span></> : '🔨 Build It'}
      </Btn>
      {error && <div style={{ marginTop: 14, padding: '10px 14px', background: T.rd + '15', border: `1px solid ${T.rd}44`, borderRadius: 8, fontSize: 12, color: T.rd }}>{error}</div>}
      {activeMod && (
        <div style={{ marginTop: 16, padding: '12px 14px', background: sc(activeMod.status) + '12', border: `1px solid ${sc(activeMod.status)}44`, borderRadius: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            {activeMod.status === 'done' ? <span style={{ color: T.gr }}>✓</span> : activeMod.status === 'failed' ? <span style={{ color: T.rd }}>✗</span> : <Spinner size={13} />}
            <span style={{ fontWeight: 600, fontSize: 12, color: sc(activeMod.status) }}>
              {activeMod.status === 'done' ? 'Built!' : activeMod.status === 'failed' ? 'Build failed' : `Building… (${activeMod.status.replace(/_/g, ' ')})`}
            </span>
          </div>
          <div style={{ fontSize: 11, color: T.mu }}>{activeMod.prompt.slice(0, 70)}</div>
          {activeMod.status === 'failed' && activeMod.error && <div style={{ marginTop: 6, fontSize: 11, color: T.rd }}>{activeMod.error}</div>}
          {activeMod.status === 'done' && <div style={{ marginTop: 6, fontSize: 11, color: T.gr }}>Component added. Check the Modifications tab to open it.</div>}
        </div>
      )}
      {history.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: T.mu, textTransform: 'uppercase', marginBottom: 8 }}>Recent Builds</div>
          {history.map(h => (
            <div key={h.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: T.s2, borderRadius: 7, marginBottom: 5, border: `1px solid ${T.b}` }}>
              <span style={{ color: sc(h.status), fontSize: 12 }}>{h.status === 'done' ? '✓' : h.status === 'failed' ? '✗' : '…'}</span>
              <span style={{ flex: 1, fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.prompt}</span>
              <Tag color={sc(h.status)} style={{ fontSize: 9 }}>{h.status}</Tag>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Dev Polish Agent Panel ────────────────────────────────────────────────────

const PHASE_LABEL: Record<string, string> = {
  starting:     'Starting…',
  health_check: 'Testing endpoints…',
  reviewing:    'Reviewing component code…',
  queuing:      'Queuing improvements…',
  cooling:      'Cooling down…',
  done:         'Cycle complete',
}

const SEV_COLOR: Record<string, string> = {
  high:   T.rd,
  medium: T.amb,
  low:    T.mu,
}

function HealthRow({ r }: { r: HealthResult }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '5px 10px', borderRadius: 7,
      background: r.ok ? T.gr + '0d' : T.rd + '0d',
      border: `1px solid ${r.ok ? T.gr + '33' : T.rd + '33'}`,
      marginBottom: 4,
    }}>
      <span style={{ color: r.ok ? T.gr : T.rd, fontSize: 13, flexShrink: 0 }}>{r.ok ? '✓' : '✗'}</span>
      <span style={{ fontSize: 12, flex: 1 }}>{r.name}</span>
      <code style={{ fontSize: 10, color: T.mu2, fontFamily: "'JetBrains Mono',monospace" }}>
        {r.method} {r.path}
      </code>
      {r.status && <span style={{ fontSize: 10, color: r.ok ? T.gr : T.rd }}>{r.status}</span>}
      {r.error && <span style={{ fontSize: 10, color: T.rd, maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.error}</span>}
    </div>
  )
}

function DevPolishAgentPanel() {
  const [state, setState]           = useState<PolishState | null>(null)
  const [continuous, setContinuous] = useState(false)
  const [cooldown, setCooldown]     = useState(120)
  const [loading, setLoading]       = useState(false)
  const [showLog, setShowLog]       = useState(true)
  const [showReviews, setShowReviews] = useState(true)
  const logEndRef = useRef<HTMLDivElement>(null)
  const pollRef   = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchStatus = async () => {
    try {
      const s = await apiDevPolishStatus()
      setState(s)
    } catch { /* sidecar offline */ }
  }

  // Poll while running
  useEffect(() => {
    fetchStatus()
    pollRef.current = setInterval(fetchStatus, 1500)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [])

  // Auto-scroll log
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [state?.log?.length])

  const startCycle = async () => {
    setLoading(true)
    try {
      await apiDevStartPolish(continuous, cooldown)
      await fetchStatus()
    } catch (e) { console.error(e) }
    setLoading(false)
  }

  const stopCycle = async () => {
    await apiDevStopPolish().catch(() => {})
    await fetchStatus()
  }

  const runHealthCheck = async () => {
    setLoading(true)
    try {
      const { results } = await apiDevHealth()
      setState(s => s ? { ...s, health_results: results } : null)
    } catch { /* ignore */ }
    setLoading(false)
  }

  const isRunning = state?.running ?? false
  const phase     = state?.phase
  const phaseColor = isRunning ? T.ac : phase === 'done' ? T.gr : T.mu

  return (
    <div style={{ padding: 20, overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Status banner */}
      <div style={{
        padding: '12px 16px',
        background: phaseColor + '12',
        border: `1px solid ${phaseColor}33`,
        borderRadius: 10,
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        {isRunning && <Spinner size={14} />}
        {!isRunning && <span style={{ fontSize: 16 }}>{phase === 'done' ? '✓' : '⏸'}</span>}
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: phaseColor }}>
            {isRunning
              ? (state?.current_component
                  ? `Reviewing ${state.current_component}…`
                  : PHASE_LABEL[phase ?? ''] ?? 'Working…')
              : phase === 'done' ? 'Last cycle complete' : 'Idle — ready to run'}
          </div>
          {(state?.improvements_total ?? 0) > 0 && (
            <div style={{ fontSize: 11, color: T.mu, marginTop: 2 }}>
              {state!.improvements_total} improvement{state!.improvements_total !== 1 ? 's' : ''} queued in total
              {state!.cycle_count > 0 && ` • ${state!.cycle_count + 1} cycle${state!.cycle_count > 0 ? 's' : ''} run`}
            </div>
          )}
        </div>
        {isRunning && (
          <button
            onClick={stopCycle}
            style={{ padding: '4px 12px', background: T.rd + '20', border: `1px solid ${T.rd}44`, borderRadius: 6, color: T.rd, cursor: 'pointer', fontSize: 11, fontWeight: 600 }}
          >
            Stop
          </button>
        )}
      </div>

      {/* Controls */}
      {!isRunning && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              onClick={startCycle}
              disabled={loading}
              style={{
                padding: '9px 18px', background: T.ac, border: 'none',
                borderRadius: 8, color: T.tx, fontWeight: 700, fontSize: 13,
                cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.5 : 1,
                display: 'flex', alignItems: 'center', gap: 7,
              }}
            >
              {loading ? <Spinner size={13} /> : '▶'} Run Polish Cycle
            </button>
            <button
              onClick={runHealthCheck}
              disabled={loading}
              style={{ padding: '9px 16px', background: 'none', border: `1px solid ${T.b2}`, borderRadius: 8, color: T.tx, cursor: 'pointer', fontSize: 12 }}
            >
              🔍 Health Check Only
            </button>
          </div>

          {/* Continuous mode */}
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
            <div
              onClick={() => setContinuous(v => !v)}
              style={{ width: 36, height: 20, borderRadius: 10, background: continuous ? T.ac : T.s4, position: 'relative', transition: 'background .2s', cursor: 'pointer', flexShrink: 0 }}
            >
              <div style={{ position: 'absolute', top: 3, left: continuous ? 17 : 3, width: 14, height: 14, borderRadius: '50%', background: '#fff', transition: 'left .2s' }} />
            </div>
            <span style={{ fontSize: 12 }}>Continuous mode</span>
            {continuous && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: T.mu }}>
                — cooldown:
                <select
                  value={cooldown}
                  onChange={e => setCooldown(Number(e.target.value))}
                  style={{ ...inputSx, width: 'auto', padding: '2px 6px', fontSize: 11 }}
                >
                  {[60, 120, 300, 600].map(s => <option key={s} value={s}>{s}s</option>)}
                </select>
              </div>
            )}
          </label>
          <div style={{ fontSize: 11, color: T.mu2, lineHeight: 1.6, padding: '8px 12px', background: T.s2, borderRadius: 8, border: `1px solid ${T.b}` }}>
            <strong style={{ color: T.tx }}>What the agent does:</strong> Tests all API endpoints → reads every component file → asks the LLM to identify bugs and UX issues → automatically queues fixes via the self-modification system → if continuous, repeats every {cooldown}s.
          </div>
        </div>
      )}

      {/* Health results */}
      {(state?.health_results?.length ?? 0) > 0 && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: T.mu, textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 8 }}>
            API Health — {state!.health_results.filter(r => r.ok).length}/{state!.health_results.length} OK
          </div>
          {state!.health_results.map(r => <HealthRow key={r.path} r={r} />)}
        </div>
      )}

      {/* Review results */}
      {(state?.review_results?.length ?? 0) > 0 && (
        <div>
          <button
            onClick={() => setShowReviews(v => !v)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700, color: T.mu, textTransform: 'uppercase', letterSpacing: '.5px', padding: 0, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}
          >
            {showReviews ? '▾' : '▸'} Code Review Results ({state!.review_results.reduce((n, r) => n + r.issues.length, 0)} issues)
          </button>
          {showReviews && state!.review_results.map(rev => (
            <div key={rev.component} style={{ marginBottom: 10, background: T.s2, border: `1px solid ${T.b}`, borderRadius: 9, overflow: 'hidden' }}>
              <div style={{ padding: '7px 12px', borderBottom: `1px solid ${T.b}`, fontSize: 12, fontWeight: 600, display: 'flex', gap: 8 }}>
                {rev.component}
                <Tag color={T.rd} style={{ fontSize: 9 }}>{rev.issues.filter(i => i.severity === 'high').length} high</Tag>
                <Tag color={T.amb} style={{ fontSize: 9 }}>{rev.issues.filter(i => i.severity === 'medium').length} medium</Tag>
              </div>
              {rev.issues.map((iss, i) => (
                <div key={i} style={{ padding: '8px 12px', borderBottom: i < rev.issues.length - 1 ? `1px solid ${T.b}` : undefined }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: SEV_COLOR[iss.severity], textTransform: 'uppercase' }}>{iss.severity}</span>
                    <span style={{ fontSize: 12, color: T.tx }}>{iss.issue}</span>
                  </div>
                  <div style={{ fontSize: 11, color: T.mu, paddingLeft: 4 }}>→ {iss.fix}</div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Activity log */}
      {(state?.log?.length ?? 0) > 0 && (
        <div>
          <button
            onClick={() => setShowLog(v => !v)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700, color: T.mu, textTransform: 'uppercase', letterSpacing: '.5px', padding: 0, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}
          >
            {showLog ? '▾' : '▸'} Activity Log ({state!.log.length} entries)
          </button>
          {showLog && (
            <div style={{ background: T.s2, border: `1px solid ${T.b}`, borderRadius: 9, padding: '10px 14px', maxHeight: 260, overflowY: 'auto' }}>
              {state!.log.map((entry, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 4, fontSize: 11 }}>
                  <span style={{ color: T.mu2, fontFamily: "'JetBrains Mono',monospace", flexShrink: 0 }}>
                    {new Date(entry.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                  <span style={{ color: entry.msg.includes('✗') || entry.msg.includes('error') ? T.rd : entry.msg.includes('✓') || entry.msg.includes('complete') ? T.gr : T.tx }}>
                    {entry.msg}
                  </span>
                </div>
              ))}
              <div ref={logEndRef} />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Agent definitions ─────────────────────────────────────────────────────────

type AgentStatus = 'mvp' | 'coming-soon' | 'planned'

interface AgentDef {
  id: string; icon: string; name: string; desc: string
  capabilities: string[]; status: AgentStatus
  badge?: string; badgeColor?: string
}

const AGENTS: AgentDef[] = [
  {
    id: 'research', icon: '🔬', name: 'Research Agent', status: 'mvp',
    desc: 'Research any topic with AI — surfaces key findings, papers, and implications.',
    capabilities: ['Topic research', 'Key findings', 'Paper summaries', 'Trend analysis'],
  },
  {
    id: 'meeting', icon: '🎤', name: 'Meeting Intelligence Agent', status: 'mvp',
    desc: 'Paste a transcript or notes — get structured action items, decisions, and summaries.',
    capabilities: ['Transcript processing', 'Action items', 'Decision capture', 'Follow-up list'],
  },
  {
    id: 'appbuilder', icon: '🔧', name: 'App Builder Agent', status: 'mvp',
    desc: 'Describe a UI component or feature and the agent builds and deploys it live.',
    capabilities: ['Generate UI components', 'Generate API routes', 'Hot-reload', 'Version history'],
  },
  {
    id: 'inbox', icon: '📬', name: 'Inbox Zero Agent', status: 'coming-soon',
    desc: 'Reads your Gmail, categorizes emails, drafts replies for approval.',
    capabilities: ['Email triage', 'Draft replies', 'Auto-label', 'Snooze'],
    badge: 'Coming soon', badgeColor: T.amb,
  },
  {
    id: 'coderev', icon: '🐙', name: 'Code Review Agent', status: 'coming-soon',
    desc: 'Monitors GitHub repos, reviews PRs, adds inline comments.',
    capabilities: ['PR monitoring', 'Inline comments', 'Security checks', 'Slack alerts'],
    badge: 'Coming soon', badgeColor: T.amb,
  },
  {
    id: 'data', icon: '📊', name: 'Data Monitor Agent', status: 'planned',
    desc: 'Watches dashboards and data sources for anomalies.',
    capabilities: ['Metric monitoring', 'Anomaly detection', 'Trend reports', 'Alerts'],
    badge: 'Planned', badgeColor: T.mu,
  },
  {
    id: 'devpolish', icon: '✦', name: 'Dev Polish Agent', status: 'mvp',
    desc: 'Tests every API endpoint, reviews all component code with the LLM, and autonomously queues bug fixes and UX improvements. Can run continuously.',
    capabilities: ['API health checks', 'LLM code review', 'Auto-queue fixes', 'Continuous mode'],
    badge: 'System', badgeColor: T.ac,
  },
]

// ── Main ──────────────────────────────────────────────────────────────────────

export function Agents() {
  const [openAgentId, setOpenAgentId] = useState<string | null>(null)
  const openAgent = AGENTS.find(a => a.id === openAgentId) ?? null

  const renderPanel = () => {
    switch (openAgentId) {
      case 'research':   return <ResearchAgentPanel />
      case 'meeting':    return <MeetingAgentPanel />
      case 'appbuilder': return <AppBuilderAgentPanel />
      case 'devpolish':  return <DevPolishAgentPanel />
      default:           return null
    }
  }

  return (
    <div style={{ flex: 1, overflow: 'hidden', display: 'flex' }}>
      {/* Agent list */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', borderRight: openAgent ? `1px solid ${T.b}` : undefined }}>
        <div style={{ padding: '20px 24px 14px', borderBottom: `1px solid ${T.b}`, flexShrink: 0 }}>
          <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 20, marginBottom: 4 }}>🤖 Agents</div>
          <div style={{ fontSize: 13, color: T.mu }}>Autonomous workers. Click an MVP-ready agent to open its config and run panel.</div>
        </div>
        <div style={{ padding: '8px 24px', borderBottom: `1px solid ${T.b}`, background: T.s1, display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          <Dot color={T.gr} pulse /><span style={{ fontSize: 12, color: T.mu }}>4 agents ready</span>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(290px,1fr))', gap: 12 }}>
            {AGENTS.map(agent => {
              const isMvp = agent.status === 'mvp'
              const isActive = openAgentId === agent.id
              return (
                <div
                  key={agent.id}
                  onClick={isMvp ? () => setOpenAgentId(isActive ? null : agent.id) : undefined}
                  style={{
                    background: isActive ? T.ac + '18' : T.s2,
                    border: `1px solid ${isActive ? T.ac + '55' : T.b}`,
                    borderRadius: 14, padding: 18,
                    opacity: agent.status === 'planned' ? 0.45 : agent.status === 'coming-soon' ? 0.7 : 1,
                    cursor: isMvp ? 'pointer' : 'default', transition: 'all .15s',
                  }}
                  onMouseEnter={e => { if (isMvp) { e.currentTarget.style.borderColor = T.b2; e.currentTarget.style.transform = 'translateY(-1px)' } }}
                  onMouseLeave={e => { if (isMvp) { e.currentTarget.style.borderColor = isActive ? T.ac + '55' : T.b; e.currentTarget.style.transform = 'none' } }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 10 }}>
                    <span style={{ fontSize: 26, lineHeight: 1, marginTop: 2 }}>{agent.icon}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                        <span style={{ fontWeight: 600, fontSize: 14 }}>{agent.name}</span>
                        {isMvp && <Tag color={T.gr} style={{ fontSize: 9 }}>MVP Ready</Tag>}
                        {agent.badge && !isMvp && <Tag color={agent.badgeColor ?? T.mu} style={{ fontSize: 9 }}>{agent.badge}</Tag>}
                      </div>
                      <div style={{ fontSize: 12, color: T.mu, lineHeight: 1.5 }}>{agent.desc}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: isMvp ? 10 : 0 }}>
                    {agent.capabilities.map(cap => (
                      <span key={cap} style={{ padding: '2px 7px', background: T.s3, border: `1px solid ${T.b}`, borderRadius: 4, fontSize: 10, color: T.mu }}>{cap}</span>
                    ))}
                  </div>
                  {isMvp && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Dot color={T.gr} pulse /><span style={{ fontSize: 11, color: T.gr }}>Ready</span></div>
                      <span style={{ fontSize: 11, color: T.ac }}>{isActive ? 'Close ×' : 'Open →'}</span>
                    </div>
                  )}
                  {!isMvp && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Dot color={agent.status === 'coming-soon' ? T.amb : T.mu2} />
                      <span style={{ fontSize: 11, color: agent.status === 'coming-soon' ? T.amb : T.mu2 }}>{agent.status === 'coming-soon' ? 'Coming soon' : 'Planned'}</span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Detail panel */}
      {openAgent && (
        <div style={{ width: 440, display: 'flex', flexDirection: 'column', overflow: 'hidden', flexShrink: 0 }}>
          <div style={{ padding: '12px 16px', borderBottom: `1px solid ${T.b}`, background: T.s1, display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            <span style={{ fontSize: 20 }}>{openAgent.icon}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{openAgent.name}</div>
              <div style={{ fontSize: 11, color: T.mu }}>{openAgent.desc}</div>
            </div>
            <button onClick={() => setOpenAgentId(null)} style={{ background: 'none', border: 'none', color: T.mu, cursor: 'pointer', fontSize: 18, padding: '0 4px' }}>×</button>
          </div>
          {renderPanel()}
        </div>
      )}
    </div>
  )
}
