import { useEffect, useState, useCallback } from 'react'
import { T } from '../theme'
import { Btn } from '../components/Btn'
import { Spinner } from '../components/Spinner'
import { Tag } from '../components/Tag'
import { useAppStore } from '../store'
import {
  apiGetModifications,
  apiDeleteModification,
  apiUndoModification,
  apiGetModSource,
  ModRecord,
} from '../api'

const ACTIVE_STATUSES = new Set([
  'pending', 'classifying', 'generating_frontend',
  'generating_backend', 'validating', 'applying',
])

const STATUS_COLOR: Record<string, string> = {
  pending:              T.mu,
  classifying:          T.bl,
  generating_frontend:  T.ac,
  generating_backend:   T.ac,
  validating:           T.amb,
  applying:             T.amb,
  done:                 T.gr,
  failed:               T.rd,
  undone:               T.mu2,
}

const STATUS_LABEL: Record<string, string> = {
  pending:              'Pending',
  classifying:          'Classifying…',
  generating_frontend:  'Generating UI…',
  generating_backend:   'Generating Backend…',
  validating:           'Validating…',
  applying:             'Applying…',
  done:                 'Done',
  failed:               'Failed',
  undone:               'Undone',
}

const CHANGE_TYPE_META: Record<string, { label: string; color: string; icon: string; tip: string }> = {
  live:             { label: 'Live',             color: T.gr,  icon: '⚡', tip: 'Takes effect immediately via Vite HMR — no restart needed' },
  restart_required: { label: 'Restart Required', color: T.amb, icon: '↺', tip: 'Backend blueprint added — restart the sidecar to activate' },
  build_required:   { label: 'Build Required',   color: T.rd,  icon: '⚙', tip: 'Native/build-time change — a full rebuild is needed' },
}

/** Inline code block with horizontal scroll. */
function CodeBlock({ code, lang = 'tsx' }: { code: string; lang?: string }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(code).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  return (
    <div style={{ position: 'relative', marginTop: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 10px', background: T.s3, borderRadius: '6px 6px 0 0', borderBottom: `1px solid ${T.b}` }}>
        <span style={{ fontSize: 10, color: T.mu, fontFamily: "'JetBrains Mono',monospace" }}>{lang}</span>
        <button
          onClick={copy}
          style={{ background: 'none', border: 'none', color: copied ? T.gr : T.mu, cursor: 'pointer', fontSize: 11, padding: '2px 6px' }}
        >
          {copied ? '✓ copied' : 'copy'}
        </button>
      </div>
      <pre style={{
        margin: 0,
        padding: '12px 14px',
        background: T.s3,
        borderRadius: '0 0 6px 6px',
        fontSize: 11,
        fontFamily: "'JetBrains Mono',monospace",
        color: T.tl ?? T.tx,
        overflowX: 'auto',
        whiteSpace: 'pre',
        lineHeight: 1.6,
        maxHeight: 320,
        overflowY: 'auto',
      }}>
        {code}
      </pre>
    </div>
  )
}

function ModCard({
  mod,
  onDelete,
  onUndo,
  onOpen,
}: {
  mod: ModRecord
  onDelete: (id: string) => void
  onUndo: () => void
  onOpen: (id: string) => void
}) {
  const [expanded, setExpanded]   = useState(false)
  const [showSrc, setShowSrc]     = useState(false)
  const [source, setSource]       = useState<{ frontend: string | null; backend: string | null } | null>(null)
  const [srcLoading, setSrcLoading] = useState(false)

  const color = STATUS_COLOR[mod.status] ?? T.mu
  const isActive = ACTIVE_STATUSES.has(mod.status)

  const loadSource = async () => {
    if (source) { setShowSrc(v => !v); return }
    setSrcLoading(true)
    try {
      const s = await apiGetModSource(mod.id)
      setSource(s)
      setShowSrc(true)
    } catch {
      setSource({ frontend: '// Could not load source', backend: null })
      setShowSrc(true)
    } finally {
      setSrcLoading(false)
    }
  }

  return (
    <div style={{
      background: T.s2,
      border: `1px solid ${
        mod.status === 'failed'  ? T.rd + '55'
        : mod.status === 'done' ? T.gr + '33'
        : isActive              ? T.ac + '33'
        : T.b
      }`,
      borderRadius: 10,
      marginBottom: 8,
      overflow: 'hidden',
      transition: 'border-color .3s',
    }}>
      {/* Header row */}
      <div
        style={{ padding: '12px 14px', display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }}
        onClick={() => setExpanded(e => !e)}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
            <Tag color={color} style={{ fontSize: 9 }}>{STATUS_LABEL[mod.status] ?? mod.status}</Tag>
            {isActive && <Spinner size={12} />}
            {mod.change_type && CHANGE_TYPE_META[mod.change_type] && (() => {
              const ct = CHANGE_TYPE_META[mod.change_type!]!
              return (
                <span
                  title={ct.tip}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 3,
                    fontSize: 9, fontWeight: 600, letterSpacing: '0.3px',
                    padding: '2px 6px', borderRadius: 4,
                    background: ct.color + '18', color: ct.color,
                    border: `1px solid ${ct.color}40`,
                    cursor: 'default',
                  }}
                >
                  {ct.icon} {ct.label}
                </span>
              )
            })()}
            <span style={{ fontSize: 10, color: T.mu2, fontFamily: "'JetBrains Mono',monospace" }}>{mod.id}</span>
          </div>
          <div style={{ fontSize: 13, color: T.tx, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: expanded ? 'normal' : 'nowrap' }}>
            {mod.prompt}
          </div>
          <div style={{ fontSize: 10, color: T.mu2, marginTop: 4 }}>
            {new Date(mod.created_at).toLocaleString()}
          </div>
        </div>
        <span style={{ color: T.mu, fontSize: 11, flexShrink: 0, marginTop: 2, transition: 'transform .2s', display: 'inline-block', transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>▾</span>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div style={{ padding: '0 14px 14px', borderTop: `1px solid ${T.b}` }}>
          <div style={{ paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {mod.frontend_file && (
              <div style={{ fontSize: 11, color: T.mu }}>
                <span style={{ color: T.ac, fontWeight: 600 }}>Frontend: </span>
                <code style={{ fontFamily: "'JetBrains Mono',monospace", color: T.tl ?? T.ac }}>{mod.frontend_file}</code>
              </div>
            )}
            {mod.backend_file && (
              <div style={{ fontSize: 11, color: T.mu }}>
                <span style={{ color: T.ac, fontWeight: 600 }}>Backend: </span>
                <code style={{ fontFamily: "'JetBrains Mono',monospace", color: T.tl ?? T.ac }}>{mod.backend_file}</code>
              </div>
            )}
            {mod.error && (
              <div style={{ fontSize: 11, color: T.rd, padding: '8px 12px', background: T.rd + '12', borderRadius: 6, whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                {mod.error}
              </div>
            )}

            {/* Actions */}
            <div style={{ display: 'flex', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
              {mod.status === 'done' && (
                <button
                  onClick={() => onOpen(mod.id)}
                  style={{ padding: '4px 12px', background: T.ac + '20', border: `1px solid ${T.ac}55`, borderRadius: 6, color: T.ac, cursor: 'pointer', fontSize: 11, fontWeight: 600 }}
                >
                  ↗ Open Tab
                </button>
              )}
              {mod.status === 'done' && mod.frontend_file && (
                <button
                  onClick={loadSource}
                  style={{ padding: '4px 12px', background: T.bl + '20', border: `1px solid ${T.bl}55`, borderRadius: 6, color: T.bl, cursor: 'pointer', fontSize: 11 }}
                >
                  {srcLoading ? '…' : showSrc ? 'Hide Source' : 'View Source'}
                </button>
              )}
              {mod.status === 'done' && (
                <button
                  onClick={onUndo}
                  style={{ padding: '4px 12px', background: T.amb + '20', border: `1px solid ${T.amb}55`, borderRadius: 6, color: T.amb, cursor: 'pointer', fontSize: 11 }}
                >
                  Undo
                </button>
              )}
              <button
                onClick={() => onDelete(mod.id)}
                style={{ padding: '4px 12px', background: T.rd + '15', border: `1px solid ${T.rd}44`, borderRadius: 6, color: T.rd, cursor: 'pointer', fontSize: 11 }}
              >
                Delete
              </button>
            </div>

            {/* Source viewer */}
            {showSrc && source && (
              <div style={{ marginTop: 4 }}>
                {source.frontend && (
                  <CodeBlock code={source.frontend} lang="tsx" />
                )}
                {source.backend && (
                  <>
                    <div style={{ height: 8 }} />
                    <CodeBlock code={source.backend} lang="python" />
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export function Modifications() {
  const { addDynTab, setActiveTab } = useAppStore()
  const [mods, setMods] = useState<ModRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    setError(null)
    apiGetModifications()
      .then(({ modifications }) => setMods(modifications))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  // Initial load
  useEffect(() => { load() }, [load])

  // Auto-poll every 2 s while any mod is in-progress
  useEffect(() => {
    const hasActive = mods.some(m => ACTIVE_STATUSES.has(m.status))
    if (!hasActive) return
    const id = setInterval(load, 2000)
    return () => clearInterval(id)
  }, [mods, load])

  const handleDelete = async (id: string) => {
    await apiDeleteModification(id).catch(() => {})
    setMods(ms => ms.filter(m => m.id !== id))
  }

  const handleUndo = async () => {
    try {
      await apiUndoModification()
      load()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  /** Open the generated component in a dynamic tab. */
  const handleOpen = (modId: string) => {
    const mod = mods.find(m => m.id === modId)
    if (!mod) return
    const short = mod.prompt.slice(0, 22) + (mod.prompt.length > 22 ? '…' : '')
    addDynTab({ id: modId, label: `🔧 ${short}`, closeable: true, comp: modId })
    setActiveTab(modId)
  }

  const hasDone   = mods.some(m => m.status === 'done')
  const hasActive = mods.some(m => ACTIVE_STATUSES.has(m.status))

  return (
    <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ padding: '20px 24px', borderBottom: `1px solid ${T.b}`, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 16 }}>
        <div>
          <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 20, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 10 }}>
            ✦ App Modifications
            {hasActive && <Spinner size={14} />}
          </div>
          <div style={{ fontSize: 13, color: T.mu }}>
            AI-generated live changes to this app. Ask in Chat to build something new.
          </div>
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', gap: 8 }}>
          {hasDone && (
            <Btn onClick={handleUndo} variant="warn" style={{ fontSize: 12, padding: '6px 14px' }}>
              ↩ Undo Last
            </Btn>
          )}
          <Btn onClick={load} variant="ghost" style={{ fontSize: 12, padding: '6px 14px' }}>
            Refresh
          </Btn>
        </div>
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
        {loading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: T.mu }}>
            <Spinner /> Loading…
          </div>
        )}

        {error && (
          <div style={{ padding: '10px 14px', background: T.rd + '12', border: `1px solid ${T.rd}33`, borderRadius: 8, fontSize: 12, color: T.rd, marginBottom: 16 }}>
            {error} — is the sidecar running?
          </div>
        )}

        {!loading && !error && mods.length === 0 && (
          <div style={{ textAlign: 'center', padding: '48px 0', color: T.mu }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>✦</div>
            <div style={{ fontWeight: 600, fontSize: 15, color: T.tx, marginBottom: 8 }}>No modifications yet</div>
            <div style={{ fontSize: 13, maxWidth: 400, margin: '0 auto', lineHeight: 1.7 }}>
              Go to <strong style={{ color: T.ac }}>Chat</strong> and use the{' '}
              <span style={{ background: T.s3, padding: '1px 6px', borderRadius: 4, fontFamily: "'JetBrains Mono',monospace", fontSize: 12 }}>🔨 Build</span>{' '}
              button to ask the AI to{' '}
              <em>"add a note-taking panel"</em> or{' '}
              <em>"create a word counter tool"</em>.
            </div>
          </div>
        )}

        {mods.map(mod => (
          <ModCard
            key={mod.id}
            mod={mod}
            onDelete={handleDelete}
            onUndo={handleUndo}
            onOpen={handleOpen}
          />
        ))}

        {/* Status legend */}
        {mods.length > 0 && (
          <div style={{ marginTop: 16, padding: '12px 16px', background: T.s2, border: `1px solid ${T.b}`, borderRadius: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: T.mu, textTransform: 'uppercase', marginBottom: 8, letterSpacing: '0.5px' }}>Status Guide</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
              {Object.entries(STATUS_LABEL).map(([k, v]) => (
                <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: STATUS_COLOR[k] ?? T.mu, flexShrink: 0 }} />
                  <span style={{ fontSize: 11, color: T.mu }}>{v}</span>
                </div>
              ))}
            </div>
            <div style={{ fontSize: 11, fontWeight: 600, color: T.mu, textTransform: 'uppercase', marginBottom: 8, letterSpacing: '0.5px' }}>Change Types</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {Object.entries(CHANGE_TYPE_META).map(([k, ct]) => (
                <div key={k} title={ct.tip} style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'default' }}>
                  <span style={{ fontSize: 11, color: ct.color, fontWeight: 600 }}>{ct.icon}</span>
                  <span style={{ fontSize: 11, color: T.mu }}>{ct.label}</span>
                  <span style={{ fontSize: 10, color: T.mu2 }}>— {ct.tip}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
