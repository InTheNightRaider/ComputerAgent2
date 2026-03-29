import { useEffect, useState } from 'react'
import { T } from './theme'
import { Chat } from './tabs/Chat'
import { Pipelines } from './tabs/Pipelines'
import { Tools } from './tabs/Tools'
import { Automations } from './tabs/Automations'
import { Connections } from './tabs/Connections'
import { Agents } from './tabs/Agents'
import { Settings } from './tabs/Settings'
import { Modifications } from './tabs/Modifications'
import { Dot } from './components/Tag'
import { Spinner } from './components/Spinner'
import { useAppStore } from './store'
import { apiHealth } from './api'
import { usePipelineSync } from './hooks/usePipelineSync'

// Vite glob — picks up all generated mod-*.tsx files.
// In dev mode, adding a new file triggers HMR re-evaluation of this module.
const generatedModules = import.meta.glob('./generated/mod-*.tsx')

const STATIC_TABS = [
  { id: 'chat',          label: '💬 Chat' },
  { id: 'pipelines',     label: '🔄 Pipelines' },
  { id: 'tools',         label: '🔧 Tools' },
  { id: 'automations',   label: '⚡ Automations' },
  { id: 'connections',   label: '🔌 Connections' },
  { id: 'agents',        label: '🤖 Agents' },
  { id: 'modifications', label: '✦ Modifications' },
  { id: 'settings',      label: '⚙️ Settings' },
]

function Onboarding({ onDone }: { onDone: () => void }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(6,6,14,.96)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: T.s2, border: `1px solid ${T.b2}`, borderRadius: 20, padding: 40, maxWidth: 520, width: '90%', textAlign: 'center', animation: 'fadeUp .3s ease' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🌌</div>
        <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 26, marginBottom: 12 }}>
          <span style={{ color: T.ac }}>Universe</span> AI
        </div>
        <div style={{ fontSize: 15, color: T.tx, lineHeight: 1.8, marginBottom: 8 }}>Works completely offline and free.</div>
        <div style={{ fontSize: 13, color: T.mu, lineHeight: 1.7, marginBottom: 28 }}>
          Powered by Ollama local models. Optionally connect your Anthropic API key for enhanced chat —
          routed through the local backend, never exposed in the browser.
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 28 }}>
          {[
            { c: T.gr, i: '✓', t: 'No account required' },
            { c: T.gr, i: '✓', t: 'Runs 100% locally with Ollama' },
            { c: T.ac, i: '○', t: 'Optional: Anthropic Claude (via secure backend)' },
          ].map(x => (
            <div key={x.t} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', background: T.s3, borderRadius: 10, fontSize: 13 }}>
              <span style={{ color: x.c, fontWeight: 700 }}>{x.i}</span>{x.t}
            </div>
          ))}
        </div>
        <button onClick={onDone} style={{ width: '100%', padding: 13, fontSize: 15, borderRadius: 12, background: T.ac, border: 'none', color: T.tx, fontWeight: 600, cursor: 'pointer' }}>
          Get Started →
        </button>
        <div style={{ fontSize: 12, color: T.mu2, marginTop: 14 }}>Install Ollama at ollama.ai for local AI models</div>
      </div>
    </div>
  )
}

/** Lazy-loads a generated component by mod ID using the Vite glob map. */
function LazyGeneratedComp({ modId }: { modId: string }) {
  const [Comp, setComp] = useState<React.ComponentType | null>(null)
  const [status, setStatus] = useState<'loading' | 'loaded' | 'not_found' | 'error'>('loading')
  const [loadErr, setLoadErr] = useState('')

  useEffect(() => {
    const key = `./generated/${modId}.tsx`
    if (key in generatedModules) {
      generatedModules[key]()
        .then((mod: unknown) => {
          const m = mod as { default: React.ComponentType }
          setComp(() => m.default)
          setStatus('loaded')
        })
        .catch((e: unknown) => {
          setLoadErr(e instanceof Error ? e.message : String(e))
          setStatus('error')
        })
    } else {
      setStatus('not_found')
    }
  }, [modId])

  if (status === 'loaded' && Comp) return <Comp />

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, color: T.mu, padding: 32 }}>
      {status === 'loading' && <><Spinner /><span style={{ fontSize: 13 }}>Loading component…</span></>}
      {status === 'not_found' && (
        <>
          <div style={{ fontSize: 40 }}>⏳</div>
          <div style={{ fontSize: 14, color: T.tx, fontWeight: 600 }}>Still generating…</div>
          <div style={{ fontSize: 12, color: T.mu }}>Check the Modifications tab for progress.</div>
        </>
      )}
      {status === 'error' && (
        <>
          <div style={{ fontSize: 40 }}>⚠️</div>
          <div style={{ fontSize: 14, color: T.rd }}>Component load error</div>
          <div style={{ fontSize: 11, color: T.mu, fontFamily: "'JetBrains Mono',monospace" }}>{loadErr}</div>
        </>
      )}
    </div>
  )
}

export function App() {
  const {
    activeTab, setActiveTab,
    dynTabs, closeDynTab,
    onboarded, setOnboarded,
    ollamaOk, setOllamaOk, ollamaModels, setOllamaModels,
    settings,
  } = useAppStore()

  const [spendToday, setSpendToday] = useState(0)

  // Sync pipelines with backend (debounced save on change, load on mount)
  usePipelineSync()

  // Poll backend health every 15 s
  useEffect(() => {
    const check = async () => {
      try {
        const h = await apiHealth()
        setOllamaOk(h.ollama)
        setOllamaModels(h.models)
        setSpendToday(h.spend_today ?? 0)
      } catch {
        setOllamaOk(false)
      }
    }
    check()
    const id = setInterval(check, 15_000)
    return () => clearInterval(id)
  }, [])

  const renderTab = () => {
    switch (activeTab) {
      case 'chat':          return <Chat />
      case 'pipelines':     return <Pipelines />
      case 'tools':         return <Tools />
      case 'automations':   return <Automations />
      case 'connections':   return <Connections />
      case 'agents':        return <Agents />
      case 'modifications': return <Modifications />
      case 'settings':      return <Settings />
      default: {
        const dyn = dynTabs.find(t => t.id === activeTab)
        if (dyn) return <LazyGeneratedComp modId={dyn.id} />
        return <Chat />
      }
    }
  }

  const allTabs = [...STATIC_TABS, ...dynTabs]

  return (
    <div style={{ background: T.bg, height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {!onboarded && <Onboarding onDone={() => setOnboarded(true)} />}

      {/* ── Header ── */}
      <div style={{ background: T.s1, borderBottom: `1px solid ${T.b}`, padding: '0 20px', height: 50, display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
        <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 18, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 27, height: 27, borderRadius: 7, background: `linear-gradient(135deg,${T.ac},${T.pk})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>
            🌌
          </div>
          <span style={{ color: T.ac }}>Universe</span><span> AI</span>
        </div>

        <div style={{ flex: 1 }} />

        {/* Ollama status — green: up + models, amber: up but no models, red: unreachable */}
        {(() => {
          const hasModels = ollamaModels.length > 0
          const badgeColor = ollamaOk ? (hasModels ? T.gr : T.amb) : T.rd
          const label = ollamaOk ? (hasModels ? 'Ollama Ready' : 'Ollama: No Models') : 'No Local AI'
          return (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 9px', borderRadius: 6, fontSize: 11, background: badgeColor + '18', color: badgeColor }}>
              <Dot color={badgeColor} pulse={ollamaOk && hasModels} />
              {label}
            </div>
          )
        })()}

        {/* Claude badge */}
        {settings.anthropicEnabled && settings.anthropicKey && (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 9px', borderRadius: 6, fontSize: 11, background: T.ac + '18', color: T.ac }}>
            Claude
          </div>
        )}

        {/* Spend badge — only show when non-zero */}
        {spendToday > 0 && (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 9px', borderRadius: 6, fontSize: 11, background: T.amb + '18', color: T.amb }}>
            ${spendToday.toFixed(3)} today
          </div>
        )}
      </div>

      {/* ── Tab bar ── */}
      <div style={{ background: T.s1, borderBottom: `1px solid ${T.b}`, padding: '0 18px', display: 'flex', overflowX: 'auto', flexShrink: 0 }}>
        {allTabs.map(t => (
          <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
            <button
              onClick={() => setActiveTab(t.id)}
              style={{
                padding: '10px 14px', background: 'none', border: 'none',
                borderBottom: activeTab === t.id ? `2px solid ${T.ac}` : '2px solid transparent',
                color: activeTab === t.id ? T.tx : T.mu,
                cursor: 'pointer', fontSize: 13, fontWeight: activeTab === t.id ? 500 : 400,
                marginBottom: -1, whiteSpace: 'nowrap',
              }}
            >
              {t.label}
            </button>
            {'closeable' in t && (t as { closeable: boolean }).closeable && (
              <button onClick={e => { e.stopPropagation(); closeDynTab(t.id) }} style={{ background: 'none', border: 'none', color: T.mu2, cursor: 'pointer', fontSize: 13, padding: '0 3px', marginLeft: -6 }}>×</button>
            )}
          </div>
        ))}
      </div>

      {/* ── Content ── */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {renderTab()}
      </div>
    </div>
  )
}
