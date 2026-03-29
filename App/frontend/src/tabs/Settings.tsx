import { useState, useEffect } from 'react'
import { T, inputSx } from '../theme'
import { Btn } from '../components/Btn'
import { Field } from '../components/Field'
import { Dot } from '../components/Tag'
import { Spinner } from '../components/Spinner'
import { useAppStore } from '../store'
import { apiOllamaModels, apiOllamaPull, apiSaveSettings, apiGetSettings, apiTestAnthropic } from '../api'

const APP_VERSION = '0.1.0'

// Tauri invoke — only available when running inside Tauri
async function tauriInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const w = window as Window & { __TAURI__?: { core?: { invoke?: (cmd: string, args?: unknown) => Promise<T> } } }
  const invoke = w.__TAURI__?.core?.invoke
  if (!invoke) throw new Error('Not running in Tauri')
  return invoke(cmd, args)
}

const isTauri = typeof window !== 'undefined' && '__TAURI__' in window

const WANT_MODELS = [
  { id: 'mistral:7b-instruct', size: '4GB',   desc: 'Primary chat' },
  { id: 'codellama:13b',       size: '8GB',   desc: 'Code' },
  { id: 'nomic-embed-text',    size: '274MB', desc: 'Embeddings' },
]

export function Settings() {
  const { settings, setSettings, ollamaOk, ollamaModels, setOllamaModels } = useAppStore()
  const [loc, setLoc] = useState({ ...settings })
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<'success' | 'fail' | null>(null)
  const [pulling, setPulling] = useState<string | null>(null)
  const [pullPct, setPullPct] = useState(0)
  const [saved, setSaved] = useState(false)
  const [spendToday, setSpendToday] = useState(0)

  // Update checker state
  const [updateStatus, setUpdateStatus] = useState<'idle' | 'checking' | 'available' | 'up-to-date' | 'installing' | 'installed' | 'error'>('idle')
  const [updateVersion, setUpdateVersion] = useState<string | null>(null)
  const [updateNotes, setUpdateNotes]     = useState<string | null>(null)
  const [updateError, setUpdateError]     = useState<string | null>(null)

  // Sync from backend on mount — picks up anthropic_key_set etc.
  useEffect(() => {
    apiGetSettings()
      .then(s => {
        setSpendToday(s.spend_today ?? 0)
        // Only update fields that don't carry secrets
        setLoc(prev => ({
          ...prev,
          ollamaUrl:   s.ollama_url   ?? prev.ollamaUrl,
          ollamaModel: s.ollama_model ?? prev.ollamaModel,
          budget:      s.budget       ?? prev.budget,
          tone:        s.tone         ?? prev.tone,
          // anthropic_enabled from backend is source of truth
          anthropicEnabled: (s.anthropic_enabled as boolean) ?? prev.anthropicEnabled,
        }))
      })
      .catch(() => {/* sidecar not running — use local state */})
  }, [])

  const hasModel = (id: string) =>
    ollamaModels.some(m => m === id || m.startsWith(id.split(':')[0]))

  const save = async () => {
    setSettings(loc)
    try {
      await apiSaveSettings({
        ollamaUrl:        loc.ollamaUrl,
        ollamaModel:      loc.ollamaModel,
        anthropicEnabled: loc.anthropicEnabled,
        anthropicKey:     loc.anthropicKey,
        budget:           loc.budget,
        tone:             loc.tone,
      })
    } catch { /* best-effort */ }
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  // Test is routed entirely through the backend — key never touches the browser network directly
  const testAnthropic = async () => {
    setTesting(true)
    setTestResult(null)
    try {
      const res = await apiTestAnthropic(loc.anthropicKey)
      setTestResult(res.ok ? 'success' : 'fail')
    } catch {
      setTestResult('fail')
    }
    setTesting(false)
  }

  const checkForUpdate = async () => {
    setUpdateStatus('checking')
    setUpdateError(null)
    try {
      const res = await tauriInvoke<{ available: boolean; version?: string; notes?: string }>('check_for_update')
      if (res.available) {
        setUpdateVersion(res.version ?? null)
        setUpdateNotes(res.notes ?? null)
        setUpdateStatus('available')
      } else {
        setUpdateStatus('up-to-date')
      }
    } catch (e: unknown) {
      setUpdateError(e instanceof Error ? e.message : String(e))
      setUpdateStatus('error')
    }
  }

  const installUpdate = async () => {
    setUpdateStatus('installing')
    setUpdateError(null)
    try {
      await tauriInvoke('install_update')
      setUpdateStatus('installed')
    } catch (e: unknown) {
      setUpdateError(e instanceof Error ? e.message : String(e))
      setUpdateStatus('error')
    }
  }

  const restartApp = async () => {
    try {
      await tauriInvoke('restart_app')
    } catch { /* will throw if not in Tauri */ }
  }

  const pull = async (model: string) => {
    setPulling(model)
    setPullPct(0)
    try {
      await apiOllamaPull(model, p => { if (typeof p === 'number') setPullPct(p) })
      const { models } = await apiOllamaModels()
      setOllamaModels(models)
    } catch {}
    setPulling(null)
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: 24, maxWidth: 680, margin: '0 auto', width: '100%' }}>
      <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 20, marginBottom: 20 }}>Settings</div>

      {/* ── Ollama ── */}
      <div style={{ background: T.s2, border: `1px solid ${T.b}`, borderRadius: 12, padding: 18, marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <div style={{ fontSize: 20 }}>🦙</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>Local Models — Ollama</div>
            <div style={{ fontSize: 12, color: T.mu }}>Always available, no API costs</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Dot color={ollamaOk ? T.gr : T.rd} pulse={ollamaOk} />
            <span style={{ fontSize: 12, color: ollamaOk ? T.gr : T.rd, fontWeight: 600 }}>
              {ollamaOk ? 'Connected' : 'Not running'}
            </span>
          </div>
        </div>

        {!ollamaOk && (
          <div style={{ background: T.amb + '15', border: `1px solid ${T.amb}44`, borderRadius: 8, padding: 12, marginBottom: 12, fontSize: 12 }}>
            <div style={{ fontWeight: 600, color: T.amb, marginBottom: 4 }}>Ollama not detected</div>
            <div style={{ color: T.mu }}>
              Install from <a href="https://ollama.ai" target="_blank" style={{ color: T.ac }}>ollama.ai</a>,
              then run: <code style={{ fontFamily: "'JetBrains Mono'", color: T.tl }}>ollama serve</code>
            </div>
          </div>
        )}

        <Field label="Default Model">
          <select value={loc.ollamaModel} onChange={e => setLoc(l => ({ ...l, ollamaModel: e.target.value }))} style={inputSx}>
            {ollamaModels.length > 0
              ? ollamaModels.map(m => <option key={m} value={m}>{m}</option>)
              : <option value="mistral:7b-instruct">mistral:7b-instruct</option>}
          </select>
        </Field>

        <div style={{ fontSize: 11, fontWeight: 600, color: T.mu, textTransform: 'uppercase', marginBottom: 8 }}>Model Library</div>
        {WANT_MODELS.map(m => {
          const has = hasModel(m.id)
          const isPulling = pulling === m.id
          return (
            <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', background: has ? T.gr + '12' : T.s3, borderRadius: 8, marginBottom: 5, border: `1px solid ${has ? T.gr + '33' : T.b}` }}>
              <Dot color={has ? T.gr : T.mu2} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 500 }}>{m.id}</div>
                <div style={{ fontSize: 10, color: T.mu }}>{m.desc} — {m.size}</div>
              </div>
              {has ? (
                <span style={{ padding: '2px 8px', borderRadius: 5, fontSize: 9, fontWeight: 600, background: T.gr + '20', color: T.gr }}>Ready</span>
              ) : isPulling ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Spinner />
                  <span style={{ fontSize: 11, color: T.amb }}>{pullPct}%</span>
                </div>
              ) : (
                <button onClick={() => pull(m.id)} disabled={!ollamaOk} style={{ padding: '3px 10px', background: T.ac, border: 'none', borderRadius: 5, color: T.tx, cursor: ollamaOk ? 'pointer' : 'not-allowed', fontSize: 11, opacity: ollamaOk ? 1 : 0.4 }}>
                  Pull
                </button>
              )}
            </div>
          )
        })}
      </div>

      {/* ── Anthropic ── */}
      <div style={{ background: T.s2, border: `1px solid ${loc.anthropicEnabled ? T.ac + '55' : T.b}`, borderRadius: 12, padding: 18, marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: loc.anthropicEnabled ? 16 : 0 }}>
          <div style={{ fontSize: 20 }}>🤖</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>Anthropic Claude</div>
            <div style={{ fontSize: 12, color: T.mu }}>Optional — key stored in backend, never in browser</div>
          </div>
          <div onClick={() => setLoc(l => ({ ...l, anthropicEnabled: !l.anthropicEnabled }))} style={{ width: 40, height: 22, borderRadius: 11, background: loc.anthropicEnabled ? T.ac : T.s4, cursor: 'pointer', position: 'relative', transition: 'background .2s' }}>
            <div style={{ position: 'absolute', top: 4, left: loc.anthropicEnabled ? 20 : 4, width: 14, height: 14, borderRadius: '50%', background: '#fff', transition: 'left .2s' }} />
          </div>
        </div>

        {loc.anthropicEnabled && (
          <>
            <Field label="API Key">
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="password"
                  value={loc.anthropicKey}
                  onChange={e => setLoc(l => ({ ...l, anthropicKey: e.target.value }))}
                  placeholder="sk-ant-… (sent to local backend only, never to browser network)"
                  style={{ ...inputSx, flex: 1 }}
                />
                <button onClick={testAnthropic} disabled={testing || !loc.anthropicKey} style={{ padding: '8px 12px', background: T.bl, border: 'none', borderRadius: 7, color: T.tx, cursor: 'pointer', fontSize: 12, opacity: testing || !loc.anthropicKey ? 0.4 : 1 }}>
                  {testing ? '…' : 'Test'}
                </button>
                {testResult && <span style={{ color: testResult === 'success' ? T.gr : T.rd, fontSize: 20 }}>{testResult === 'success' ? '✓' : '✗'}</span>}
              </div>
            </Field>

            <Field label="Daily Budget (USD)">
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <input type="number" value={loc.budget} min={0} step={0.5} onChange={e => setLoc(l => ({ ...l, budget: Number(e.target.value) }))} style={{ ...inputSx, width: 90 }} />
                <span style={{ fontSize: 12, color: T.mu }}>
                  per day — today: <span style={{ color: spendToday > 0 ? T.amb : T.mu }}>${spendToday.toFixed(4)}</span>
                </span>
              </div>
            </Field>

            <div style={{ fontSize: 11, color: T.gr, padding: '8px 10px', background: T.gr + '12', borderRadius: 7 }}>
              ✓ Test call is routed through the local sidecar — your key is never sent directly from the browser to Anthropic.
            </div>
          </>
        )}
      </div>

      {/* ── AI Tone ── */}
      <div style={{ background: T.s2, border: `1px solid ${T.b}`, borderRadius: 12, padding: 18, marginBottom: 14 }}>
        <Field label="AI Response Tone">
          <select value={loc.tone} onChange={e => setLoc(l => ({ ...l, tone: e.target.value }))} style={inputSx}>
            {['professional', 'casual', 'concise', 'detailed', 'technical'].map(t => (
              <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
            ))}
          </select>
        </Field>
        <div style={{ fontSize: 11, color: T.mu }}>Applied as a system-level hint on every chat message.</div>
      </div>

      {/* ── Ollama URL ── */}
      <div style={{ background: T.s2, border: `1px solid ${T.b}`, borderRadius: 12, padding: 18, marginBottom: 14 }}>
        <Field label="Ollama Server URL">
          <input type="text" value={loc.ollamaUrl} onChange={e => setLoc(l => ({ ...l, ollamaUrl: e.target.value }))} style={inputSx} />
        </Field>
        <div style={{ fontSize: 11, color: T.mu }}>Change only if Ollama is running on a different host or port.</div>
      </div>

      {/* ── App Updates ── */}
      <div style={{ background: T.s2, border: `1px solid ${T.b}`, borderRadius: 12, padding: 18, marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <div style={{ fontSize: 20 }}>🔄</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>App Updates</div>
            <div style={{ fontSize: 12, color: T.mu }}>
              Current version: <span style={{ fontFamily: "'JetBrains Mono',monospace", color: T.ac }}>{APP_VERSION}</span>
            </div>
          </div>
          {updateStatus === 'available' && (
            <span style={{ padding: '3px 8px', borderRadius: 5, fontSize: 10, fontWeight: 700, background: T.gr + '20', color: T.gr }}>
              Update available
            </span>
          )}
        </div>

        {!isTauri && (
          <div style={{ fontSize: 12, color: T.mu, padding: '8px 10px', background: T.s3, borderRadius: 7 }}>
            Updates are only available in the packaged desktop app.
          </div>
        )}

        {isTauri && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {/* Status messages */}
            {updateStatus === 'up-to-date' && (
              <div style={{ fontSize: 12, color: T.gr, padding: '8px 10px', background: T.gr + '12', borderRadius: 7 }}>
                ✓ You're up to date
              </div>
            )}
            {updateStatus === 'available' && (
              <div style={{ padding: '10px 12px', background: T.ac + '12', border: `1px solid ${T.ac}33`, borderRadius: 7 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: T.ac, marginBottom: 4 }}>
                  Universe AI {updateVersion} is available
                </div>
                {updateNotes && (
                  <div style={{ fontSize: 11, color: T.mu, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                    {updateNotes}
                  </div>
                )}
              </div>
            )}
            {updateStatus === 'installing' && (
              <div style={{ fontSize: 12, color: T.amb, padding: '8px 10px', background: T.amb + '12', borderRadius: 7, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Spinner size={12} /> Downloading and installing update…
              </div>
            )}
            {updateStatus === 'installed' && (
              <div style={{ fontSize: 12, color: T.gr, padding: '8px 10px', background: T.gr + '12', borderRadius: 7 }}>
                ✓ Update installed — restart to apply
              </div>
            )}
            {updateStatus === 'error' && (
              <div style={{ fontSize: 12, color: T.rd, padding: '8px 10px', background: T.rd + '12', borderRadius: 7 }}>
                ✕ {updateError}
              </div>
            )}

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: 8 }}>
              {updateStatus !== 'installed' && (
                <button
                  onClick={checkForUpdate}
                  disabled={updateStatus === 'checking' || updateStatus === 'installing'}
                  style={{
                    padding: '7px 14px', borderRadius: 7, border: `1px solid ${T.b2}`,
                    background: 'none', color: T.tx, cursor: 'pointer', fontSize: 12,
                    opacity: updateStatus === 'checking' || updateStatus === 'installing' ? 0.4 : 1,
                    display: 'flex', alignItems: 'center', gap: 6,
                  }}
                >
                  {updateStatus === 'checking' ? <><Spinner size={11} /> Checking…</> : 'Check for Updates'}
                </button>
              )}
              {updateStatus === 'available' && (
                <button
                  onClick={installUpdate}
                  style={{ padding: '7px 14px', borderRadius: 7, border: 'none', background: T.ac, color: T.tx, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}
                >
                  Install Update
                </button>
              )}
              {updateStatus === 'installed' && (
                <button
                  onClick={restartApp}
                  style={{ padding: '7px 14px', borderRadius: 7, border: 'none', background: T.gr, color: T.tx, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}
                >
                  Restart Now
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        <Btn onClick={save} variant="ok">{saved ? '✓ Saved' : 'Save Settings'}</Btn>
      </div>
    </div>
  )
}
