// ── Data Types ────────────────────────────────────────────────────────────────

export const DT = {
  VIDEO:      { c: '#e05a28', i: '🎬', l: 'Video' },
  AUDIO:      { c: '#0fb878', i: '🎵', l: 'Audio' },
  IMAGE:      { c: '#d95bb5', i: '🖼️',  l: 'Image' },
  TEXT:       { c: '#6c5ff5', i: '📝', l: 'Text' },
  TRANSCRIPT: { c: '#12b89e', i: '📋', l: 'Transcript' },
  DOCUMENT:   { c: '#c47a10', i: '📄', l: 'Document' },
  DATA:       { c: '#2b84d9', i: '📊', l: 'Data' },
  URL:        { c: '#7a7299', i: '🔗', l: 'URL' },
  DONE:       { c: '#0fb878', i: '✓',  l: 'Done' },
} as const

export type DTKey = keyof typeof DT

// ── Field types ────────────────────────────────────────────────────────────────

export interface StepField {
  k: string
  l: string
  t: 'select' | 'textarea' | 'toggle' | 'slider' | 'number' | 'text'
  o?: string[]
  rows?: number
  ph?: string
  min?: number
  max?: number
  step?: number
  def?: number | string
  collapsed?: boolean
}

// ── Step Types ────────────────────────────────────────────────────────────────

export interface StepTypeDef {
  id: string
  n: string
  i: string
  cat: string
  inp: DTKey
  out: DTKey
  multiInp?: DTKey[]
  fields: StepField[]
}

export const STEP_TYPES: StepTypeDef[] = [
  {
    id: 'extract-audio', n: 'Extract Audio', i: '🎵', cat: 'Media', inp: 'VIDEO', out: 'AUDIO',
    fields: [],
  },
  {
    id: 'whisper', n: 'Whisper Large V3', i: '🎙️', cat: 'Speech', inp: 'AUDIO', out: 'TRANSCRIPT',
    fields: [
      { k: 'language',     l: 'Language',          t: 'select', o: ['auto','en','es','fr','de','zh','ja','ko','pt','ru'] },
      { k: 'timestamps',   l: 'Timestamps',         t: 'select', o: ['word-level','sentence-level','none'] },
      { k: 'diarization',  l: 'Speaker Diarization',t: 'toggle' },
      { k: 'format',       l: 'Output Format',      t: 'select', o: ['transcript','plain text','SRT','VTT'] },
    ],
  },
  {
    id: 'llm', n: 'Mistral 7B', i: '🧠', cat: 'LLM', inp: 'TEXT', out: 'TEXT',
    fields: [
      { k: 'model',        l: 'Model',              t: 'select', o: ['mistral:7b-instruct','codellama:13b','llama3.2:3b','llama3:8b','nomic-embed-text'] },
      { k: 'prompt',       l: 'Prompt',             t: 'textarea', rows: 5, ph: 'Instructions for this AI step…' },
      { k: 'temperature',  l: 'Temperature',        t: 'slider', min: 0, max: 1, step: 0.1, def: 0.7 },
      { k: 'maxTokens',    l: 'Max Tokens',         t: 'number', def: 1000 },
      { k: 'systemPrompt', l: 'System Prompt Override', t: 'textarea', rows: 3, collapsed: true },
    ],
  },
  {
    id: 'legal-llm', n: 'Legal-GPT 7B', i: '⚖️', cat: 'LLM', inp: 'TEXT', out: 'TEXT',
    fields: [
      { k: 'prompt',       l: 'Prompt',             t: 'textarea', rows: 5, ph: 'Legal analysis instructions…' },
      { k: 'jurisdiction', l: 'Jurisdiction',       t: 'select', o: ['United States','United Kingdom','EU','Australia','Canada'] },
    ],
  },
  {
    id: 'docformer', n: 'DocFormer Parser', i: '📄', cat: 'Documents', inp: 'DOCUMENT', out: 'TEXT',
    fields: [
      { k: 'extract', l: 'Extract', t: 'select', o: ['text + tables + structure','text only','tables only'] },
    ],
  },
  {
    id: 'translator', n: 'M2M-100 Translator', i: '🌐', cat: 'Language', inp: 'TEXT', out: 'TEXT',
    fields: [
      { k: 'sourceLang', l: 'Source Language', t: 'select', o: ['auto-detect','en','es','fr','de','zh','ja','ar','pt','ru','ko','hi'] },
      { k: 'targetLang', l: 'Target Language', t: 'select', o: ['es','fr','de','zh','ja','ar','pt','ru','ko','hi','it','nl','pl','tr','vi'] },
      { k: 'preserve',   l: 'Preserve Formatting', t: 'toggle' },
    ],
  },
  {
    id: 'subtitle-burner', n: 'Subtitle Burner', i: '🔤', cat: 'Video', inp: 'VIDEO', out: 'VIDEO',
    multiInp: ['VIDEO', 'TRANSCRIPT'],
    fields: [
      { k: 'style',    l: 'Style Preset', t: 'select', o: ['Netflix Style','Clean White','Bold Black Outline','YouTube Auto','Minimal'] },
      { k: 'position', l: 'Position',     t: 'select', o: ['bottom','top','center'] },
      { k: 'sync',     l: 'Sync Mode',    t: 'select', o: ['word-level','sentence-level'] },
      { k: 'fontSize', l: 'Font Size',    t: 'slider', min: 16, max: 48, step: 2, def: 28 },
    ],
  },
  {
    id: 'web-fetch', n: 'Web Fetch', i: '🌐', cat: 'Data', inp: 'TEXT', out: 'TEXT',
    fields: [
      { k: 'urls',       l: 'URLs (one per line)', t: 'textarea', rows: 3 },
      { k: 'maxResults', l: 'Max Results',         t: 'number', def: 15 },
    ],
  },
  {
    id: 'save-file', n: 'Save to File', i: '💾', cat: 'Output', inp: 'TEXT', out: 'DONE',
    fields: [
      { k: 'path',     l: 'Output Directory',  t: 'text',   ph: '~/Documents/Output' },
      { k: 'filename', l: 'Filename Pattern',  t: 'text',   ph: '{{date}}_{{pipeline_name}}' },
      { k: 'format',   l: 'Format',            t: 'select', o: ['auto','.md','.txt','.pdf','.docx'] },
      { k: 'exists',   l: 'If File Exists',    t: 'select', o: ['rename','overwrite','skip'] },
    ],
  },
  {
    id: 'send-email', n: 'Send Email', i: '📧', cat: 'Output', inp: 'TEXT', out: 'DONE',
    fields: [
      { k: 'account', l: 'From Account', t: 'select', o: ['Gmail — Personal','Gmail — Work'] },
      { k: 'to',      l: 'To',           t: 'text',   ph: 'recipient@email.com' },
      { k: 'subject', l: 'Subject',      t: 'text',   ph: '{{pipeline_name}} — {{date}}' },
    ],
  },
  {
    id: 'csv-parser', n: 'CSV Parser', i: '📊', cat: 'Data', inp: 'DOCUMENT', out: 'DATA',
    fields: [],
  },
  {
    id: 'chart-gen', n: 'Chart Generator', i: '📈', cat: 'Data', inp: 'DATA', out: 'IMAGE',
    fields: [
      { k: 'type', l: 'Chart Type', t: 'select', o: ['bar','line','pie','scatter'] },
    ],
  },
]

export function getStepType(id: string): StepTypeDef {
  return STEP_TYPES.find(s => s.id === id) ?? STEP_TYPES[0]
}

// ── Pipeline data structures ──────────────────────────────────────────────────

export interface PipelineInput {
  id: string
  type: 'file' | 'textarea' | 'dropdown'
  label: string
  ext?: string
  required: boolean
  ph?: string
  opts?: string[]
}

export interface TriggerConfig {
  type: string   // manual | manual-prompt | manual-file | manual-prompt-file | manual-inputs | schedule | file-watch
  label: string
  config: Record<string, string>
}

export interface PipelineStep {
  id: string
  typeId: string
  config: Record<string, unknown>
  expanded: boolean
  state: 'idle' | 'running' | 'done' | 'error'
  position?: { x: number; y: number }
}

export interface PipelineEdge {
  id: string
  source: string
  target: string
}

export interface Pipeline {
  id: string
  icon: string
  name: string
  trigger: TriggerConfig
  inputs: PipelineInput[]
  steps: PipelineStep[]
  edges?: PipelineEdge[]
  lastRun: string | null
  status: 'idle' | 'running' | 'error'
}

// ── Default pipelines ─────────────────────────────────────────────────────────

export const DEFAULT_PIPELINES: Pipeline[] = [
  {
    id: 'p1', icon: '🎬', name: 'Video Auto-Caption',
    trigger: { type: 'file-watch', label: 'File Watch', config: { path: '~/Videos/inbox', ext: '.mp4 .mov .avi .mkv' } },
    inputs: [], lastRun: null, status: 'idle',
    steps: [
      { id: 's1', typeId: 'extract-audio', config: {}, expanded: false, state: 'idle' },
      { id: 's2', typeId: 'whisper', config: { language: 'auto', timestamps: 'word-level', diarization: true, format: 'transcript' }, expanded: false, state: 'idle' },
      { id: 's3', typeId: 'subtitle-burner', config: { style: 'Netflix Style', position: 'bottom', sync: 'word-level', fontSize: 28 }, expanded: false, state: 'idle' },
      { id: 's4', typeId: 'save-file', config: { path: '~/Videos/captioned', filename: '{{source_name}}_captioned', format: 'auto', exists: 'rename' }, expanded: false, state: 'idle' },
    ],
  },
  {
    id: 'p2', icon: '🎤', name: 'Meeting Intelligence',
    trigger: { type: 'manual-inputs', label: 'Manual + Inputs', config: {} },
    inputs: [
      { id: 'i1', type: 'file',     label: 'Meeting Recording', ext: '.mp3 .mp4 .m4a .wav', required: true },
      { id: 'i2', type: 'textarea', label: 'Meeting Context',   required: false, ph: 'e.g. Q3 planning with marketing' },
      { id: 'i3', type: 'dropdown', label: 'Output Format',     required: true,  opts: ['Full summary + action items','Executive brief only','Full transcript + summary'] },
    ],
    lastRun: null, status: 'idle',
    steps: [
      { id: 's1', typeId: 'whisper',   config: { language: 'auto', timestamps: 'sentence-level', diarization: true }, expanded: false, state: 'idle' },
      { id: 's2', typeId: 'llm',       config: { model: 'mistral:7b-instruct', prompt: 'Summarize this meeting transcript.\nExtract: 1) Key decisions made 2) Action items with owner names and deadlines 3) Open questions.\nFormat as clean structured markdown.', temperature: 0.3, maxTokens: 2000 }, expanded: false, state: 'idle' },
      { id: 's3', typeId: 'save-file', config: { path: '~/Documents/Meeting Notes', filename: '{{date}}_meeting', format: '.md', exists: 'rename' }, expanded: false, state: 'idle' },
      { id: 's4', typeId: 'send-email',config: { subject: 'Meeting Summary — {{date}}' }, expanded: false, state: 'idle' },
    ],
  },
  {
    id: 'p3', icon: '⚖️', name: 'Contract Review',
    trigger: { type: 'manual-inputs', label: 'Manual + Inputs', config: {} },
    inputs: [
      { id: 'i1', type: 'file',     label: 'Contract Document', ext: '.pdf .docx .doc', required: true },
      { id: 'i2', type: 'textarea', label: 'Review Focus',      required: false, ph: 'e.g. Focus on liability, payment terms, IP ownership' },
      { id: 'i3', type: 'dropdown', label: 'Jurisdiction',      required: false, opts: ['United States','United Kingdom','European Union','Australia','Canada','Other'] },
    ],
    lastRun: null, status: 'idle',
    steps: [
      { id: 's1', typeId: 'docformer',  config: { extract: 'text + tables + structure' }, expanded: false, state: 'idle' },
      { id: 's2', typeId: 'legal-llm',  config: { prompt: 'Review this contract thoroughly. Identify and rate each issue as HIGH/MED/LOW:\n1) Missing protective clauses\n2) Aggressive or one-sided language\n3) Liability exposure\n4) IP and ownership risks\n5) Payment and termination terms\n\nFormat each finding as:\n[SEVERITY] Section X.X — Issue description — Recommended fix' }, expanded: false, state: 'idle' },
      { id: 's3', typeId: 'llm',        config: { model: 'mistral:7b-instruct', prompt: 'Convert this contract review into an executive summary. Lead with the top 3 risks, then overall recommendation: SIGN / NEGOTIATE / REJECT', temperature: 0.2, maxTokens: 800 }, expanded: false, state: 'idle' },
      { id: 's4', typeId: 'save-file',  config: { path: '~/Documents/Legal/Reviews', filename: '{{date}}_contract_review', format: '.md', exists: 'rename' }, expanded: false, state: 'idle' },
    ],
  },
  {
    id: 'p4', icon: '📰', name: 'Daily Research Digest',
    trigger: { type: 'schedule', label: 'Schedule', config: { cron: '0 7 * * *', label: 'Daily at 7:00 AM' } },
    inputs: [], lastRun: null, status: 'idle',
    steps: [
      { id: 's1', typeId: 'web-fetch', config: { urls: 'https://arxiv.org/list/cs.AI/recent\nhttps://news.ycombinator.com', maxResults: 15 }, expanded: false, state: 'idle' },
      { id: 's2', typeId: 'llm',       config: { model: 'mistral:7b-instruct', prompt: "You are a research analyst. From this raw content, create a daily digest:\n## Top Papers (5 most significant)\nFor each: title, 2-sentence summary, why it matters\n## Tech News (5 most relevant)\nFor each: headline, 1-sentence summary\n## One Big Idea\nOne paragraph connecting today's themes.\nBe concise. No fluff.", temperature: 0.5, maxTokens: 2000 }, expanded: false, state: 'idle' },
      { id: 's3', typeId: 'save-file', config: { path: '~/Documents/Daily Digest', filename: 'digest_{{date}}', format: '.md', exists: 'rename' }, expanded: false, state: 'idle' },
      { id: 's4', typeId: 'send-email',config: { subject: '🧠 Research Digest — {{date}}' }, expanded: false, state: 'idle' },
    ],
  },
  {
    id: 'p5', icon: '🌐', name: 'Translate & Reformat',
    trigger: { type: 'manual-inputs', label: 'Manual + Inputs', config: {} },
    inputs: [
      { id: 'i1', type: 'file',     label: 'Document to Translate', ext: '.pdf .docx .txt .md', required: true },
      { id: 'i2', type: 'dropdown', label: 'Target Language',        required: true,  opts: ['Spanish','French','German','Chinese','Japanese','Arabic','Portuguese','Russian','Korean','Hindi','Italian','Dutch'] },
      { id: 'i3', type: 'dropdown', label: 'Output Format',          required: true,  opts: ['Same as input','Markdown','Plain text','PDF'] },
    ],
    lastRun: null, status: 'idle',
    steps: [
      { id: 's1', typeId: 'docformer',  config: { extract: 'text + tables + structure' }, expanded: false, state: 'idle' },
      { id: 's2', typeId: 'translator', config: { sourceLang: 'auto-detect', targetLang: 'es', preserve: true }, expanded: false, state: 'idle' },
      { id: 's3', typeId: 'llm',        config: { model: 'mistral:7b-instruct', prompt: 'Reformat this translated text cleanly. Preserve all headings, bullet points, and structure. Fix any translation artifacts or awkward phrasing. Output clean, natural text.', temperature: 0.3, maxTokens: 2000 }, expanded: false, state: 'idle' },
      { id: 's4', typeId: 'save-file',  config: { path: '~/Documents/Translated', filename: '{{source_name}}_translated', format: 'auto', exists: 'rename' }, expanded: false, state: 'idle' },
    ],
  },
]
