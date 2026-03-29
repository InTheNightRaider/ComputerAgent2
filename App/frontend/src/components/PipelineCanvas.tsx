import React, { useCallback, useMemo, useRef, useState } from 'react'
import ReactFlow, { ReactFlowProvider, Controls, Background, MiniMap, addEdge, Node, Edge } from 'reactflow'
import 'reactflow/dist/style.css'
import { getStepType } from '../data/pipelines'
import { useAppStore } from '../store'
import { Field } from '../components/Field'

function StepConfigModal({ step, onClose, onSave }: { step: any; onClose: () => void; onSave: (patch: any) => void }) {
  const [cfg, setCfg] = useState(step?.config || {})
  if (!step) return null
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(6,6,14,.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }} onClick={onClose}>
      <div style={{ background: '#0f0f24', padding: 18, borderRadius: 10, width: 520 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ fontWeight: 700 }}>{step.typeId} — Configure</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#aaa' }}>×</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {Object.keys(cfg).map(k => (
            <Field key={k} label={k}>
              <input value={String((cfg as any)[k] ?? '')} onChange={e => setCfg((s: any) => ({ ...s, [k]: e.target.value }))} style={{ width: '100%', padding: 8, borderRadius: 6, background: '#111' }} />
            </Field>
          ))}
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button onClick={() => { onSave(cfg); onClose() }} style={{ background: '#6c5ff5', color: '#fff', padding: 8, borderRadius: 8, border: 'none' }}>Save</button>
            <button onClick={onClose} style={{ background: 'none', color: '#aaa', padding: 8, borderRadius: 8, border: '1px solid #222' }}>Cancel</button>
          </div>
        </div>
      </div>
    </div>
  )
}

export function PipelineCanvas({ pipelineId }: { pipelineId: string }) {
  const { pipelines, setPipelines } = useAppStore()
  const pipeline = pipelines.find(p => p.id === pipelineId)
  const nodes: Node[] = pipeline ? pipeline.steps.map((s, i) => ({ id: s.id, data: { label: getStepType(s.typeId).n }, position: s.position ?? { x: 80, y: i * 120 } })) : []
  const edges: Edge[] = pipeline && pipeline.edges ? pipeline.edges : (pipeline ? pipeline.steps.slice(0, -1).map((s, i) => ({ id: `e-${s.id}-${pipeline.steps[i+1].id}`, source: s.id, target: pipeline.steps[i+1].id })) : [])

  // React Flow refs / instance
  const reactFlowWrapper = useRef<HTMLDivElement | null>(null)
  const [rfInstance, setRfInstance] = useState<any>(null)

  const onConnect = useCallback((params: any) => {
    const added = addEdge(params, edges)
    const newEdges: Edge[] = Array.isArray(added) ? added : [added]
    setPipelines(ps => ps.map(p => p.id !== pipelineId ? p : ({ ...p, edges: [...(p.edges||[]), ...newEdges] })))
  }, [edges, pipelineId, setPipelines])

  const onNodesChange = useCallback((changes: any[]) => {
    // Persist positions back to steps
    const posMap: Record<string, { x: number; y: number }> = {}
    for (const n of changes) {
      if (n.position) posMap[n.id] = n.position
    }
    setPipelines(ps => ps.map(p => p.id !== pipelineId ? p : ({ ...p, steps: p.steps.map(s => ({ ...s, position: posMap[s.id] ?? s.position })) })))
  }, [pipelineId, setPipelines])

  const onEdgesChange = useCallback((changes: any[]) => {
    // rebuild edges array and persist
    if (!pipeline || !rfInstance) return
    const current = rfInstance.getEdges()
    setPipelines(ps => ps.map(p => p.id !== pipelineId ? p : ({ ...p, edges: current })))
  }, [pipeline, pipelineId, rfInstance, setPipelines])

  const addNode = (typeId = 'llm') => {
    const nid = 's' + Date.now()
    const st = { id: nid, typeId, config: {}, expanded: true, state: 'idle' as const, position: { x: 120, y: 120 } }
    setPipelines(ps => ps.map(p => p.id !== pipelineId ? p : ({ ...p, steps: [...p.steps, st] })))
  }

  const removeNode = (id: string) => {
    setPipelines(ps => ps.map(p => p.id !== pipelineId ? p : ({ ...p, steps: p.steps.filter(s => s.id !== id), edges: (p.edges||[]).filter((e: any) => e.source !== id && e.target !== id) })))
  }

  const [editing, setEditing] = useState<any | null>(null)
  const onNodeClick = (evt: any, node: any) => {
    const step = pipeline?.steps.find((s: any) => s.id === node.id)
    setEditing(step || null)
  }

  const saveConfig = (patch: any) => {
    setPipelines(ps => ps.map(p => p.id !== pipelineId ? p : ({ ...p, steps: p.steps.map((s: any) => s.id !== editing.id ? s : { ...s, config: patch }) })))
  }

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    if (!reactFlowWrapper.current || !rfInstance) return
    const typeId = e.dataTransfer.getData('text/node-type') || 'llm'
    const bounds = reactFlowWrapper.current.getBoundingClientRect()
    const position = rfInstance.project({ x: e.clientX - bounds.left, y: e.clientY - bounds.top })
    const nid = 's' + Date.now()
    const st = { id: nid, typeId, config: {}, expanded: true, state: 'idle' as const, position }
    setPipelines(ps => ps.map(p => p.id !== pipelineId ? p : ({ ...p, steps: [...p.steps, st] })))
  }

  return (
    <div style={{ height: '100%', background: '#06060e', borderRadius: 12, padding: 12 }}>
      <ReactFlowProvider>
        <div ref={reactFlowWrapper} style={{ width: '100%', height: '100%' }} onDragOver={onDragOver} onDrop={onDrop}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onConnect={onConnect}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            fitView
            onNodeClick={onNodeClick}
            onInit={(instance) => setRfInstance(instance)}
          >
            <MiniMap />
            <Controls />
            <Background />
          </ReactFlow>
        </div>
        <div style={{ position: 'absolute', left: 14, top: 14, display: 'flex', gap: 8 }}>
          <button onClick={() => addNode('llm')} style={{ padding: 8, borderRadius: 8, background: '#6c5ff5', color: '#fff', border: 'none' }}>+ LLM</button>
          <button onClick={() => addNode('whisper')} style={{ padding: 8, borderRadius: 8, background: '#0fb878', color: '#fff', border: 'none' }}>+ Whisper</button>
        </div>
        <div style={{ position: 'absolute', right: 14, top: 14 }}>
          <div style={{ color: '#aaa', fontSize: 12, marginBottom: 6 }}>Drag from palette</div>
          <div draggable onDragStart={e => e.dataTransfer.setData('text/node-type', 'llm')} style={{ padding: 6, background: '#1a1a2e', borderRadius: 6, cursor: 'grab' }}>LLM</div>
        </div>
        {editing && <StepConfigModal step={editing} onClose={() => setEditing(null)} onSave={saveConfig} />}
       </ReactFlowProvider>
     </div>
   )
 }
