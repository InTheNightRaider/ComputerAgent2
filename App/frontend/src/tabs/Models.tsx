import React, { useEffect, useState } from 'react'
import { T, inputSx } from '../theme'
import { Btn } from '../components/Btn'

// using fetch directly to proxy through sidecar
export function Models() {
  const [q, setQ] = useState('')
  const [models, setModels] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState<any | null>(null)

  useEffect(() => { fetchModels('') }, [])

  async function fetchModels(query: string) {
    setLoading(true)
    try {
      const res = await fetch('/api/hf/models?q=' + encodeURIComponent(query))
      if (!res.ok) throw new Error('API '+res.status)
      const d = await res.json()
      setModels(d.models || [])
    } catch (e) {
      console.error(e)
    }
    setLoading(false)
  }

  return (
    <div style={{ padding: 20 }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <input style={inputSx} value={q} onChange={e => setQ(e.target.value)} placeholder="Search models…" />
        <Btn onClick={() => fetchModels(q)}>Search</Btn>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 12 }}>
        <div>
          {loading && <div>Loading…</div>}
          {!loading && models.map(m => (
            <div key={m.id} style={{ padding: 10, background: T.s2, border: `1px solid ${T.b}`, borderRadius: 8, marginBottom: 8, cursor: 'pointer' }} onClick={() => setSelected(m)}>
              <div style={{ fontWeight: 700 }}>{m.id}</div>
              <div style={{ fontSize: 12, color: T.mu }}>{m.tags || ''}</div>
            </div>
          ))}
        </div>
        <div>
          {selected ? (
            <div style={{ background: T.s2, border: `1px solid ${T.b}`, borderRadius: 8, padding: 12 }}>
              <div style={{ fontWeight: 800, marginBottom: 6 }}>{selected.id}</div>
              <div style={{ fontSize: 12, color: T.mu, marginBottom: 12 }}>{selected.tags}</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <Btn onClick={async () => {
                  // Add to pipeline: create a node config and open Pipelines tab (frontend-side implementation TBD)
                  alert('Add to pipeline: ' + selected.id)
                }}>Add to Pipeline</Btn>
                <Btn onClick={async () => {
                  // Try model via HF inference proxy
                  try {
                    const resp = await fetch('/api/hf/infer', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model: selected.id, input: { inputs: 'Hello world' } }) })
                    const data = await resp.json()
                    alert(JSON.stringify(data).slice(0, 600))
                  } catch (e: any) { alert('Error: ' + String(e?.message || e)) }
                }}>Try</Btn>
                <Btn onClick={async () => {
                  // Pull to Ollama (download locally)
                  const r = await fetch('/api/hf/pull-to-ollama', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: selected.id }) })
                  if (!r.ok) { alert('Pull failed: '+r.status); return }
                  const reader = r.body!.getReader(); const dec = new TextDecoder();
                  while (true) {
                    const { done, value } = await reader.read()
                    if (done) break
                    for (const line of dec.decode(value).split('\n').filter(Boolean)) {
                      console.log('pull:', line)
                    }
                  }
                  alert('Pull completed (check Ollama)')
                }}>Download to local</Btn>
              </div>
            </div>
          ) : (
            <div style={{ color: T.mu }}>Select a model to view details</div>
          )}
        </div>
      </div>
    </div>
  )
}
