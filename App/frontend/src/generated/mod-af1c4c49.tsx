import { useState, useEffect } from 'react'

export default function PipelinesTab() {
  const [pipelines, setPipelines] = useState<any[]>([])
  const [selectedPipeline, setSelectedPipeline] = useState<any | null>(null)

  useEffect(() => {
    fetch('http://localhost:8765/pipelines')
      .then(response => response.json())
      .then(data => setPipelines(data))
  }, [])

  return (
    <div style={{ flex: 1, overflow: 'auto', padding: 24, background: '#0d0d1a', color: '#e8e8f0' }}>
      <h2 style={{ fontSize: 20, margin: '16px 0' }}>Pipelines</h2>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {pipelines.map((pipeline) => (
          <li key={pipeline.id} style={{ background: '#1a1a2e', border: '1px solid #1e1e2e', borderRadius: 10, padding: 16, display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 18, color: '#e8e8f0', flex: 1 }}>{pipeline.name}</span>
            <button
              onClick={() => setSelectedPipeline(pipeline)}
              style={{
                background: '#7c6ff7',
                border: 'none',
                borderRadius: 8,
                color: '#e8e8f0',
                cursor: 'pointer',
                padding: '8px 18px'
              }}
            >
              View
            </button>
          </li>
        ))}
      </ul>

      {selectedPipeline && (
        <div style={{ background: '#13131f', padding: 24, marginTop: 16 }}>
          <h3 style={{ fontSize: 20, margin: '8px 0' }}>{selectedPipeline.name}</h3>
          <p style={{ fontSize: 18, color: '#6b6b8a' }}>
            {selectedPipeline.description}
          </p>
        </div>
      )}
    </div>
  )
}