import { useState } from 'react'
import { T, inputSx } from '../theme'
import { Btn } from '../components/Btn'
import { Tag } from '../components/Tag'
import { Spinner } from '../components/Spinner'
import { Field } from '../components/Field'
import { apiChat } from '../api'

// ── Types ─────────────────────────────────────────────────────────────────────

interface AStep {
  id: string
  typeId: string
  label: string
  prompt: string
}

interface AInput {
  id: string
  type: 'file' | 'textarea'
  label: string
  required: boolean
  ph?: string
  ext?: string
}

interface ATrigger {
  type: string
  label: string
  config: Record<string, string>
}

interface AutomationDef {
  id: string
  icon: string
  name: string
  trigger: ATrigger
  inputs: AInput[]
  steps: AStep[]
}

// ── Trigger options ───────────────────────────────────────────────────────────

const TRIGGER_OPTS = [
  { type: 'manual',        label: 'Manual',               desc: 'Run from UI anytime' },
  { type: 'manual-prompt', label: 'Manual + Prompt',      desc: 'Ask for a prompt before running' },
  { type: 'manual-file',   label: 'Manual + File Upload', desc: 'Ask for a file before running' },
  { type: 'schedule',      label: 'Schedule',             desc: 'Run on a time schedule' },
  { type: 'file-watch',    label: 'File Watch',           desc: 'Watch a folder for new files' },
]

// ── Step type library ─────────────────────────────────────────────────────────

const STEP_DEFS = [
  { id: 'llm',        icon: '🧠', label: 'AI / LLM',        desc: 'Run a prompt through the AI model' },
  { id: 'web-fetch',  icon: '🌐', label: 'Web Fetch',        desc: 'Fetch content from URLs' },
  { id: 'whisper',    icon: '🎙️', label: 'Transcribe Audio', desc: 'Convert audio/video to transcript' },
  { id: 'docformer',  icon: '📄', label: 'Parse Document',   desc: 'Extract text from PDF/DOCX' },
  { id: 'translator', icon: '🌐', label: 'Translate',        desc: 'Translate to another language' },
  { id: 'save-file',  icon: '💾', label: 'Save to File',     desc: 'Save output to a local file' },
  { id: 'send-email', icon: '📧', label: 'Send Email',       desc: 'Email the result' },
]

function getStepDef(typeId: string) {
  return STEP_DEFS.find(s => s.id === typeId) ?? STEP_DEFS[0]
}

// ── Templates ─────────────────────────────────────────────────────────────────

const TEMPLATES: {
  id: string; icon: string; name: string; desc: string; tag: string; tagColor: string
  scaffold: AutomationDef
}[] = [
  {
    id: 'meeting-notes', icon: '🎤', name: 'Meeting Notes',
    desc: 'Upload a meeting recording or transcript — get structured notes and action items.',
    tag: 'Meetings', tagColor: '#6c5ff5',
    scaffold: {
      id: 'meeting-notes', icon: '🎤', name: 'Meeting Notes',
      trigger: { type: 'manual-file', label: 'Manual + File Upload', config: {} },
      inputs: [
        { id: '__auto_file', type: 'file', label: 'Meeting Recording or Transcript', required: true, ext: '.mp3 .mp4 .m4a .wav .txt' },
        { id: 'i_ctx', type: 'textarea', label: 'Meeting Context (optional)', required: false, ph: 'e.g. Q3 planning call with product team' },
      ],
      steps: [
        { id: 's1', typeId: 'llm', label: 'Extract Notes & Action Items', prompt: 'You are a meeting assistant. Analyze this meeting content.\n\n## Summary\nBrief 2-3 sentence overview.\n\n## Key Decisions\n- List each decision\n\n## Action Items\n| Owner | Task | Deadline |\n|-------|------|----------|\n\n## Open Questions\n- Unresolved topics\n\nBe precise and concise.' },
        { id: 's2', typeId: 'save-file', label: 'Save Notes', prompt: '' },
      ],
    },
  },
  {
    id: 'document-review', icon: '📋', name: 'Document Review',
    desc: 'Upload any document and get a structured AI review with highlights and recommendations.',
    tag: 'Documents', tagColor: '#c47a10',
    scaffold: {
      id: 'document-review', icon: '📋', name: 'Document Review',
      trigger: { type: 'manual-file', label: 'Manual + File Upload', config: {} },
      inputs: [
        { id: '__auto_file', type: 'file', label: 'Document', required: true, ext: '.pdf .docx .txt .md' },
        { id: 'i_focus', type: 'textarea', label: 'Review Focus (optional)', required: false, ph: 'e.g. Focus on risks and payment terms' },
      ],
      steps: [
        { id: 's1', typeId: 'docformer', label: 'Parse Document', prompt: '' },
        { id: 's2', typeId: 'llm', label: 'Review & Analyze', prompt: 'Review this document carefully.\n\n## Overview\nType, purpose, key parties.\n\n## Key Points\n- 5-7 most important points\n\n## Potential Issues\nRate each HIGH / MED / LOW with recommendation.\n\n## Recommendations\nBrief action list.' },
        { id: 's3', typeId: 'save-file', label: 'Save Review', prompt: '' },
      ],
    },
  },
  {
    id: 'research-digest', icon: '📰', name: 'Research Digest',
    desc: 'Compile research papers and news into a daily digest on your topics.',
    tag: 'Research', tagColor: '#0fb878',
    scaffold: {
      id: 'research-digest', icon: '📰', name: 'Research Digest',
      trigger: { type: 'schedule', label: 'Schedule', config: { label: 'Daily at 7:00 AM', cron: '0 7 * * *' } },
      inputs: [
        { id: 'i_topics', type: 'textarea', label: 'Topics / Keywords', required: false, ph: 'e.g. machine learning, LLMs, robotics' },
      ],
      steps: [
        { id: 's1', typeId: 'web-fetch', label: 'Fetch Sources', prompt: 'https://arxiv.org/list/cs.AI/recent\nhttps://news.ycombinator.com' },
        { id: 's2', typeId: 'llm', label: 'Synthesize Digest', prompt: 'You are a research analyst.\n\n## Top Papers (3-5)\nTitle, 2-sentence summary, why it matters.\n\n## Tech News (3-5)\nHeadline + 1-sentence summary.\n\n## Big Idea\nOne paragraph connecting today\'s themes.\n\nBe rigorous and insightful.' },
        { id: 's3', typeId: 'send-email', label: 'Email Digest', prompt: '' },
      ],
    },
  },
  {
    id: 'email-summary', icon: '📥', name: 'Email Summary',
    desc: 'Paste an email and get a summary with action and priority.',
    tag: 'Email', tagColor: '#EA4335',
    scaffold: {
      id: 'email-summary', icon: '📥', name: 'Email Summary',
      trigger: { type: 'manual-prompt', label: 'Manual + Prompt', config: {} },
      inputs: [
        { id: '__auto_prompt', type: 'textarea', label: 'Paste Email Content', required: true, ph: 'Paste the email text here...' },
      ],
      steps: [
        { id: 's1', typeId: 'llm', label: 'Summarize Email', prompt: 'Summarize this email:\n1. Required action (if any)\n2. Key information\n3. Suggested 1-2 sentence reply\n4. Priority: HIGH / MEDIUM / LOW' },
        { id: 's2', typeId: 'save-file', label: 'Save Summary', prompt: '' },
      ],
    },
  },
  {
    id: 'pr-changelog', icon: '🐙', name: 'PR → Changelog',
    desc: 'Generate a changelog entry from a PR description.',
    tag: 'Dev', tagColor: '#e2dff5',
    scaffold: {
      id: 'pr-changelog', icon: '🐙', name: 'PR Changelog',
      trigger: { type: 'manual-prompt', label: 'Manual + Prompt', config: {} },
      inputs: [
        { id: '__auto_prompt', type: 'textarea', label: 'PR Title & Description', required: true, ph: 'Paste PR title and description...' },
      ],
      steps: [
        { id: 's1', typeId: 'llm', label: 'Generate Entry', prompt: 'Generate a changelog entry for this PR.\nFormat: - [type]: brief user-facing description\nType: feat / fix / docs / refactor / perf\nMax 100 chars. Be clear.' },
        { id: 's2', typeId: 'save-file', label: 'Append to CHANGELOG.md', prompt: '' },
      ],
    },
  },
  {
    id: 'daily-briefing', icon: '📅', name: 'Daily Briefing',
    desc: 'Compile and send a personal morning news briefing.',
    tag: 'Scheduled', tagColor: '#6c5ff5',
    scaffold: {
      id: 'daily-briefing', icon: '📅', name: 'Daily Briefing',
      trigger: { type: 'schedule', label: 'Schedule', config: { label: 'Daily at 6:30 AM', cron: '30 6 * * *' } },
      inputs: [],
      steps: [
        { id: 's1', typeId: 'web-fetch', label: 'Fetch News', prompt: 'https://news.ycombinator.com' },
        { id: 's2', typeId: 'llm', label: 'Write Briefing', prompt: 'Create a concise morning briefing:\n- 3-5 headlines with 1-sentence summaries\n- One motivating thought\nKeep it brief and energizing.' },
        { id: 's3', typeId: 'send-email', label: 'Send Briefing', prompt: '' },
      ],
    },
  },
]

// ── AI Sidebar rules ──────────────────────────────────────────────────────────

interface AiRule {
  patterns: RegExp[]
  description: string
  apply: (def: AutomationDef) => AutomationDef
}

const AI_RULES: AiRule[] = [
  {
    patterns: [/schedule/i, /daily/i, /every day/i, /cron/i, /timed/i, /morning/i],
    description: '✓ Changed trigger to Schedule (Daily 7:00 AM)',
    apply: (def) => ({ ...def, trigger: { type: 'schedule', label: 'Schedule', config: { label: 'Daily at 7:00 AM', cron: '0 7 * * *' } }, inputs: def.inputs.filter(i => !i.id.startsWith('__auto')) }),
  },
  {
    patterns: [/file upload/i, /upload file/i, /attach/i, /file input/i, /upload/i],
    description: '✓ Changed trigger to Manual + File Upload',
    apply: (def) => ({ ...def, trigger: { type: 'manual-file', label: 'Manual + File Upload', config: {} }, inputs: [{ id: '__auto_file', type: 'file', label: 'File Upload', required: true }, ...def.inputs.filter(i => i.id !== '__auto_file')] }),
  },
  {
    patterns: [/add prompt/i, /prompt input/i, /ask.*prompt/i],
    description: '✓ Added prompt input field',
    apply: (def) => ({ ...def, inputs: def.inputs.some(i => i.id === '__auto_prompt') ? def.inputs : [{ id: '__auto_prompt', type: 'textarea', label: 'Prompt', required: false, ph: 'Enter your prompt...' }, ...def.inputs] }),
  },
  {
    patterns: [/add summariz/i, /insert summariz/i, /summariz/i],
    description: '✓ Added AI Summarizer step',
    apply: (def) => ({ ...def, steps: [...def.steps, { id: 's' + Date.now(), typeId: 'llm', label: 'Summarizer', prompt: 'Summarize the following content clearly and concisely:' }] }),
  },
  {
    patterns: [/send.*email/i, /email.*result/i, /add email/i, /email output/i],
    description: '✓ Added Send Email step',
    apply: (def) => ({ ...def, steps: [...def.steps, { id: 's' + Date.now(), typeId: 'send-email', label: 'Send Email', prompt: '' }] }),
  },
  {
    patterns: [/translate/i, /add.*translat/i],
    description: '✓ Added Translator step',
    apply: (def) => ({ ...def, steps: [...def.steps, { id: 's' + Date.now(), typeId: 'translator', label: 'Translate', prompt: '' }] }),
  },
  {
    patterns: [/ocr/i, /parse.*doc/i, /extract.*text/i, /read.*pdf/i],
    description: '✓ Added Document Parser step',
    apply: (def) => ({ ...def, steps: [...def.steps, { id: 's' + Date.now(), typeId: 'docformer', label: 'Parse Document', prompt: '' }] }),
  },
  {
    patterns: [/web.*fetch/i, /fetch.*url/i, /scrape/i, /fetch.*web/i],
    description: '✓ Added Web Fetch step',
    apply: (def) => ({ ...def, steps: [...def.steps, { id: 's' + Date.now(), typeId: 'web-fetch', label: 'Web Fetch', prompt: '' }] }),
  },
  {
    patterns: [/save.*file/i, /write.*file/i, /output.*file/i],
    description: '✓ Added Save to File step',
    apply: (def) => ({ ...def, steps: [...def.steps, { id: 's' + Date.now(), typeId: 'save-file', label: 'Save to File', prompt: '' }] }),
  },
  {
    patterns: [/^manual$/i, /run.*manually/i, /no.*trigger/i, /no.*schedule/i],
    description: '✓ Changed trigger to Manual',
    apply: (def) => ({ ...def, trigger: { type: 'manual', label: 'Manual', config: {} }, inputs: def.inputs.filter(i => !i.id.startsWith('__auto')) }),
  },
  {
    patterns: [/file.*watch/i, /watch.*folder/i, /monitor.*folder/i],
    description: '✓ Changed trigger to File Watch',
    apply: (def) => ({ ...def, trigger: { type: 'file-watch', label: 'File Watch', config: { path: '~/Desktop/inbox', ext: '.*' } }, inputs: def.inputs.filter(i => !i.id.startsWith('__auto')) }),
  },
  { patterns: [/slack/i],  description: '⚠ Slack not connected — go to Connections tab', apply: (def) => def },
  { patterns: [/notion/i], description: '⚠ Notion not connected — go to Connections tab', apply: (def) => def },
]

// ── AI Sidebar ────────────────────────────────────────────────────────────────

function AISidebar({ def, onChange }: { def: AutomationDef; onChange: (d: AutomationDef) => void }) {
  const [input, setInput] = useState('')
  const [log, setLog] = useState<{ text: string; ok: boolean }[]>([{ text: 'AI Sidebar ready — describe changes in plain text.', ok: true }])
  const [thinking, setThinking] = useState(false)

  const runCmd = async () => {
    if (!input.trim() || thinking) return
    const cmd = input.trim()
    setInput('')
    const rule = AI_RULES.find(r => r.patterns.some(p => p.test(cmd)))
    if (rule) {
      onChange(rule.apply(def))
      setLog(l => [...l, { text: `> ${cmd}`, ok: true }, { text: rule.description, ok: true }])
      return
    }
    setThinking(true)
    setLog(l => [...l, { text: `> ${cmd}`, ok: true }])
    try {
      const resp = await apiChat({ messages: [{ role: 'system', content: `You are a workflow assistant. Workflow: "${def.name}", trigger: "${def.trigger.label}", steps: ${def.steps.length}. Answer questions or suggest modifications.` }, { role: 'user', content: cmd }] })
      setLog(l => [...l, { text: resp.content.slice(0, 220), ok: true }])
    } catch {
      setLog(l => [...l, { text: 'AI unavailable — try a keyword command', ok: false }])
    }
    setThinking(false)
  }

  return (
    <div style={{ width: 236, borderLeft: `1px solid ${T.b}`, display: 'flex', flexDirection: 'column', flexShrink: 0, background: T.s1 }}>
      <div style={{ padding: '10px 12px', borderBottom: `1px solid ${T.b}`, fontWeight: 700, fontSize: 12, color: T.ac, display: 'flex', alignItems: 'center', gap: 6 }}>✦ AI Sidebar</div>
      <div style={{ flex: 1, overflowY: 'auto', padding: 10, display: 'flex', flexDirection: 'column', gap: 5 }}>
        {log.map((l, i) => (
          <div key={i} style={{ fontSize: 11, color: l.ok ? T.tx : T.rd, lineHeight: 1.5, padding: '5px 8px', background: T.s2, borderRadius: 6, border: `1px solid ${T.b}` }}>{l.text}</div>
        ))}
        {thinking && <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 8px', background: T.s2, borderRadius: 6, border: `1px solid ${T.b}` }}><Spinner size={11} /><span style={{ fontSize: 11, color: T.mu }}>Thinking…</span></div>}
        <div style={{ fontSize: 10, color: T.mu2, marginTop: 6, lineHeight: 1.7 }}>
          Try:<br />• change trigger to schedule<br />• add summarizer step<br />• add email output<br />• add file upload input<br />• change to file watch
        </div>
      </div>
      <div style={{ padding: 10, borderTop: `1px solid ${T.b}` }}>
        <textarea rows={2} value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); runCmd() } }} placeholder="Type a command…" style={{ ...inputSx, fontSize: 12, marginBottom: 6 }} />
        <button onClick={runCmd} disabled={thinking || !input.trim()} style={{ width: '100%', padding: '6px 0', background: T.ac, border: 'none', borderRadius: 7, color: T.tx, cursor: 'pointer', fontSize: 12, fontWeight: 600, opacity: thinking || !input.trim() ? 0.4 : 1 }}>{thinking ? '…' : 'Run'}</button>
      </div>
    </div>
  )
}

// ── Step Card ─────────────────────────────────────────────────────────────────

function AutoStepCard({ step, idx, total, onChange, onRemove, onMoveUp, onMoveDown }: {
  step: AStep; idx: number; total: number
  onChange: (s: AStep) => void; onRemove: () => void; onMoveUp: () => void; onMoveDown: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const def = getStepDef(step.typeId)
  return (
    <>
      {idx > 0 && <div style={{ width: 2, height: 10, background: T.mu2, margin: '0 auto', opacity: 0.4 }} />}
      <div style={{ background: T.s2, border: `1px solid ${T.b}`, borderRadius: 10, overflow: 'hidden' }}>
        <div style={{ padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }} onClick={() => setExpanded(e => !e)}>
          <span style={{ fontSize: 16 }}>{def.icon}</span>
          <div style={{ flex: 1 }}><div style={{ fontWeight: 600, fontSize: 12 }}>{step.label}</div><div style={{ fontSize: 10, color: T.mu }}>{def.desc}</div></div>
          <div style={{ display: 'flex', gap: 3 }}>
            {idx > 0 && <button onClick={e => { e.stopPropagation(); onMoveUp() }} style={{ padding: '2px 5px', background: 'none', border: `1px solid ${T.b}`, borderRadius: 4, color: T.mu, cursor: 'pointer', fontSize: 10 }}>↑</button>}
            {idx < total - 1 && <button onClick={e => { e.stopPropagation(); onMoveDown() }} style={{ padding: '2px 5px', background: 'none', border: `1px solid ${T.b}`, borderRadius: 4, color: T.mu, cursor: 'pointer', fontSize: 10 }}>↓</button>}
          </div>
          <span style={{ color: T.mu2, fontSize: 11, display: 'inline-block', transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}>▾</span>
        </div>
        {expanded && (
          <div style={{ padding: '0 12px 12px', borderTop: `1px solid ${T.b}` }}>
            <Field label="Step Name"><input type="text" value={step.label} onChange={e => onChange({ ...step, label: e.target.value })} style={{ ...inputSx, fontSize: 12 }} /></Field>
            <Field label="Step Type">
              <select value={step.typeId} onChange={e => onChange({ ...step, typeId: e.target.value })} style={{ ...inputSx, fontSize: 12 }}>
                {STEP_DEFS.map(s => <option key={s.id} value={s.id}>{s.icon} {s.label}</option>)}
              </select>
            </Field>
            {step.typeId === 'llm' && <Field label="Prompt"><textarea rows={4} value={step.prompt} onChange={e => onChange({ ...step, prompt: e.target.value })} placeholder="Instructions for this AI step…" style={{ ...inputSx, fontSize: 12 }} /></Field>}
            {step.typeId === 'web-fetch' && <Field label="URLs (one per line)"><textarea rows={3} value={step.prompt} onChange={e => onChange({ ...step, prompt: e.target.value })} placeholder="https://..." style={{ ...inputSx, fontSize: 12 }} /></Field>}
            <button onClick={onRemove} style={{ marginTop: 8, padding: '4px 10px', background: T.rd + '20', border: `1px solid ${T.rd}44`, borderRadius: 5, color: T.rd, cursor: 'pointer', fontSize: 11 }}>Remove Step</button>
          </div>
        )}
      </div>
    </>
  )
}

// ── Automation Builder ────────────────────────────────────────────────────────

function AutomationBuilder({ def: initialDef, onBack }: { def: AutomationDef; onBack: () => void }) {
  const [def, setDef] = useState<AutomationDef>(initialDef)
  const [saved, setSaved] = useState(false)

  const addStep = () => setDef(d => ({ ...d, steps: [...d.steps, { id: 's' + Date.now(), typeId: 'llm', label: 'New AI Step', prompt: '' }] }))
  const updateStep = (idx: number, s: AStep) => setDef(d => ({ ...d, steps: d.steps.map((x, i) => i === idx ? s : x) }))
  const removeStep = (idx: number) => setDef(d => ({ ...d, steps: d.steps.filter((_, i) => i !== idx) }))
  const moveStep = (idx: number, dir: 1 | -1) => setDef(d => {
    const steps = [...d.steps]; const t = idx + dir
    if (t < 0 || t >= steps.length) return d
    ;[steps[idx], steps[t]] = [steps[t], steps[idx]]
    return { ...d, steps }
  })

  const handleTriggerTypeChange = (type: string) => {
    const opt = TRIGGER_OPTS.find(o => o.type === type)!
    let newInputs = def.inputs.filter(i => !i.id.startsWith('__auto'))
    if (type === 'manual-file') newInputs = [{ id: '__auto_file', type: 'file', label: 'File Upload', required: true }, ...newInputs]
    if (type === 'manual-prompt') newInputs = [{ id: '__auto_prompt', type: 'textarea', label: 'Prompt', required: false, ph: 'Enter your prompt...' }, ...newInputs]
    setDef(d => ({ ...d, trigger: { type, label: opt.label, config: {} }, inputs: newInputs }))
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ padding: '10px 16px', borderBottom: `1px solid ${T.b}`, background: T.s1, display: 'flex', gap: 10, alignItems: 'center', flexShrink: 0 }}>
        <button onClick={onBack} style={{ padding: '5px 10px', background: 'none', border: `1px solid ${T.b}`, borderRadius: 6, color: T.mu, cursor: 'pointer', fontSize: 12 }}>← Back</button>
        <span style={{ fontSize: 18 }}>{def.icon}</span>
        <input type="text" value={def.name} onChange={e => setDef(d => ({ ...d, name: e.target.value }))} style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 15, background: 'none', border: 'none', color: T.tx, outline: 'none', flex: 1, minWidth: 0 }} />
        <Btn onClick={() => { setSaved(true); setTimeout(() => setSaved(false), 2000) }} variant="ok" style={{ padding: '5px 14px', fontSize: 12 }}>{saved ? '✓ Saved' : 'Save'}</Btn>
        <Btn disabled style={{ padding: '5px 14px', fontSize: 12, opacity: 0.35, cursor: 'not-allowed' }}>▶ Run</Btn>
      </div>
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
          {/* Trigger */}
          <div style={{ background: T.s2, border: `2px solid ${T.gr}55`, borderRadius: 12, padding: '14px 16px', marginBottom: 4 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: T.gr, textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 10 }}>⚡ Trigger</div>
            <Field label="Trigger Type">
              <select value={def.trigger.type} onChange={e => handleTriggerTypeChange(e.target.value)} style={inputSx}>
                {TRIGGER_OPTS.map(o => <option key={o.type} value={o.type}>{o.label} — {o.desc}</option>)}
              </select>
            </Field>
            {def.trigger.type === 'schedule' && <Field label="Schedule Label"><input type="text" value={def.trigger.config.label ?? ''} onChange={e => setDef(d => ({ ...d, trigger: { ...d.trigger, config: { ...d.trigger.config, label: e.target.value } } }))} placeholder="e.g. Daily at 7:00 AM" style={inputSx} /></Field>}
            {def.trigger.type === 'file-watch' && <Field label="Watch Folder"><input type="text" value={def.trigger.config.path ?? ''} onChange={e => setDef(d => ({ ...d, trigger: { ...d.trigger, config: { ...d.trigger.config, path: e.target.value } } }))} placeholder="~/Desktop/inbox" style={inputSx} /></Field>}
          </div>
          {/* Inputs */}
          {def.inputs.length > 0 && (
            <>
              <div style={{ width: 2, height: 10, background: T.mu2, margin: '0 auto', opacity: 0.4 }} />
              <div style={{ background: T.s2, border: `1px solid ${T.bl}44`, borderRadius: 10, padding: '10px 14px', marginBottom: 4 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: T.bl, textTransform: 'uppercase', marginBottom: 8, letterSpacing: '.5px' }}>Inputs</div>
                {def.inputs.map(inp => (
                  <div key={inp.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 8px', background: T.s3, borderRadius: 6, marginBottom: 5 }}>
                    <span>{inp.type === 'file' ? '📎' : '📝'}</span>
                    <span style={{ flex: 1, fontSize: 12 }}>{inp.label}</span>
                    {inp.required ? <span style={{ fontSize: 9, color: T.rd }}>required</span> : <span style={{ fontSize: 9, color: T.mu }}>optional</span>}
                    <button onClick={() => setDef(d => ({ ...d, inputs: d.inputs.filter(i => i.id !== inp.id) }))} style={{ background: 'none', border: 'none', color: T.mu2, cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: 0 }}>×</button>
                  </div>
                ))}
              </div>
            </>
          )}
          {/* Steps */}
          <div style={{ width: 2, height: 10, background: T.mu2, margin: '0 auto', opacity: 0.4 }} />
          {def.steps.length === 0 && <div style={{ textAlign: 'center', padding: '24px 0', color: T.mu, fontSize: 12 }}>No steps yet — click + Add Step below.</div>}
          {def.steps.map((step, idx) => (
            <AutoStepCard key={step.id} step={step} idx={idx} total={def.steps.length} onChange={s => updateStep(idx, s)} onRemove={() => removeStep(idx)} onMoveUp={() => moveStep(idx, -1)} onMoveDown={() => moveStep(idx, 1)} />
          ))}
          <div style={{ width: 2, height: 10, background: T.mu2, margin: '4px auto', opacity: 0.3 }} />
          <button onClick={addStep} style={{ width: '100%', padding: 10, background: 'none', border: `2px dashed ${T.b2}`, borderRadius: 10, color: T.mu, cursor: 'pointer', fontSize: 12 }}>+ Add Step</button>
        </div>
        <AISidebar def={def} onChange={setDef} />
      </div>
    </div>
  )
}

// ── Template Card ─────────────────────────────────────────────────────────────

function TemplateCard({ tmpl, onOpen }: { tmpl: typeof TEMPLATES[0]; onOpen: () => void }) {
  return (
    <div style={{ background: T.s2, border: `1px solid ${T.b}`, borderRadius: 14, padding: 18, display: 'flex', flexDirection: 'column', gap: 10, transition: 'border-color .15s, transform .15s' }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = T.b2; e.currentTarget.style.transform = 'translateY(-1px)' }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = T.b; e.currentTarget.style.transform = 'none' }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <span style={{ fontSize: 28 }}>{tmpl.icon}</span>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ fontWeight: 600, fontSize: 14 }}>{tmpl.name}</span>
            <Tag color={tmpl.tagColor} style={{ fontSize: 9 }}>{tmpl.tag}</Tag>
          </div>
          <div style={{ fontSize: 12, color: T.mu, lineHeight: 1.5 }}>{tmpl.desc}</div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
        {tmpl.scaffold.steps.map(s => {
          const d = getStepDef(s.typeId)
          return <span key={s.id} style={{ padding: '2px 7px', background: T.s3, border: `1px solid ${T.b}`, borderRadius: 4, fontSize: 10, color: T.mu }}>{d.icon} {s.label}</span>
        })}
      </div>
      <button onClick={onOpen} style={{ padding: '8px 14px', background: T.ac, border: 'none', borderRadius: 8, color: T.tx, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>Open in Builder →</button>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

export function Automations() {
  const [openDef, setOpenDef] = useState<AutomationDef | null>(null)

  if (openDef) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <AutomationBuilder def={openDef} onBack={() => setOpenDef(null)} />
      </div>
    )
  }

  return (
    <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '20px 24px 14px', borderBottom: `1px solid ${T.b}`, flexShrink: 0 }}>
        <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 20, marginBottom: 4 }}>⚡ Automations</div>
        <div style={{ fontSize: 13, color: T.mu }}>Pick a template → open in builder → customize trigger + steps → use AI sidebar to modify in plain text.</div>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(320px,1fr))', gap: 14 }}>
          {TEMPLATES.map(t => <TemplateCard key={t.id} tmpl={t} onOpen={() => setOpenDef({ ...t.scaffold })} />)}
        </div>
      </div>
    </div>
  )
}
