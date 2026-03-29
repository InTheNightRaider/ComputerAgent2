import React, { useState, useRef } from 'react'
import { T, inputSx } from '../theme'
import { Btn } from '../components/Btn'
import { Spinner } from '../components/Spinner'
import { Tag, Dot } from '../components/Tag'
import { DTBadge } from '../components/DTBadge'
import { Field } from '../components/Field'
import { Toggle } from '../components/Toggle'
import { useAppStore, stepPatch } from '../store'
import { apiChat } from '../api'
import { DT, getStepType, Pipeline, PipelineStep, StepField } from '../data/pipelines'
import { AIChatSidebar } from '../components/AIChatSidebar'
import { PipelineCanvas } from '../components/PipelineCanvas'

// ── Trigger presets ───────────────────────────────────────────────────────────

const TRIGGER_PRESETS = [
  { type: 'manual',             label: 'Manual',                 desc: 'Run from UI anytime',                  config: {} },
  { type: 'manual-prompt',      label: 'Manual + Prompt',        desc: 'Ask for a prompt before running',      config: {} },
  { type: 'manual-file',        label: 'Manual + File Upload',   desc: 'Ask for a file before running',        config: {} },
  { type: 'manual-prompt-file', label: 'Manual + Prompt + File', desc: 'Ask for both prompt and file',         config: {} },
  { type: 'manual-inputs',      label: 'Manual + Inputs',        desc: 'Existing manual with inputs',          config: {} },
  { type: 'schedule',           label: 'Schedule',               desc: 'Run on a time schedule',               config: { cron: '0 9 * * 1-5', label: 'Weekdays 9 AM' } },
  { type: 'file-watch',         label: 'File Watch',             desc: 'Watch a folder for new files',         config: { path: '~/Desktop/inbox', ext: '.*' } },
] as const

function applyTriggerPreset(pipelineInputs: import('../data/pipelines').PipelineInput[], type: string): import('../data/pipelines').PipelineInput[] {
  // Strip auto-managed inputs, keep user-added ones
  let inputs = pipelineInputs.filter(i => i.id !== '__auto_prompt' && i.id !== '__auto_file')
  const hasFile   = type === 'manual-file' || type === 'manual-prompt-file'
  const hasPrompt = type === 'manual-prompt' || type === 'manual-prompt-file'
  if (hasFile)   inputs = [{ id: '__auto_file',   type: 'file',     label: 'File Upload', required: true,  ext: '.*' }, ...inputs]
  if (hasPrompt) inputs = [{ id: '__auto_prompt', type: 'textarea', label: 'Prompt',      required: false, ph: 'Enter your prompt…' }, ...inputs]
  return inputs
}

// ── Trigger Editor ────────────────────────────────────────────────────────────

function TriggerEditor({
  pipeline,
  onSave,
  onCancel,
}: {
  pipeline: import('../data/pipelines').Pipeline
  onSave: (triggerType: string, triggerLabel: string, triggerConfig: Record<string, string>, inputs: import('../data/pipelines').PipelineInput[]) => void
  onCancel: () => void
}) {
  const [type, setType]   = useState<string>(pipeline.trigger?.type ?? 'manual')
  const [sched, setSched] = useState(pipeline.trigger?.config?.label ?? 'Daily at 9:00 AM')
  const [path,  setPath]  = useState(pipeline.trigger?.config?.path  ?? '~/Desktop/inbox')
  const [ext,   setExt]   = useState(pipeline.trigger?.config?.ext   ?? '.*')

  const preset = TRIGGER_PRESETS.find(p => p.type === type) ?? TRIGGER_PRESETS[0]

  const commit = () => {
    const config: Record<string, string> =
      type === 'schedule'   ? { label: sched } :
      type === 'file-watch' ? { path, ext }     : {}
    const newInputs = applyTriggerPreset(pipeline.inputs ?? [], type)
    onSave(type, preset.label, config, newInputs)
  }

  return (
    <div style={{ padding: '14px 16px', background: T.s3, border: `1px solid ${T.b2}`, borderRadius: 10, marginTop: 8 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: T.mu, textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 12 }}>Edit Trigger</div>
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 11, color: T.mu, fontWeight: 600, marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.5px' }}>Trigger Type</div>
        <select value={type} onChange={e => setType(e.target.value)} style={inputSx}>
          {TRIGGER_PRESETS.map(p => <option key={p.type} value={p.type}>{p.label} — {p.desc}</option>)}
        </select>
      </div>
      {type === 'schedule' && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, color: T.mu, fontWeight: 600, marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.5px' }}>Schedule Label</div>
          <input type="text" value={sched} onChange={e => setSched(e.target.value)} placeholder="e.g. Daily at 7:00 AM" style={inputSx} />
        </div>
      )}
      {type === 'file-watch' && (
        <>
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11, color: T.mu, fontWeight: 600, marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.5px' }}>Watch Folder</div>
            <input type="text" value={path} onChange={e => setPath(e.target.value)} placeholder="~/Desktop/inbox" style={inputSx} />
          </div>
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11, color: T.mu, fontWeight: 600, marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.5px' }}>File Extensions</div>
            <input type="text" value={ext} onChange={e => setExt(e.target.value)} placeholder=".mp4 .mov or .* for all" style={inputSx} />
          </div>
        </>
      )}
      {(type === 'manual-prompt' || type === 'manual-prompt-file') && (
        <div style={{ padding: '7px 10px', background: T.bl + '15', border: `1px solid ${T.bl}33`, borderRadius: 7, fontSize: 11, color: T.bl, marginBottom: 12 }}>
          A prompt input will be auto-added to the Inputs block.
        </div>
      )}
      {(type === 'manual-file' || type === 'manual-prompt-file') && (
        <div style={{ padding: '7px 10px', background: T.bl + '15', border: `1px solid ${T.bl}33`, borderRadius: 7, fontSize: 11, color: T.bl, marginBottom: 12 }}>
          A file upload input will be auto-added to the Inputs block.
        </div>
      )}
      <div style={{ display: 'flex', gap: 8 }}>
        <Btn onClick={commit} variant="ok" style={{ padding: '5px 14px', fontSize: 12 }}>Apply</Btn>
        <button onClick={onCancel} style={{ padding: '5px 12px', background: 'none', border: `1px solid ${T.b}`, borderRadius: 7, color: T.mu, cursor: 'pointer', fontSize: 12 }}>Cancel</button>
      </div>
    </div>
  )
}

// ── Inputs Manager ────────────────────────────────────────────────────────────

function InputsManager({
  inputs,
  onChange,
  onClose,
}: {
  inputs: import('../data/pipelines').PipelineInput[]
  onChange: (inputs: import('../data/pipelines').PipelineInput[]) => void
  onClose: () => void
}) {
  const [adding, setAdding] = useState(false)
  const [newLabel, setNewLabel]   = useState('')
  const [newType,  setNewType]    = useState<'file' | 'textarea' | 'dropdown'>('textarea')
  const [newReq,   setNewReq]     = useState(false)

  const addInput = () => {
    if (!newLabel.trim()) return
    const id = 'i' + Date.now()
    onChange([...inputs, { id, type: newType, label: newLabel.trim(), required: newReq }])
    setNewLabel(''); setAdding(false)
  }

  const removeInput = (id: string) => onChange(inputs.filter(i => i.id !== id))

  const toggleRequired = (id: string) =>
    onChange(inputs.map(i => i.id === id ? { ...i, required: !i.required } : i))

  return (
    <div style={{ padding: '14px 16px', background: T.s3, border: `1px solid ${T.b2}`, borderRadius: 10, marginTop: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: T.mu, textTransform: 'uppercase', letterSpacing: '.5px' }}>Edit Inputs</div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: T.mu2, cursor: 'pointer', fontSize: 14 }}>×</button>
      </div>

      {inputs.length === 0 && <div style={{ fontSize: 12, color: T.mu2, marginBottom: 10, fontStyle: 'italic' }}>No inputs defined.</div>}

      {inputs.map(inp => (
        <div key={inp.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', background: T.s2, borderRadius: 7, marginBottom: 6, border: `1px solid ${T.b}` }}>
          <span>{inp.type === 'file' ? '📎' : inp.type === 'dropdown' ? '▾' : '📝'}</span>
          <span style={{ flex: 1, fontSize: 12 }}>{inp.label}</span>
          <button
            onClick={() => toggleRequired(inp.id)}
            style={{ padding: '2px 8px', background: inp.required ? T.rd + '20' : T.s3, border: `1px solid ${inp.required ? T.rd + '55' : T.b}`, borderRadius: 4, color: inp.required ? T.rd : T.mu, cursor: 'pointer', fontSize: 9 }}
          >
            {inp.required ? 'required' : 'optional'}
          </button>
          {!inp.id.startsWith('__auto') && (
            <button onClick={() => removeInput(inp.id)} style={{ background: 'none', border: 'none', color: T.mu2, cursor: 'pointer', fontSize: 14, padding: 0 }}>×</button>
          )}
          {inp.id.startsWith('__auto') && <span style={{ fontSize: 9, color: T.mu2 }}>auto</span>}
        </div>
      ))}

      {adding ? (
        <div style={{ padding: '10px', background: T.s2, borderRadius: 8, border: `1px solid ${T.b}`, marginTop: 6 }}>
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 10, color: T.mu, fontWeight: 600, marginBottom: 4, textTransform: 'uppercase' }}>Input Label</div>
            <input type="text" value={newLabel} onChange={e => setNewLabel(e.target.value)} placeholder="e.g. Upload File" style={inputSx} autoFocus />
          </div>
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 10, color: T.mu, fontWeight: 600, marginBottom: 4, textTransform: 'uppercase' }}>Type</div>
            <select value={newType} onChange={e => setNewType(e.target.value as 'file' | 'textarea' | 'dropdown')} style={inputSx}>
              <option value="textarea">Text / Prompt</option>
              <option value="file">File Upload</option>
              <option value="dropdown">Dropdown</option>
            </select>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, cursor: 'pointer', marginBottom: 10 }}>
            <input type="checkbox" checked={newReq} onChange={e => setNewReq(e.target.checked)} style={{ accentColor: T.ac }} />
            Required
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn onClick={addInput} variant="ok" style={{ padding: '4px 12px', fontSize: 11 }}>Add</Btn>
            <button onClick={() => setAdding(false)} style={{ padding: '4px 10px', background: 'none', border: `1px solid ${T.b}`, borderRadius: 6, color: T.mu, cursor: 'pointer', fontSize: 11 }}>Cancel</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setAdding(true)} style={{ width: '100%', padding: '7px 0', background: 'none', border: `1px dashed ${T.b2}`, borderRadius: 7, color: T.mu, cursor: 'pointer', fontSize: 12, marginTop: 4 }}>+ Add Input</button>
      )}
    </div>
  )
}

// ── Step config field renderer ────────────────────────────────────────────────

function StepConfigField({
  f, val, onChange,
}: {
  f: StepField
  val: unknown
  onChange: (v: unknown) => void
}) {
  if (f.t === 'select')
    return (
      <select
        value={(val as string) ?? f.def ?? f.o?.[0] ?? ''}
        onChange={e => onChange(e.target.value)}
        style={inputSx}
      >
        {f.o!.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    )

  if (f.t === 'textarea')
    return (
      <textarea
        rows={f.rows ?? 3}
        value={(val as string) ?? ''}
        onChange={e => onChange(e.target.value)}
        placeholder={f.ph ?? ''}
        style={inputSx}
      />
    )

  if (f.t === 'toggle')
    return <Toggle value={!!val} onChange={onChange} />

  if (f.t === 'slider') {
    const num = (val as number) ?? f.def ?? f.min ?? 0
    return (
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <input
          type="range"
          min={f.min} max={f.max} step={f.step}
          value={num}
          onChange={e => onChange(Number(e.target.value))}
          style={{ flex: 1, accentColor: T.ac }}
        />
        <span style={{ fontSize: 12, fontFamily: "'JetBrains Mono',monospace", color: T.ac, minWidth: 30 }}>
          {num}
        </span>
      </div>
    )
  }

  if (f.t === 'number')
    return (
      <input
        type="number"
        value={(val as number) ?? f.def ?? 0}
        onChange={e => onChange(Number(e.target.value))}
        style={inputSx}
      />
    )

  return (
    <input
      type="text"
      value={(val as string) ?? ''}
      onChange={e => onChange(e.target.value)}
      placeholder={f.ph ?? ''}
      style={inputSx}
    />
  )
}

// ── Run modal ─────────────────────────────────────────────────────────────────

function RunModal({
  pipeline,
  onClose,
  onRun,
}: {
  pipeline: Pipeline
  onClose: () => void
  onRun: (inputs: Record<string, string>) => void
}) {
  const [inputs, setInputs] = useState<Record<string, string>>({})

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(6,6,14,.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}
      onClick={onClose}
    >
      <div
        style={{ background: T.s2, border: `1px solid ${T.b2}`, borderRadius: 16, padding: 28, width: 460, animation: 'fadeUp .2s ease' }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 18, marginBottom: 4 }}>
          Before running — {pipeline.name}
        </div>
        <div style={{ fontSize: 13, color: T.mu, marginBottom: 20 }}>
          Provide inputs to start this pipeline.
        </div>

        {pipeline.inputs.map(inp => (
          <div key={inp.id} style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 5 }}>
              {inp.label}
              {inp.required && <span style={{ color: T.rd, marginLeft: 4 }}>*</span>}
            </div>
            {inp.type === 'file' ? (
              <div style={{ border: `2px dashed ${T.b2}`, borderRadius: 10, padding: 20, textAlign: 'center', cursor: 'pointer', background: T.s3 }}>
                <div style={{ fontSize: 24, marginBottom: 4 }}>📎</div>
                <div style={{ fontSize: 12, color: T.mu }}>Drop file or click to browse</div>
                {inp.ext && <div style={{ fontSize: 10, color: T.mu2, marginTop: 4 }}>{inp.ext}</div>}
              </div>
            ) : inp.type === 'dropdown' ? (
              <select
                value={inputs[inp.id] ?? inp.opts?.[0] ?? ''}
                onChange={e => setInputs(p => ({ ...p, [inp.id]: e.target.value }))}
                style={inputSx}
              >
                {inp.opts?.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            ) : (
              <textarea
                rows={3}
                value={inputs[inp.id] ?? ''}
                onChange={e => setInputs(p => ({ ...p, [inp.id]: e.target.value }))}
                placeholder={inp.ph ?? ''}
                style={inputSx}
              />
            )}
          </div>
        ))}

        <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
          <button
            onClick={onClose}
            style={{ flex: 1, padding: 10, background: T.s3, border: `1px solid ${T.b}`, borderRadius: 8, color: T.mu, cursor: 'pointer' }}
          >
            Cancel
          </button>
          <Btn onClick={() => { onClose(); onRun(inputs) }} style={{ flex: 2, padding: 10, fontSize: 14 }}>
            ▶ Start Pipeline
          </Btn>
        </div>
      </div>
    </div>
  )
}

// ── Step card ─────────────────────────────────────────────────────────────────

function StepCard({
  step,
  idx,
  pipelineId,
  isRunning,
  onInsertAfter,
}: {
  step: PipelineStep
  idx: number
  pipelineId: string
  isRunning: boolean
  onInsertAfter: (afterIdx: number) => void
}) {
  const { pipelines, setPipelines } = useAppStore()
  const st = getStepType(step.typeId)
  const isStepRunning = isRunning && step.state === 'running'
  const isDone = step.state === 'done'
  const isError = step.state === 'error'

  const updateConfig = (key: string, val: unknown) =>
    setPipelines(ps => stepPatch(ps, pipelineId, step.id, { config: { ...step.config, [key]: val } }))

  const toggleExpand = () =>
    setPipelines(ps => stepPatch(ps, pipelineId, step.id, { expanded: !step.expanded }))

  const removeStep = () =>
    setPipelines(ps => ps.map(p =>
      p.id !== pipelineId ? p : { ...p, steps: p.steps.filter(s => s.id !== step.id) }
    ))

  const borderColor = isError ? T.rd : isStepRunning ? T.amb : isDone ? T.gr + '55' : T.b

  return (
    <>
      {/* connector line */}
      <div style={{ width: 2, height: 14, background: isDone ? T.gr : DT[st.out as keyof typeof DT]?.c ?? T.mu, margin: '0 auto', opacity: .5, transition: 'background .5s' }} />

      <div style={{
        background: T.s2,
        border: `2px solid ${borderColor}`,
        borderRadius: 12,
        marginBottom: 2,
        transition: 'border-color .3s',
        boxShadow: isStepRunning ? `0 0 16px ${T.amb}44` : undefined,
      }}>
        {/* Card header */}
        <div
          style={{ padding: '12px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10 }}
          onClick={toggleExpand}
        >
          <div style={{ width: 32, height: 32, borderRadius: 8, background: (DT[st.out as keyof typeof DT]?.c ?? T.ac) + '20', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17 }}>
            {st.i}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
              <span style={{ fontWeight: 600, fontSize: 13 }}>{st.n}</span>
              <Tag color={T.mu} style={{ fontSize: 9 }}>{st.cat}</Tag>
              {isStepRunning && <Spinner size={14} />}
              {isDone && <span style={{ color: T.gr }}>✓</span>}
              {isError && <span style={{ color: T.rd }}>✗</span>}
            </div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <DTBadge type={st.inp} />
              <span style={{ color: T.mu, fontSize: 10 }}>→</span>
              <DTBadge type={st.out} />
              {typeof step.config.prompt === 'string' && step.config.prompt && (
                <span style={{ fontSize: 11, color: T.mu2, marginLeft: 4, fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 180 }}>
                  {step.config.prompt.slice(0, 60)}…
                </span>
              )}
            </div>
          </div>
          <span style={{ color: T.mu, fontSize: 12, transition: 'transform .2s', display: 'inline-block', transform: step.expanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>
            ▾
          </span>
        </div>

        {/* Expanded config */}
        {step.expanded && (
          <div style={{ padding: '0 16px 16px', borderTop: `1px solid ${T.b}` }}>
            <div style={{ paddingTop: 14 }}>
              {st.fields.map(f => (
                <Field key={f.k} label={f.l}>
                  <StepConfigField f={f} val={step.config[f.k]} onChange={v => updateConfig(f.k, v)} />
                </Field>
              ))}
              {st.fields.length === 0 && (
                <div style={{ fontSize: 12, color: T.mu2, fontStyle: 'italic' }}>No configuration required.</div>
              )}
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button
                  onClick={removeStep}
                  style={{ padding: '5px 12px', background: T.rd + '20', border: `1px solid ${T.rd}44`, borderRadius: 6, color: T.rd, cursor: 'pointer', fontSize: 11 }}
                >
                  Remove Step
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Insert step button */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '4px 0' }}>
        <div style={{ flex: 1, height: 1, background: T.b }} />
        <button
          onClick={() => onInsertAfter(idx)}
          style={{ padding: '2px 8px', background: T.s3, border: `1px solid ${T.b}`, borderRadius: 10, color: T.mu, cursor: 'pointer', fontSize: 11 }}
        >
          +
        </button>
        <div style={{ flex: 1, height: 1, background: T.b }} />
      </div>
    </>
  )
}

// ── Main Pipelines component ──────────────────────────────────────────────────

export function Pipelines() {
  const {
    pipelines, setPipelines,
    activePipelineId, setActivePipelineId,
    runState, setRunState,
    settings,
  } = useAppStore()

  const [runModalPipeline, setRunModalPipeline] = useState<Pipeline | null>(null)
  const [editTrigger, setEditTrigger] = useState(false)
  const [editInputs,  setEditInputs]  = useState(false)
  const [editingName, setEditingName] = useState(false)

  const ap = pipelines.find(p => p.id === activePipelineId) ?? pipelines[0] ?? null

  const insertStep = (afterIdx: number) => {
    const ns: PipelineStep = {
      id: 's' + Date.now(),
      typeId: 'llm',
      config: { model: 'mistral:7b-instruct', prompt: '', temperature: 0.7, maxTokens: 1000 },
      expanded: true,
      state: 'idle',
    }
    setPipelines(ps => ps.map(p =>
      p.id !== ap.id ? p : {
        ...p,
        steps: [...p.steps.slice(0, afterIdx + 1), ns, ...p.steps.slice(afterIdx + 1)],
      }
    ))
  }

  const addStep = () => {
    const ns: PipelineStep = {
      id: 's' + Date.now(),
      typeId: 'llm',
      config: { model: 'mistral:7b-instruct', prompt: '', temperature: 0.7, maxTokens: 1000 },
      expanded: true,
      state: 'idle',
    }
    setPipelines(ps => ps.map(p =>
      p.id !== ap.id ? p : { ...p, steps: [...p.steps, ns] }
    ))
  }

  const addPipeline = () => {
    const id = 'p' + Date.now()
    setPipelines(ps => [...ps, {
      id, icon: '⚙️', name: 'New Pipeline',
      trigger: { type: 'manual', label: 'Manual', config: {} },
      inputs: [], steps: [], lastRun: null, status: 'idle',
    }])
    setActivePipelineId(id)
  }

  const stopRun = () => {
    // Abort the active fetch if present
    try { runControllerRef.current?.abort?.() } catch (e) { /* ignore */ }
    setRunState(null)
    setPipelines(ps => ps.map(p => p.id!==ap.id?p:{...p,status:'idle',steps:p.steps.map(s=>({...s,state:'idle'}))}))
  }

  // Keep the active run's controller so Stop can abort
  const runControllerRef = React.useRef<AbortController | null>(null)

  const runPipeline = async (pipeline: Pipeline, userInputs: Record<string, string> = {}) => {
    const pid = pipeline.id
    const controller = new AbortController()
    runControllerRef.current = controller
    setRunState({ pipelineId: pid, stepId: null, log: [] })
    setPipelines(ps => ps.map(p => p.id !== pid ? p : { ...p, status: 'running' }))

    try {
      const r = await fetch(`http://localhost:8765/api/pipelines/${pid}/run`, { method: 'POST', signal: controller.signal })
      if (!r.ok) throw new Error('Run failed: ' + r.status)
      const reader = r.body!.getReader()
      const dec = new TextDecoder()
      let buf = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buf += dec.decode(value, { stream: true })
        const parts = buf.split('\n\n')
        buf = parts.pop() || ''
        for (const part of parts) {
          if (!part.startsWith('data:')) continue
          try {
            const json = JSON.parse(part.replace(/^data:\s*/, ''))
            if (json.type === 'log') {
              setRunState(prev => prev ? { ...prev, log: [...prev.log, json.msg] } : prev)
            } else if (json.type === 'step_start') {
              setRunState(prev => prev ? { ...prev, stepId: json.stepId } : prev)
              setPipelines(ps => ps.map(p => p.id !== pid ? p : { ...p, steps: p.steps.map(s => s.id === json.stepId ? { ...s, state: 'running' } : s) }))
            } else if (json.type === 'step_done') {
              setPipelines(ps => ps.map(p => p.id !== pid ? p : { ...p, steps: p.steps.map(s => s.id === json.stepId ? { ...s, state: 'done' } : s) }))
            } else if (json.type === 'step_error') {
              setPipelines(ps => ps.map(p => p.id !== pid ? p : { ...p, steps: p.steps.map(s => s.id === json.stepId ? { ...s, state: 'error' } : s) }))
            } else if (json.type === 'done') {
              setPipelines(ps => ps.map(p => p.id !== pid ? p : { ...p, lastRun: new Date().toLocaleTimeString(), status: 'idle', steps: p.steps.map(s => ({ ...s, state: 'idle' })) }))
            }
          } catch (e) {
            /* ignore */
          }
        }
      }
    } catch (e) {
      // If aborted, annotate log
      if ((e as any)?.name === 'AbortError') {
        setRunState(prev => prev ? { ...prev, log: [...prev.log, 'Run aborted'] } : prev)
      }
      setRunState(null)
      setPipelines(ps => ps.map(p => p.id !== pid ? p : { ...p, status: 'idle', steps: p.steps.map(s => ({ ...s, state: 'idle' })) }))
    } finally {
      runControllerRef.current = null
    }
     setTimeout(() => setRunState(null), 2000)
  }

  const handleRun = (pipeline: Pipeline) => {
    if (pipeline.inputs?.length>0){setRunModalPipeline(pipeline)}
    else runPipeline(pipeline)
  }

  // Guard: nothing to render if pipelines list is empty or entirely corrupt
  if (!ap) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12, color: T.mu }}>
        <div style={{ fontSize: 40 }}>🔄</div>
        <div style={{ fontWeight: 600, fontSize: 15, color: T.tx }}>No pipelines yet</div>
        <button
          onClick={addPipeline}
          style={{ padding: '8px 20px', background: T.ac, border: 'none', borderRadius: 8, color: T.tx, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
        >
          + Create Pipeline
        </button>
      </div>
    )
  }

  const isRunning = runState?.pipelineId === ap.id

  // Normalise potentially-missing fields on the active pipeline
  const apTrigger = ap.trigger ?? { type: 'manual', label: 'Manual', config: {} }
  const apInputs  = ap.inputs  ?? []
  const apSteps   = (ap.steps  ?? []).filter((s): s is NonNullable<typeof s> => s != null)

  return (
    <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

      {/* ── Left sidebar ── */}
      <div style={{ width: 224, borderRight: `1px solid ${T.b}`, display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        <div style={{ padding: '12px 14px', borderBottom: `1px solid ${T.b}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 700, fontSize: 13 }}>Pipelines</span>
          <button
            onClick={addPipeline}
            style={{ padding: '3px 8px', background: T.ac, border: 'none', borderRadius: 6, color: T.tx, cursor: 'pointer', fontSize: 11, fontWeight: 600 }}
          >
            + New
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 8 }}>
          {pipelines.map(pl => {
            const isActive = pl.id === activePipelineId
            const pRunning = runState?.pipelineId === pl.id
            return (
              <div
                key={pl.id}
                onClick={() => setActivePipelineId(pl.id)}
                style={{
                  padding: '10px 12px', borderRadius: 9, cursor: 'pointer', marginBottom: 6,
                  background: isActive ? T.ac + '18' : T.s2,
                  border: `1px solid ${isActive ? T.ac + '55' : T.b}`,
                  transition: 'all .15s',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                  <span style={{ fontSize: 16 }}>{pl.icon}</span>
                  <div style={{ flex: 1, fontWeight: 600, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {pl.name}
                  </div>
                  <Dot color={pRunning ? T.amb : pl.status === 'error' ? T.rd : T.gr} pulse={pRunning} />
                </div>
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                  <Tag color={pl.trigger?.type === 'schedule' ? T.ac : pl.trigger?.type === 'file-watch' ? T.gr : T.mu} style={{ fontSize: 9 }}>
                    {pl.trigger?.label ?? 'Manual'}
                  </Tag>
                  <Tag color={T.bl} style={{ fontSize: 9 }}>{(pl.steps ?? []).length} steps</Tag>
                </div>
                {pl.lastRun && <div style={{ fontSize: 10, color: T.mu2, marginTop: 4 }}>Last: {pl.lastRun}</div>}
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Center builder ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Toolbar */}
        <div style={{ padding: '10px 16px', borderBottom: `1px solid ${T.b}`, background: T.s1, display: 'flex', gap: 10, alignItems: 'center', flexShrink: 0 }}>
          {editingName ? (
            <input
              autoFocus
              value={ap.name ?? ''}
              onChange={e => setPipelines(ps => ps.map(p => p.id !== ap.id ? p : { ...p, name: e.target.value }))}
              onBlur={() => setEditingName(false)}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === 'Escape') setEditingName(false) }}
              style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 15, background: 'none', border: `1px solid ${T.b2}`, borderRadius: 6, color: T.tx, outline: 'none', padding: '2px 8px' }}
            />
          ) : (
            <span
              onClick={() => setEditingName(true)}
              title="Click to rename"
              style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 15, cursor: 'text' }}
            >
              {ap.icon ?? '⚙️'} {ap.name ?? 'Pipeline'}
            </span>
          )}
          <div style={{ flex: 1 }} />
          {isRunning && (
            <>
              <div style={{ fontSize: 12, color: T.amb }}>Running…</div>
              <button
                onClick={stopRun}
                style={{ padding: '4px 10px', background: T.rd, border: 'none', borderRadius: 6, color: T.tx, cursor: 'pointer', fontSize: 11 }}
              >
                Stop
              </button>
            </>
          )}
          <Btn onClick={() => handleRun(ap)} variant="ok" style={{ padding: '6px 18px', fontSize: 13 }} disabled={isRunning}>
            {isRunning ? 'Running…' : '▶ Run'}
          </Btn>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
          <div style={{ height: '100%' }}>
            <PipelineCanvas pipelineId={ap.id} />
          </div>

          {/* Run log */}
          {isRunning && runState!.log.length > 0 && (
            <div style={{ marginTop: 16, background: T.s2, border: `1px solid ${T.b}`, borderRadius: 10, padding: 12 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: T.ac, marginBottom: 8, textTransform: 'uppercase' }}>Run Log</div>
              <div style={{ maxHeight: 150, overflowY: 'auto' }}>
                {runState!.log.map((l, i) => (
                  <div key={i} style={{
                    fontSize: 11, fontFamily: "'JetBrains Mono',monospace", marginBottom: 3,
                    color: l.startsWith('✓') ? T.gr : l.startsWith('✗') ? T.rd : l.startsWith('▶') ? T.amb : T.mu,
                  }}>
                    {l}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Right data flow panel ── */}
      <div style={{ width: 212, borderLeft: `1px solid ${T.b}`, display: 'flex', flexDirection: 'column', flexShrink: 0, padding: '12px 10px', overflowY: 'auto' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: T.mu, textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 12 }}>
          Data Flow
        </div>

        {/* Trigger node */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, padding: '6px 8px', background: T.gr + '15', border: `1px solid ${T.gr}33`, borderRadius: 7 }}>
          <span>⚡</span>
          <div style={{ flex: 1, fontSize: 11, fontWeight: 600 }}>{apTrigger.label}</div>
          <Dot color={T.gr} />
        </div>

        {apSteps.map(step => {
          const st = getStepType(step.typeId ?? 'llm')
          const stepRunning = isRunning && step.state === 'running'
          const isDone = step.state === 'done'
          const d = DT[st.out as keyof typeof DT] ?? DT.TEXT
          const inp = DT[st.inp as keyof typeof DT] ?? DT.TEXT
          return (
            <div key={step.id}>
              <div style={{ width: 2, height: 16, background: isDone ? T.gr : d.c, margin: '0 auto', opacity: .5, transition: 'background .5s' }} />
              <div style={{
                padding: '7px 8px', background: T.s2,
                border: `1px solid ${stepRunning ? T.amb : isDone ? T.gr + '55' : T.b}`,
                borderRadius: 8, marginBottom: 2, transition: 'border-color .3s',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <span style={{ fontSize: 13 }}>{st.i}</span>
                  <div style={{ flex: 1, fontSize: 11, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{st.n}</div>
                  {stepRunning ? <Spinner size={12} /> : isDone ? <span style={{ color: T.gr, fontSize: 10 }}>✓</span> : <div style={{ width: 6, height: 6, borderRadius: '50%', background: T.mu2 }} />}
                </div>
                <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                  <span style={{ fontSize: 10, color: inp.c }}>{inp.i}</span>
                  <span style={{ fontSize: 9, color: T.mu2 }}>→</span>
                  <span style={{ fontSize: 10, color: d.c }}>{d.i} {d.l}</span>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Run modal */}
      {runModalPipeline && (
        <RunModal
          pipeline={runModalPipeline}
          onClose={() => setRunModalPipeline(null)}
          onRun={inputs => runPipeline(runModalPipeline, inputs)}
        />
      )}
    </div>
  )
}
