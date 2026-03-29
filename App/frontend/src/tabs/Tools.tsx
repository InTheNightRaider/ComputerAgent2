import { useState, useRef, useEffect } from 'react'
import { T, inputSx } from '../theme'
import { Tag } from '../components/Tag'
import { Spinner } from '../components/Spinner'
import { useAppStore } from '../store'
import { apiChat, apiEnhanceTool, apiGetModification, ModRecord } from '../api'

// ── Types ─────────────────────────────────────────────────────────────────────

type ToolStatus = 'available' | 'coming-soon'

interface Tool {
  id: string
  icon: string
  name: string
  desc: string
  cat: string
  status: ToolStatus
}

const TOOLS: Tool[] = [
  { id: 'voice',      icon: '🎙️', name: 'Voice Recorder',       desc: 'Record audio and transcribe with Whisper',        cat: 'Media',     status: 'available' },
  { id: 'summarizer', icon: '📝', name: 'Summarizer',            desc: 'Summarize any text, paste or type content',       cat: 'Text',      status: 'available' },
  { id: 'translator', icon: '🌐', name: 'Translator',            desc: 'Translate text between 50+ languages',            cat: 'Language',  status: 'available' },
  { id: 'ocr',        icon: '🔍', name: 'OCR & Document Reader', desc: 'Extract and structure text from documents',       cat: 'Documents', status: 'available' },
  { id: 'imagegen',   icon: '🖼️', name: 'Image Generator',       desc: 'Generate images from text with local diffusion',  cat: 'Media',     status: 'coming-soon' },
  { id: 'coderunner', icon: '💻', name: 'Code Runner',           desc: 'Execute and test code snippets with sandboxing',  cat: 'Dev',       status: 'coming-soon' },
  { id: 'webfetch',   icon: '🌐', name: 'Web Fetch & Scrape',    desc: 'Pull and parse content from any URL',             cat: 'Data',      status: 'coming-soon' },
  { id: 'csvtool',    icon: '📊', name: 'CSV / Data Analyzer',   desc: 'Upload CSV and query it with natural language',   cat: 'Data',      status: 'coming-soon' },
  { id: 'diffcheck',  icon: '🔀', name: 'Diff Checker',          desc: 'Compare two text blocks or documents',            cat: 'Text',      status: 'coming-soon' },
  { id: 'formatter',  icon: '✏️', name: 'Text Formatter',        desc: 'Reformat, clean, and restructure text',           cat: 'Text',      status: 'coming-soon' },
]

const CATS = ['All', ...Array.from(new Set(TOOLS.map(t => t.cat)))]

// ── Tool capability descriptions (used by enhancement LLM) ────────────────────

const TOOL_DESCS: Record<string, string> = {
  summarizer: 'AI text summarizer. Has: textarea for input text; style selector (Brief, Detailed, Bullet Points, Executive Brief, ELI5); Summarize button; result box with copy button; error display. Calls /api/chat with a summarize prompt.',
  translator: 'AI translator. Has: FROM language selector (auto-detect + 25+ languages); TO language selector; text input textarea; Translate button; result box showing translation. Calls /api/chat with a translate prompt.',
  voice:      'Voice recorder tool. Has: big timer display (MM:SS); round record button (starts MediaRecorder); stop button with pulsing animation; audio playback element after recording; manual notes textarea; Whisper transcription info notice.',
  ocr:        'Document reader / OCR. Has: file drop zone for .txt/.md/.csv; document text textarea for paste; mode selector (Extract key info, Summarize, Bullet points, Clean/reformat, Action items); Process button; result box with copy. Calls /api/chat.',
}

// ── Enhancement preset requests ────────────────────────────────────────────────

const ENHANCE_PRESETS = [
  { label: '+ History',     text: 'add a session history section below the result that saves the last 10 results with timestamps using localStorage, lets the user click to restore a past result' },
  { label: '+ Export MD',   text: 'add an "Export as Markdown" button that downloads the current result as a .md file using Blob and URL.createObjectURL' },
  { label: '+ AI Chat',     text: 'add a follow-up chat panel below the result where the user can ask follow-up questions about the result; the AI has access to the result as context' },
  { label: '+ File Upload', text: 'add a drag-and-drop file upload zone at the top for .txt and .md files that loads the file content directly into the input field' },
  { label: '+ Stats Bar',   text: 'add a stats bar showing word count, character count, sentence count, and estimated reading time; update it live as the user types in the input' },
  { label: '+ Word Cloud',  text: 'add a simple word frequency analysis panel that shows the top 20 most frequent meaningful words as a visual frequency list with bars' },
  { label: '+ Compare',     text: 'add a split view mode where the user can enter two texts and see both results side-by-side for comparison' },
]

// ── Enhancement sidebar ────────────────────────────────────────────────────────

const ENHANCE_STATUS_LABEL: Record<string, string> = {
  pending:             'Queued…',
  classifying:         'Classifying…',
  generating_frontend: 'Generating enhanced component…',
  validating:          'Validating…',
  applying:            'Writing file…',
  done:                'Enhancement ready',
  failed:              'Failed',
}

function ToolEnhanceSidebar({
  toolId,
  toolName,
  onClose,
}: {
  toolId: string
  toolName: string
  onClose: () => void
}) {
  const { addDynTab, setActiveTab } = useAppStore()
  const [input, setInput]       = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [mod, setMod]           = useState<ModRecord | null>(null)
  const [submitErr, setSubmitErr] = useState<string | null>(null)
  const [tabOpened, setTabOpened] = useState(false)

  const isDone   = mod?.status === 'done'
  const isFail   = mod?.status === 'failed'
  const isActive = !!mod && !isDone && !isFail

  // Poll mod progress
  useEffect(() => {
    if (!mod || isDone || isFail) return
    const id = setInterval(async () => {
      try {
        const { modification } = await apiGetModification(mod.id)
        setMod(modification)
      } catch { /* sidecar busy */ }
    }, 1500)
    return () => clearInterval(id)
  }, [mod?.id, isDone, isFail])

  const submit = async (text: string) => {
    const req = text.trim()
    if (!req || submitting) return
    setSubmitting(true)
    setSubmitErr(null)
    setMod(null)
    setTabOpened(false)
    try {
      const toolDesc = TOOL_DESCS[toolId] ?? toolName
      const { modification } = await apiEnhanceTool(toolName, toolDesc, req)
      setMod(modification)
    } catch (e) {
      setSubmitErr(e instanceof Error ? e.message : String(e))
    }
    setSubmitting(false)
    setInput('')
  }

  const openTab = () => {
    if (!mod?.id) return
    addDynTab({ id: mod.id, label: `✦ ${toolName}+`, closeable: true, comp: mod.id })
    setActiveTab(mod.id)
    setTabOpened(true)
  }

  const headerColor = isDone ? T.gr : isFail ? T.rd : isActive ? T.ac : T.mu

  return (
    <div style={{
      width: 336, flexShrink: 0,
      borderLeft: `1px solid ${T.b}`,
      background: T.s1,
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* Sidebar header */}
      <div style={{ padding: '12px 14px 10px', borderBottom: `1px solid ${T.b}`, display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <span style={{ color: T.ac, fontSize: 14 }}>✦</span>
        <span style={{ fontWeight: 700, fontSize: 13 }}>Enhance {toolName}</span>
        <div style={{ flex: 1 }} />
        <button
          onClick={onClose}
          style={{ background: 'none', border: 'none', color: T.mu, cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: '0 3px' }}
        >
          ×
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 14, display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* Progress view */}
        {mod && (
          <div>
            <div style={{
              padding: '12px 14px',
              background: headerColor + '10',
              border: `1px solid ${headerColor}33`,
              borderRadius: 10,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: isDone || isFail ? 10 : 0 }}>
                {isActive && <Spinner size={12} />}
                <span style={{ color: headerColor, fontWeight: 700, fontSize: 12 }}>
                  {ENHANCE_STATUS_LABEL[mod.status] ?? mod.status}
                </span>
              </div>

              {isFail && mod.error && (
                <div style={{ fontSize: 11, color: T.rd, lineHeight: 1.5 }}>{mod.error}</div>
              )}

              {isDone && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {mod.change_type === 'live' && (
                    <div style={{ fontSize: 11, color: T.gr }}>⚡ Live — opens immediately</div>
                  )}
                  {mod.change_type === 'restart_required' && (
                    <div style={{ fontSize: 11, color: T.amb }}>↺ Restart required to activate backend route</div>
                  )}
                  <button
                    onClick={openTab}
                    style={{
                      padding: '7px 14px',
                      background: tabOpened ? T.gr + '20' : T.ac + '20',
                      border: `1px solid ${tabOpened ? T.gr : T.ac}55`,
                      borderRadius: 7, color: tabOpened ? T.gr : T.ac,
                      cursor: 'pointer', fontSize: 12, fontWeight: 600,
                    }}
                  >
                    {tabOpened ? '✓ Opened' : `↗ Open Enhanced ${toolName}`}
                  </button>
                </div>
              )}
            </div>

            <button
              onClick={() => { setMod(null); setSubmitErr(null); setTabOpened(false) }}
              style={{ marginTop: 10, background: 'none', border: 'none', color: T.mu, cursor: 'pointer', fontSize: 11, padding: 0 }}
            >
              ← Try another enhancement
            </button>
          </div>
        )}

        {/* Preset chips — shown when no active mod */}
        {!mod && (
          <>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: T.mu, textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 8 }}>
                Quick Enhancements
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {ENHANCE_PRESETS.map(p => (
                  <button
                    key={p.label}
                    onClick={() => submit(p.text)}
                    disabled={submitting}
                    style={{
                      textAlign: 'left', padding: '7px 12px',
                      background: T.s2, border: `1px solid ${T.b}`,
                      borderRadius: 8, color: T.tx, cursor: submitting ? 'not-allowed' : 'pointer',
                      fontSize: 12, fontWeight: 500,
                      opacity: submitting ? 0.4 : 1,
                      transition: 'border-color .15s',
                    }}
                    onMouseEnter={e => { if (!submitting) e.currentTarget.style.borderColor = T.ac + '66' }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = T.b }}
                  >
                    <span style={{ color: T.ac, marginRight: 6 }}>✦</span>{p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom input */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: T.mu, textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 6 }}>
                Custom Enhancement
              </div>
              <textarea
                rows={3}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) submit(input) }}
                placeholder="e.g. add a saved recordings list with timestamps…"
                style={{ ...inputSx, width: '100%', resize: 'vertical', fontSize: 12 }}
              />
              <button
                onClick={() => submit(input)}
                disabled={submitting || !input.trim()}
                style={{
                  marginTop: 8, width: '100%', padding: '8px 14px',
                  background: submitting || !input.trim() ? T.s3 : T.ac,
                  border: 'none', borderRadius: 8,
                  color: submitting || !input.trim() ? T.mu : T.tx,
                  cursor: submitting || !input.trim() ? 'not-allowed' : 'pointer',
                  fontSize: 12, fontWeight: 600,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                }}
              >
                {submitting ? <><Spinner size={12} /> Submitting…</> : '✦ Apply Enhancement'}
              </button>
              <div style={{ fontSize: 10, color: T.mu2, marginTop: 5 }}>Ctrl+Enter to submit</div>
            </div>
          </>
        )}

        {/* Error */}
        {submitErr && (
          <div style={{ padding: '8px 12px', background: T.rd + '12', border: `1px solid ${T.rd}33`, borderRadius: 8, fontSize: 12, color: T.rd }}>
            {submitErr}
          </div>
        )}

        {/* Tool description */}
        <div style={{ borderTop: `1px solid ${T.b}`, paddingTop: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: T.mu, textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 6 }}>
            About this tool
          </div>
          <div style={{ fontSize: 11, color: T.mu2, lineHeight: 1.65 }}>
            {TOOL_DESCS[toolId] ?? 'A built-in Universe AI tool.'}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Shared workspace primitives ────────────────────────────────────────────────

function WorkspaceHeader({
  icon, name, onBack, onEnhance, enhanceActive,
}: {
  icon: string; name: string; onBack: () => void
  onEnhance?: () => void; enhanceActive?: boolean
}) {
  return (
    <div style={{ padding: '14px 20px', borderBottom: `1px solid ${T.b}`, display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0, background: T.s1 }}>
      <button
        onClick={onBack}
        style={{ padding: '4px 12px', background: T.s3, border: `1px solid ${T.b}`, borderRadius: 7, color: T.mu, cursor: 'pointer', fontSize: 12 }}
      >
        ← Tools
      </button>
      <span style={{ fontSize: 20 }}>{icon}</span>
      <span style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 16 }}>{name}</span>
      <div style={{ flex: 1 }} />
      {onEnhance && (
        <button
          onClick={onEnhance}
          style={{
            padding: '5px 13px',
            background: enhanceActive ? T.ac + '20' : 'none',
            border: `1px solid ${enhanceActive ? T.ac + '66' : T.b2}`,
            borderRadius: 7, color: enhanceActive ? T.ac : T.mu,
            cursor: 'pointer', fontSize: 12, fontWeight: 600,
            display: 'flex', alignItems: 'center', gap: 5,
            transition: 'border-color .15s, color .15s',
          }}
          onMouseEnter={e => { if (!enhanceActive) e.currentTarget.style.color = T.ac }}
          onMouseLeave={e => { if (!enhanceActive) e.currentTarget.style.color = T.mu }}
        >
          <span style={{ fontSize: 11 }}>✦</span> Enhance
        </button>
      )}
    </div>
  )
}

function ResultBox({ result, label = 'Result' }: { result: string; label?: string }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(result).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  return (
    <div style={{ background: T.s2, border: `1px solid ${T.b}`, borderRadius: 10, overflow: 'hidden' }}>
      <div style={{ padding: '8px 14px', borderBottom: `1px solid ${T.b}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: T.mu, textTransform: 'uppercase', letterSpacing: '.5px' }}>{label}</span>
        <button
          onClick={copy}
          style={{ padding: '3px 10px', background: 'none', border: `1px solid ${T.b2}`, borderRadius: 5, color: copied ? T.gr : T.mu, cursor: 'pointer', fontSize: 11 }}
        >
          {copied ? '✓ Copied' : 'Copy'}
        </button>
      </div>
      <div style={{ padding: '14px 16px', fontSize: 13, lineHeight: 1.75, color: T.tx, whiteSpace: 'pre-wrap', maxHeight: 340, overflowY: 'auto' }}>
        {result}
      </div>
    </div>
  )
}

function ErrorBox({ msg }: { msg: string }) {
  return (
    <div style={{ padding: '10px 14px', background: T.rd + '12', border: `1px solid ${T.rd}33`, borderRadius: 8, fontSize: 12, color: T.rd }}>
      {msg}
    </div>
  )
}

function RunBtn({ onClick, loading, disabled, label = 'Run' }: { onClick: () => void; loading: boolean; disabled?: boolean; label?: string }) {
  return (
    <button
      onClick={onClick}
      disabled={loading || disabled}
      style={{
        padding: '9px 24px', background: (loading || disabled) ? T.s3 : T.ac,
        border: 'none', borderRadius: 9, color: (loading || disabled) ? T.mu : T.tx,
        fontWeight: 600, fontSize: 13, cursor: (loading || disabled) ? 'not-allowed' : 'pointer',
        display: 'flex', alignItems: 'center', gap: 8,
      }}
    >
      {loading && <Spinner size={13} />}
      {loading ? 'Running…' : label}
    </button>
  )
}

// ── Summarizer ────────────────────────────────────────────────────────────────

const SUMMARY_STYLES = ['Brief', 'Detailed', 'Bullet Points', 'Executive Brief', 'ELI5']

function SummarizerTool({ onBack }: { onBack: () => void }) {
  const { settings } = useAppStore()
  const [showEnhance, setShowEnhance] = useState(false)
  const [input, setInput]   = useState('')
  const [style, setStyle]   = useState('Brief')
  const [result, setResult] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]   = useState<string | null>(null)

  const run = async () => {
    if (!input.trim() || loading) return
    setLoading(true); setError(null); setResult('')
    try {
      const prompt = `Summarize the following text in a ${style.toLowerCase()} style. Be concise and accurate.\n\n---\n${input}`
      const resp = await apiChat({ messages: [{ role: 'user', content: prompt }], model: settings.ollamaModel })
      setResult(resp.content)
    } catch (e) { setError(e instanceof Error ? e.message : String(e)) }
    setLoading(false)
  }

  return (
    <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <WorkspaceHeader icon="📝" name="Summarizer" onBack={onBack} onEnhance={() => setShowEnhance(v => !v)} enhanceActive={showEnhance} />
        <div style={{ flex: 1, overflowY: 'auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: T.mu, display: 'block', marginBottom: 6 }}>TEXT TO SUMMARIZE</label>
            <textarea
              rows={8}
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Paste or type the text you want summarized…"
              style={{ ...inputSx, width: '100%', resize: 'vertical' }}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: T.mu }}>STYLE</label>
            <select value={style} onChange={e => setStyle(e.target.value)} style={{ ...inputSx, width: 'auto' }}>
              {SUMMARY_STYLES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <RunBtn onClick={run} loading={loading} disabled={!input.trim()} label="Summarize" />
          </div>
          {error && <ErrorBox msg={error} />}
          {result && <ResultBox result={result} label="Summary" />}
          {!result && !error && !loading && (
            <div style={{ textAlign: 'center', padding: '32px 0', color: T.mu, fontSize: 13 }}>
              Paste text above and click <strong style={{ color: T.tx }}>Summarize</strong>
            </div>
          )}
        </div>
      </div>
      {showEnhance && <ToolEnhanceSidebar toolId="summarizer" toolName="Summarizer" onClose={() => setShowEnhance(false)} />}
    </div>
  )
}

// ── Translator ────────────────────────────────────────────────────────────────

const LANGUAGES = ['Auto-detect', 'English', 'Spanish', 'French', 'German', 'Italian', 'Portuguese', 'Dutch', 'Russian', 'Chinese (Simplified)', 'Chinese (Traditional)', 'Japanese', 'Korean', 'Arabic', 'Hindi', 'Turkish', 'Polish', 'Swedish', 'Norwegian', 'Danish', 'Finnish', 'Greek', 'Hebrew', 'Indonesian', 'Malay', 'Thai', 'Vietnamese']

function TranslatorTool({ onBack }: { onBack: () => void }) {
  const { settings } = useAppStore()
  const [showEnhance, setShowEnhance] = useState(false)
  const [input, setInput]     = useState('')
  const [fromLang, setFromLang] = useState('Auto-detect')
  const [toLang, setToLang]   = useState('Spanish')
  const [result, setResult]   = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)

  const run = async () => {
    if (!input.trim() || loading) return
    setLoading(true); setError(null); setResult('')
    try {
      const from = fromLang === 'Auto-detect' ? 'the source language (auto-detect it)' : fromLang
      const prompt = `Translate the following text from ${from} to ${toLang}. Output only the translated text, nothing else.\n\n${input}`
      const resp = await apiChat({ messages: [{ role: 'user', content: prompt }], model: settings.ollamaModel })
      setResult(resp.content)
    } catch (e) { setError(e instanceof Error ? e.message : String(e)) }
    setLoading(false)
  }

  return (
    <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <WorkspaceHeader icon="🌐" name="Translator" onBack={onBack} onEnhance={() => setShowEnhance(v => !v)} enhanceActive={showEnhance} />
        <div style={{ flex: 1, overflowY: 'auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: T.mu }}>FROM</label>
              <select value={fromLang} onChange={e => setFromLang(e.target.value)} style={{ ...inputSx, width: 'auto' }}>
                {LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
            <span style={{ color: T.mu, fontSize: 18 }}>→</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: T.mu }}>TO</label>
              <select value={toLang} onChange={e => setToLang(e.target.value)} style={{ ...inputSx, width: 'auto' }}>
                {LANGUAGES.filter(l => l !== 'Auto-detect').map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: T.mu, display: 'block', marginBottom: 6 }}>TEXT TO TRANSLATE</label>
            <textarea
              rows={7}
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Type or paste the text you want to translate…"
              style={{ ...inputSx, width: '100%', resize: 'vertical' }}
            />
          </div>
          <RunBtn onClick={run} loading={loading} disabled={!input.trim()} label="Translate" />
          {error && <ErrorBox msg={error} />}
          {result && <ResultBox result={result} label={`Translation → ${toLang}`} />}
          {!result && !error && !loading && (
            <div style={{ textAlign: 'center', padding: '32px 0', color: T.mu, fontSize: 13 }}>
              Enter text above and click <strong style={{ color: T.tx }}>Translate</strong>
            </div>
          )}
        </div>
      </div>
      {showEnhance && <ToolEnhanceSidebar toolId="translator" toolName="Translator" onClose={() => setShowEnhance(false)} />}
    </div>
  )
}

// ── Voice Recorder ────────────────────────────────────────────────────────────

function fmt(secs: number) {
  const m = Math.floor(secs / 60).toString().padStart(2, '0')
  const s = (secs % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

function VoiceRecorderTool({ onBack }: { onBack: () => void }) {
  const { settings } = useAppStore()
  const [showEnhance, setShowEnhance] = useState(false)
  const [recording, setRecording]   = useState(false)
  const [audioUrl, setAudioUrl]     = useState<string | null>(null)
  const [elapsed, setElapsed]       = useState(0)
  const [micError, setMicError]     = useState<string | null>(null)
  const [note, setNote]             = useState('')
  const [aiSummary, setAiSummary]   = useState('')
  const [summaryLoading, setSummaryLoading] = useState(false)

  const mrRef     = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef  = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current) }, [])

  const startRecording = async () => {
    setMicError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mr = new MediaRecorder(stream)
      mrRef.current = mr
      chunksRef.current = []
      mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        setAudioUrl(URL.createObjectURL(blob))
        stream.getTracks().forEach(t => t.stop())
      }
      mr.start(100)
      setRecording(true)
      setElapsed(0)
      setAudioUrl(null)
      timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000)
    } catch {
      setMicError('Microphone access denied. Allow microphone access in your browser.')
    }
  }

  const stopRecording = () => {
    mrRef.current?.stop()
    setRecording(false)
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
  }

  const summarizeNotes = async () => {
    if (!note.trim()) return
    setSummaryLoading(true)
    try {
      const resp = await apiChat({
        messages: [{ role: 'user', content: `Summarize these recording notes into key points and action items:\n\n${note}` }],
        model: settings.ollamaModel,
      })
      setAiSummary(resp.content)
    } catch { /* ignore */ }
    setSummaryLoading(false)
  }

  return (
    <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <WorkspaceHeader icon="🎙️" name="Voice Recorder" onBack={onBack} onEnhance={() => setShowEnhance(v => !v)} enhanceActive={showEnhance} />
        <div style={{ flex: 1, overflowY: 'auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Recorder widget */}
          <div style={{ background: T.s2, border: `1px solid ${T.b}`, borderRadius: 14, padding: 28, textAlign: 'center' }}>
            <div style={{
              fontFamily: "'JetBrains Mono',monospace",
              fontSize: 48, fontWeight: 700,
              color: recording ? T.rd : T.mu,
              marginBottom: 20, letterSpacing: 2,
            }}>
              {fmt(elapsed)}
            </div>
            {!recording ? (
              <button
                onClick={startRecording}
                style={{
                  width: 72, height: 72, borderRadius: '50%',
                  background: T.rd, border: `4px solid ${T.rd}44`,
                  cursor: 'pointer', fontSize: 28, display: 'inline-flex',
                  alignItems: 'center', justifyContent: 'center',
                  boxShadow: `0 0 0 8px ${T.rd}18`,
                }}
              >
                🎙️
              </button>
            ) : (
              <button
                onClick={stopRecording}
                style={{
                  width: 72, height: 72, borderRadius: '50%',
                  background: T.s3, border: `4px solid ${T.rd}88`,
                  cursor: 'pointer', display: 'inline-flex',
                  alignItems: 'center', justifyContent: 'center',
                  animation: 'pulse 1.2s ease infinite',
                }}
              >
                <div style={{ width: 26, height: 26, borderRadius: 4, background: T.rd }} />
              </button>
            )}
            <div style={{ marginTop: 14, fontSize: 12, color: T.mu }}>
              {recording ? 'Recording — click to stop' : audioUrl ? 'Recording complete' : 'Click to start recording'}
            </div>
          </div>

          {micError && <ErrorBox msg={micError} />}

          {audioUrl && (
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: T.mu, display: 'block', marginBottom: 8 }}>PLAYBACK</label>
              <audio controls src={audioUrl} style={{ width: '100%', borderRadius: 8 }} />
            </div>
          )}

          {/* Whisper notice */}
          <div style={{ padding: '14px 16px', background: T.amb + '10', border: `1px solid ${T.amb}33`, borderRadius: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: T.amb, marginBottom: 4 }}>🔊 Whisper Transcription</div>
            <div style={{ fontSize: 12, color: T.mu, lineHeight: 1.6 }}>
              Automatic transcription requires Whisper running via Ollama (<code style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: T.tl }}>ollama pull whisper</code>).
              Until then, type your notes manually below.
            </div>
          </div>

          {/* Manual notes */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: T.mu, display: 'block', marginBottom: 6 }}>MANUAL NOTES</label>
            <textarea
              rows={5}
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Type transcription or notes here…"
              style={{ ...inputSx, width: '100%', resize: 'vertical' }}
            />
          </div>

          {/* AI summary of notes */}
          {note.trim() && (
            <div style={{ display: 'flex', gap: 10 }}>
              <RunBtn onClick={summarizeNotes} loading={summaryLoading} label="✦ Summarize Notes" />
            </div>
          )}
          {aiSummary && <ResultBox result={aiSummary} label="AI Summary" />}
        </div>
      </div>
      {showEnhance && <ToolEnhanceSidebar toolId="voice" toolName="Voice Recorder" onClose={() => setShowEnhance(false)} />}
    </div>
  )
}

// ── OCR / Document Reader ─────────────────────────────────────────────────────

const OCR_MODES = ['Extract key information', 'Summarize document', 'Structure as bullet points', 'Clean and reformat', 'Find action items']

function OcrTool({ onBack }: { onBack: () => void }) {
  const { settings } = useAppStore()
  const [showEnhance, setShowEnhance] = useState(false)
  const [input, setInput]     = useState('')
  const [mode, setMode]       = useState(OCR_MODES[0])
  const [result, setResult]   = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const loadFile = (file: File) => {
    if (file.size > 500_000) { setError('File too large. Paste text directly for best results.'); return }
    const reader = new FileReader()
    reader.onload = e => setInput(e.target?.result as string ?? '')
    reader.onerror = () => setError('Could not read file.')
    if (file.type.startsWith('text') || file.name.endsWith('.md') || file.name.endsWith('.txt') || file.name.endsWith('.csv')) {
      reader.readAsText(file)
    } else {
      setError('Drag in a .txt or .md file, or paste text below. PDF/image OCR requires Tesseract (coming soon).')
    }
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) loadFile(file)
  }

  const run = async () => {
    if (!input.trim() || loading) return
    setLoading(true); setError(null); setResult('')
    try {
      const prompt = `${mode} from the following document text. Be thorough and accurate.\n\n---\n${input.slice(0, 8000)}`
      const resp = await apiChat({ messages: [{ role: 'user', content: prompt }], model: settings.ollamaModel })
      setResult(resp.content)
    } catch (e) { setError(e instanceof Error ? e.message : String(e)) }
    setLoading(false)
  }

  return (
    <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <WorkspaceHeader icon="🔍" name="OCR & Document Reader" onBack={onBack} onEnhance={() => setShowEnhance(v => !v)} enhanceActive={showEnhance} />
        <div style={{ flex: 1, overflowY: 'auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Drop zone */}
          <div
            onDrop={onDrop}
            onDragOver={e => e.preventDefault()}
            onClick={() => fileRef.current?.click()}
            style={{
              border: `2px dashed ${T.b2}`, borderRadius: 10, padding: '20px 16px',
              textAlign: 'center', cursor: 'pointer', background: T.s2,
              transition: 'border-color .15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = T.ac + '88')}
            onMouseLeave={e => (e.currentTarget.style.borderColor = T.b2)}
          >
            <div style={{ fontSize: 28, marginBottom: 6 }}>📂</div>
            <div style={{ fontSize: 13, color: T.tx, fontWeight: 500 }}>Drop a .txt or .md file, or click to browse</div>
            <div style={{ fontSize: 11, color: T.mu, marginTop: 4 }}>PDF / image OCR coming soon — paste text below in the meantime</div>
            <input ref={fileRef} type="file" accept=".txt,.md,.csv" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) loadFile(f) }} />
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: T.mu, display: 'block', marginBottom: 6 }}>DOCUMENT TEXT</label>
            <textarea
              rows={8}
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Or paste document text here…"
              style={{ ...inputSx, width: '100%', resize: 'vertical' }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: T.mu }}>MODE</label>
            <select value={mode} onChange={e => setMode(e.target.value)} style={{ ...inputSx, flex: 1, minWidth: 200 }}>
              {OCR_MODES.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
            <RunBtn onClick={run} loading={loading} disabled={!input.trim()} label="Process" />
          </div>

          {error && <ErrorBox msg={error} />}
          {result && <ResultBox result={result} label="Extracted Content" />}
          {!result && !error && !loading && (
            <div style={{ textAlign: 'center', padding: '24px 0', color: T.mu, fontSize: 13 }}>
              Drop a file or paste text, then click <strong style={{ color: T.tx }}>Process</strong>
            </div>
          )}
        </div>
      </div>
      {showEnhance && <ToolEnhanceSidebar toolId="ocr" toolName="OCR & Document Reader" onClose={() => setShowEnhance(false)} />}
    </div>
  )
}

// ── Tool catalog ──────────────────────────────────────────────────────────────

function ToolCatalog({ activeCat, onCatChange, onOpenTool }: {
  activeCat: string
  onCatChange: (c: string) => void
  onOpenTool: (id: string) => void
}) {
  const filtered = activeCat === 'All' ? TOOLS : TOOLS.filter(t => t.cat === activeCat)

  return (
    <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ padding: '20px 24px 0', flexShrink: 0 }}>
        <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 20, marginBottom: 6 }}>
          🔧 Tools Hub
        </div>
        <div style={{ fontSize: 13, color: T.mu, marginBottom: 16 }}>
          Pre-built tools you can run and enhance. Click <span style={{ color: T.ac, fontWeight: 600 }}>✦ Enhance</span> inside any tool to add features.
        </div>
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 12 }}>
          {CATS.map(cat => (
            <button
              key={cat}
              onClick={() => onCatChange(cat)}
              style={{
                padding: '5px 14px', border: 'none', borderRadius: 20, cursor: 'pointer',
                fontSize: 12, fontWeight: 500, flexShrink: 0,
                background: activeCat === cat ? T.ac : T.s3,
                color: activeCat === cat ? T.tx : T.mu,
              }}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 24px 24px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: 12 }}>
          {filtered.map(tool => {
            const available = tool.status === 'available'
            return (
              <div
                key={tool.id}
                onClick={available ? () => onOpenTool(tool.id) : undefined}
                style={{
                  background: T.s2,
                  border: `1px solid ${T.b}`,
                  borderRadius: 12,
                  padding: 16,
                  cursor: available ? 'pointer' : 'not-allowed',
                  opacity: available ? 1 : 0.45,
                  transition: 'border-color .15s, transform .1s',
                  position: 'relative',
                  userSelect: 'none',
                }}
                onMouseEnter={e => { if (available) { e.currentTarget.style.borderColor = T.ac + '88'; e.currentTarget.style.transform = 'translateY(-1px)' } }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = T.b; e.currentTarget.style.transform = 'translateY(0)' }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{ fontSize: 28, lineHeight: 1, marginTop: 2 }}>{tool.icon}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontWeight: 600, fontSize: 14 }}>{tool.name}</span>
                      {!available && (
                        <Tag color={T.mu2} style={{ fontSize: 9 }}>Coming Soon</Tag>
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: T.mu, lineHeight: 1.5, marginBottom: 8 }}>{tool.desc}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Tag color={T.ac} style={{ fontSize: 9 }}>{tool.cat}</Tag>
                      {available && (
                        <span style={{ fontSize: 11, color: T.ac, fontWeight: 600 }}>Open →</span>
                      )}
                      {available && (
                        <span style={{ fontSize: 10, color: T.mu }}>✦ enhanceable</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* CTA */}
        <div style={{ marginTop: 24, padding: '20px 24px', background: T.s2, border: `1px solid ${T.b}`, borderRadius: 12 }}>
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 6 }}>💬 Request a custom tool or enhance any existing one</div>
          <div style={{ fontSize: 13, color: T.mu }}>
            Open any tool and click <span style={{ color: T.ac, fontWeight: 600 }}>✦ Enhance</span> to add history, export, sidebar chat, file upload, and more — or go to Chat and use <span style={{ background: T.s3, padding: '1px 6px', borderRadius: 4, fontFamily: "'JetBrains Mono',monospace", fontSize: 12 }}>🔨</span> to build a new tool from scratch.
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main export ────────────────────────────────────────────────────────────────

export function Tools() {
  const [activeCat, setActiveCat]   = useState('All')
  const [openToolId, setOpenToolId] = useState<string | null>(null)

  if (openToolId === 'summarizer') return <SummarizerTool onBack={() => setOpenToolId(null)} />
  if (openToolId === 'translator') return <TranslatorTool onBack={() => setOpenToolId(null)} />
  if (openToolId === 'voice')      return <VoiceRecorderTool onBack={() => setOpenToolId(null)} />
  if (openToolId === 'ocr')        return <OcrTool onBack={() => setOpenToolId(null)} />

  return (
    <ToolCatalog
      activeCat={activeCat}
      onCatChange={setActiveCat}
      onOpenTool={setOpenToolId}
    />
  )
}
