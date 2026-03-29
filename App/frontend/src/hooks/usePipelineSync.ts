/**
 * Syncs the pipeline store with the backend on mount (load) and on change (save).
 * Call this once at the top level (App.tsx) — not inside Pipelines.tsx to avoid
 * multiple subscriptions.
 */
import { useEffect, useRef } from 'react'
import { useAppStore } from '../store'
import { apiGetPipelines, apiSavePipelines } from '../api'
import { DEFAULT_PIPELINES } from '../data/pipelines'

export function usePipelineSync() {
  const { pipelines, setPipelines } = useAppStore()
  const initialized = useRef(false)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Load from backend once on mount
  useEffect(() => {
    if (initialized.current) return
    initialized.current = true
    apiGetPipelines()
      .then(({ pipelines: saved }) => {
        if (saved && Array.isArray(saved) && saved.length > 0) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          setPipelines(() => saved as any[])
        }
        // If null, backend has no data yet — keep Zustand defaults (DEFAULT_PIPELINES)
      })
      .catch(() => { /* sidecar not running — use Zustand persisted state */ })
  }, [])

  // Debounced save whenever pipelines change (after init)
  useEffect(() => {
    if (!initialized.current) return
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      apiSavePipelines(pipelines).catch(() => {})
    }, 1500)
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current) }
  }, [pipelines])
}
