import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { DEFAULT_PIPELINES, Pipeline, PipelineStep } from './data/pipelines'
import { INIT_SERVICES, Service } from './data/connections'

export interface Settings {
  ollamaUrl: string
  ollamaModel: string
  anthropicEnabled: boolean
  anthropicKey: string
  budget: number
  tone: string
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
  via?: string
}

export interface DynTab {
  id: string
  label: string
  closeable: boolean
  comp: string
  data?: Record<string, unknown>
}

export interface RunState {
  pipelineId: string
  stepId: string | null
  log: string[]
}

export interface AppState {
  // Navigation
  activeTab: string
  setActiveTab: (tab: string) => void
  dynTabs: DynTab[]
  addDynTab: (t: DynTab) => void
  closeDynTab: (id: string) => void

  // Settings
  settings: Settings
  setSettings: (s: Settings) => void

  // Chat
  messages: ChatMessage[]
  addMessage: (m: ChatMessage) => void
  clearMessages: () => void

  // Ollama status
  ollamaOk: boolean
  setOllamaOk: (ok: boolean) => void
  ollamaModels: string[]
  setOllamaModels: (models: string[]) => void

  // Onboarding
  onboarded: boolean
  setOnboarded: (v: boolean) => void

  // Pipelines
  pipelines: Pipeline[]
  setPipelines: (fn: (prev: Pipeline[]) => Pipeline[]) => void
  activePipelineId: string
  setActivePipelineId: (id: string) => void
  runState: RunState | null
  setRunState: (rs: RunState | null | ((prev: RunState | null) => RunState | null)) => void

  // Services / connections
  services: Service[]
  setServices: (fn: (prev: Service[]) => Service[]) => void

  // Sidecar URL
  sidecarUrl: string
  setSidecarUrl: (url: string) => void
}

const DEFAULT_SETTINGS: Settings = {
  ollamaUrl: 'http://localhost:11434',
  ollamaModel: 'mistral:7b-instruct',
  anthropicEnabled: false,
  anthropicKey: '',
  budget: 2,
  tone: 'professional',
}

const DEFAULT_MESSAGES: ChatMessage[] = [
  {
    role: 'assistant',
    content:
      '**Universe AI** — Ready\n\nI route to Ollama (local) first, then the backend as fallback.\n\nTry: *"What models do I have?"* or *"Build a summarizer tool"*',
  },
]

// Helpers used by pipeline runner
export function stepPatch(
  pipelines: Pipeline[],
  pid: string,
  sid: string,
  patch: Partial<PipelineStep>
): Pipeline[] {
  return pipelines.map(p =>
    p.id !== pid ? p : {
      ...p,
      steps: p.steps.map(s => s.id !== sid ? s : { ...s, ...patch }),
    }
  )
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      // Navigation
      activeTab: 'chat',
      setActiveTab: (activeTab) => set({ activeTab }),
      dynTabs: [],
      addDynTab: (t) => set(s => ({ dynTabs: [...s.dynTabs.filter(x => x.id !== t.id), t] })),
      closeDynTab: (id) => set(s => ({ dynTabs: s.dynTabs.filter(x => x.id !== id), activeTab: s.activeTab === id ? 'chat' : s.activeTab })),

      // Settings
      settings: DEFAULT_SETTINGS,
      setSettings: (settings) => set({ settings }),

      // Chat
      messages: DEFAULT_MESSAGES,
      addMessage: (m) => set(s => ({ messages: [...s.messages, m] })),
      clearMessages: () => set({ messages: DEFAULT_MESSAGES }),

      // Ollama
      ollamaOk: false,
      setOllamaOk: (ollamaOk) => set({ ollamaOk }),
      ollamaModels: [],
      setOllamaModels: (ollamaModels) => set({ ollamaModels }),

      // Onboarding
      onboarded: false,
      setOnboarded: (onboarded) => set({ onboarded }),

      // Pipelines
      pipelines: DEFAULT_PIPELINES,
      setPipelines: (fn) => set(s => ({ pipelines: fn(s.pipelines) })),
      activePipelineId: 'p1',
      setActivePipelineId: (activePipelineId) => set({ activePipelineId }),
      runState: null,
      setRunState: (rs) => set(s => ({
        runState: typeof rs === 'function' ? rs(s.runState) : rs,
      })),

      // Services
      services: INIT_SERVICES,
      setServices: (fn) => set(s => ({ services: fn(s.services) })),

      // Sidecar
      sidecarUrl: 'http://localhost:8765',
      setSidecarUrl: (sidecarUrl) => set({ sidecarUrl }),
    }),
    {
      name: 'universe-ai-store',
      partialize: (s) => ({
        settings: s.settings,
        messages: s.messages,
        onboarded: s.onboarded,
        activeTab: s.activeTab,
        pipelines: s.pipelines,
        services: s.services,
        activePipelineId: s.activePipelineId,
      }),
    }
  )
)
