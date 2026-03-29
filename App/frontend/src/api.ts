// All AI/secret-bearing calls go through the sidecar — no keys in the frontend.

let _sidecarUrl = 'http://localhost:8765'

export function setSidecarUrl(url: string) { _sidecarUrl = url }
export function getSidecarUrl()             { return _sidecarUrl }

async function req<T>(path: string, opts?: RequestInit): Promise<T> {
  const r = await fetch(_sidecarUrl + path, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  })
  if (!r.ok) {
    const err = await r.text().catch(() => r.statusText)
    throw new Error(`API ${r.status}: ${err}`)
  }
  return r.json() as Promise<T>
}

// ── Health ────────────────────────────────────────────────────────────────────

export interface HealthResp {
  status: string
  ollama: boolean
  models: string[]
  spend_today: number
}
export async function apiHealth(): Promise<HealthResp> {
  return req('/health')
}

// ── Chat ──────────────────────────────────────────────────────────────────────

export interface ChatReq {
  messages: { role: string; content: string }[]
  model?: string
  tone?: string
}
export interface ChatResp {
  content: string
  via: string
}
export async function apiChat(body: ChatReq): Promise<ChatResp> {
  return req('/api/chat', { method: 'POST', body: JSON.stringify(body) })
}

// ── Settings ──────────────────────────────────────────────────────────────────

export interface SettingsResp {
  ollama_url: string
  ollama_model: string
  anthropic_enabled: boolean
  anthropic_key_set: boolean
  budget: number
  tone: string
  spend_today: number
}
export async function apiGetSettings(): Promise<SettingsResp> {
  return req('/api/settings')
}
export async function apiSaveSettings(s: Record<string, unknown>): Promise<{ ok: boolean }> {
  return req('/api/settings', { method: 'PUT', body: JSON.stringify(s) })
}

// ── Anthropic test (key sent to backend, never back to browser) ───────────────

export async function apiTestAnthropic(key: string): Promise<{ ok: boolean; error?: string }> {
  return req('/api/anthropic/test', { method: 'POST', body: JSON.stringify({ key }) })
}

// ── Ollama ────────────────────────────────────────────────────────────────────

export async function apiOllamaModels(): Promise<{ models: string[] }> {
  return req('/api/ollama/models')
}
export async function apiOllamaPull(
  name: string,
  onProgress: (pct: number | string) => void,
): Promise<void> {
  const r = await fetch(_sidecarUrl + '/api/ollama/pull', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  })
  if (!r.ok) throw new Error('Pull failed: ' + r.status)
  const reader = r.body!.getReader()
  const dec = new TextDecoder()
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    for (const line of dec.decode(value).split('\n').filter(Boolean)) {
      try {
        const d = JSON.parse(line)
        if (d.total && d.completed) onProgress(Math.round((d.completed / d.total) * 100))
        else if (d.status) onProgress(d.status)
      } catch {}
    }
  }
}

// ── Pipelines ─────────────────────────────────────────────────────────────────

export async function apiGetPipelines(): Promise<{ pipelines: unknown[] | null }> {
  return req('/api/pipelines')
}
export async function apiSavePipelines(pipelines: unknown[]): Promise<{ ok: boolean }> {
  return req('/api/pipelines', { method: 'PUT', body: JSON.stringify({ pipelines }) })
}
export async function apiDeletePipeline(id: string): Promise<{ ok: boolean }> {
  return req(`/api/pipelines/${id}`, { method: 'DELETE' })
}

// ── Tools registry ────────────────────────────────────────────────────────────

export interface ToolRecord {
  id: string
  icon: string
  name: string
  desc: string
  cat: string
  status: string
  enabled: boolean
  component?: string   // generated component name (CP4)
}
export async function apiGetTools(): Promise<{ tools: ToolRecord[] }> {
  return req('/api/tools')
}
export async function apiUpdateTool(id: string, patch: Partial<ToolRecord>): Promise<{ ok: boolean }> {
  return req(`/api/tools/${id}`, { method: 'PUT', body: JSON.stringify(patch) })
}

// ── App modifications ─────────────────────────────────────────────────────────

export interface ModRecord {
  id: string
  prompt: string
  status: 'pending' | 'classifying' | 'generating_frontend' | 'generating_backend' | 'validating' | 'applying' | 'done' | 'failed' | 'undone'
  change_type: 'live' | 'restart_required' | 'build_required' | null
  created_at: string
  updated_at: string
  frontend_file: string | null
  backend_file: string | null
  error: string | null
}
export async function apiGetModifications(): Promise<{ modifications: ModRecord[] }> {
  return req('/api/app/modifications')
}
export async function apiGetModification(id: string): Promise<{ modification: ModRecord }> {
  return req(`/api/app/modifications/${id}`)
}
export async function apiRequestModification(prompt: string): Promise<{ modification: ModRecord }> {
  return req('/api/app/modify', { method: 'POST', body: JSON.stringify({ prompt }) })
}
export async function apiEnhanceTool(
  toolName: string,
  toolDesc: string,
  enhancement: string,
): Promise<{ modification: ModRecord }> {
  return req('/api/app/enhance-tool', {
    method: 'POST',
    body: JSON.stringify({ tool_name: toolName, tool_desc: toolDesc, enhancement }),
  })
}
export async function apiDeleteModification(id: string): Promise<{ ok: boolean }> {
  return req(`/api/app/modifications/${id}`, { method: 'DELETE' })
}
export async function apiUndoModification(): Promise<{ modification: ModRecord }> {
  return req('/api/app/modifications/undo', { method: 'POST' })
}
export async function apiGetModSource(id: string): Promise<{ frontend: string | null; backend: string | null }> {
  return req(`/api/app/modifications/${id}/source`)
}

// ── Dev / Polish Agent ────────────────────────────────────────────────────────

export interface HealthResult {
  name: string; path: string; method: string
  ok: boolean; status: number | null; error: string | null
}
export interface ReviewIssue  { severity: 'high' | 'medium' | 'low'; issue: string; fix: string }
export interface ReviewResult { component: string; issues: ReviewIssue[] }
export interface LogEntry     { time: string; msg: string }

export interface PolishState {
  running: boolean; continuous: boolean; cycle_count: number
  started_at: string | null
  phase: 'starting' | 'health_check' | 'reviewing' | 'queuing' | 'cooling' | 'done' | null
  current_component: string | null
  health_results: HealthResult[]
  review_results: ReviewResult[]
  improvements_queued: number; improvements_total: number
  log: LogEntry[]
  stop_requested: boolean
}

export async function apiDevHealth(): Promise<{ results: HealthResult[]; ok: number; total: number }> {
  return req('/api/dev/health')
}
export async function apiDevStartPolish(continuous?: boolean, cooldown_seconds?: number): Promise<{ ok: boolean; continuous: boolean }> {
  return req('/api/dev/polish', { method: 'POST', body: JSON.stringify({ continuous: continuous ?? false, cooldown_seconds: cooldown_seconds ?? 120 }) })
}
export async function apiDevStopPolish(): Promise<{ ok: boolean }> {
  return req('/api/dev/polish/stop', { method: 'POST' })
}
export async function apiDevPolishStatus(): Promise<PolishState> {
  return req('/api/dev/polish/status')
}

// ── Spend ─────────────────────────────────────────────────────────────────────

export async function apiGetSpend(): Promise<{ today: number; date: string }> {
  return req('/api/spend')
}

// ── Voice / Recordings ───────────────────────────────────────────────────────
export async function apiListRecordings(): Promise<{ recordings: any[] }> {
  return req('/api/voice/recordings')
}

export async function apiUploadRecording(file: File, filename?: string): Promise<{ ok: boolean; recording: any }> {
  const form = new FormData()
  form.append('file', file, filename || file.name)
  const r = await fetch(_sidecarUrl + '/api/voice/upload', { method: 'POST', body: form })
  if (!r.ok) throw new Error('Upload failed: ' + r.status)
  return r.json()
}

export function apiGetRecordingFileUrl(id: string) {
  return _sidecarUrl + '/api/voice/file/' + id
}

export async function apiDeleteRecording(id: string): Promise<{ ok: boolean }> {
  return req('/api/voice/' + id, { method: 'DELETE' })
}

export async function apiStreamTranscribe(recordingId: string, onEvent: (ev: any) => void): Promise<void> {
  const r = await fetch(_sidecarUrl + '/api/voice/transcribe_stream', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ recordingId }) })
  if (!r.ok) throw new Error('Transcribe failed: ' + r.status)
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
        onEvent(json)
      } catch (e) {
        // ignore
      }
    }
  }
}
