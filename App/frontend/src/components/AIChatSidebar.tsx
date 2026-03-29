import React, { useState, useEffect, useRef } from 'react'
import { T, inputSx } from '../theme'
import { useAppStore } from '../store'
import { apiChat } from '../api'

export function AIChatSidebar({ pipeline }: { pipeline: any }) {
  const { addMessage } = useAppStore()
  const [messages, setMessages] = useState<{ role: string; content: string }[]>([])
  const [input, setInput] = useState('')
  const [thinking, setThinking] = useState(false)
  const bottom = useRef<HTMLDivElement | null>(null)

  useEffect(() => { bottom.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, thinking])

  async function send() {
    if (!input.trim() || thinking) return
    const text = input.trim()
    const userMsg = { role: 'user', content: text }
    setMessages(m => [...m, userMsg])
    setInput('')
    setThinking(true)
    try {
      const sys = `You are the Universe AI Pipeline Builder assistant. The user is editing pipeline: ${pipeline?.name || 'unknown'}. When suggesting edits, respond with a JSON block wrapped in \`\`\`apply\n{...}\n\`\`\` when you want the frontend to apply a change. Supported actions: update_step, create_step, remove_step, update_pipeline.`
      const resp = await apiChat({ messages: [{ role: 'system', content: sys }, ...messages.slice(-8), userMsg] })
      const assistant = { role: 'assistant', content: resp.content }
      setMessages(m => [...m, assistant])
      // parse apply block
      const m = assistant.content.match(/```apply\n([\s\S]+?)```/)
      if (m) {
        try {
          const payload = JSON.parse(m[1])
          await applyPayload(payload)
          addMessage({ role: 'assistant', content: `Applied: ${JSON.stringify(payload).slice(0,200)}` })
        } catch (e) {
          addMessage({ role: 'assistant', content: `Error applying payload: ${(e as Error).message}` })
        }
      }
    } catch (e) {
      setMessages(m => [...m, { role: 'assistant', content: 'Error: ' + (e as Error).message }])
    }
    setThinking(false)
  }

  async function applyPayload(payload: any) {
    // Simple frontend-only apply logic using the global store
    const store = useAppStore.getState()
    if (payload.action === 'update_step') {
      const { pipelineId, stepId, patch } = payload
      store.setPipelines((ps: any[]) => ps.map(p => p.id !== pipelineId ? p : { ...p, steps: p.steps.map((s: any) => s.id !== stepId ? s : { ...s, ...patch }) }))
      return
    }
    if (payload.action === 'create_step') {
      const { pipelineId, step, afterIndex } = payload
      store.setPipelines((ps: any[]) => ps.map(p => p.id !== pipelineId ? p : { ...p, steps: [...p.steps.slice(0, (afterIndex ?? p.steps.length) + 1), step, ...p.steps.slice((afterIndex ?? p.steps.length) + 1)] }))
      return
    }
    if (payload.action === 'insert_step') {
      const { pipelineId, step, atIndex } = payload
      store.setPipelines((ps: any[]) => ps.map(p => p.id !== pipelineId ? p : { ...p, steps: [...p.steps.slice(0, atIndex), step, ...p.steps.slice(atIndex)] }))
      return
    }
    if (payload.action === 'update_pipeline') {
      const { pipelineId, patch } = payload
      store.setPipelines((ps: any[]) => ps.map(p => p.id !== pipelineId ? p : { ...p, ...patch }))
      return
    }
    if (payload.action === 'create_pipeline') {
      const { pipeline: newPipeline } = payload
      store.setPipelines((ps: any[]) => [newPipeline, ...ps])
      return
    }
    // unknown
    throw new Error('unknown action')
  }

  return (
    <div style={{ width: 320, flexShrink: 0, borderLeft: `1px solid ${T.b}`, background: T.s1, display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '12px 14px', borderBottom: `1px solid ${T.b}`, display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ fontWeight: 700 }}>AI Builder</div>
        <div style={{ flex: 1 }} />
      </div>
      <div style={{ padding: 12, flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {messages.map((m, i) => (
          <div key={i} style={{ alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', background: m.role === 'user' ? T.ac2 : T.s2, padding: '8px 10px', borderRadius: 8, maxWidth: '88%', fontSize: 13 }}>
            {m.content}
          </div>
        ))}
        {thinking && <div style={{ padding: 8, background: T.s2, borderRadius: 8 }}>Thinking…</div>}
        <div ref={bottom} />
      </div>
      <div style={{ padding: 10, borderTop: `1px solid ${T.b}`, display: 'flex', gap: 8 }}>
        <textarea rows={2} style={{ ...inputSx, flex: 1 }} value={input} onChange={e => setInput(e.target.value)} placeholder={`Ask the AI to modify pipeline "${pipeline?.name || ''}"`} />
        <button onClick={send} style={{ padding: '8px 10px', background: T.ac, color: T.tx, border: 'none', borderRadius: 8 }}>Send</button>
      </div>
    </div>
  )
}
