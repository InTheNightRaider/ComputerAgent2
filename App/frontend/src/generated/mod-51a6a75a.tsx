import { useState, useEffect } from 'react'

export default function OllamaStatusCheck() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function fetchOllamaStatus() {
      setLoading(true);
      try {
        const response = await fetch('http://localhost:8765/ollama-status');
        const data = await response.json();
        setStatus(data.status);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    }

    fetchOllamaStatus();
  }, []);

  return (
    <div style={{ flex: 1, overflow: 'auto', padding: 24, background: '#0d0d1a', color: '#e8e8f0' }}>
      {loading ? (
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100%',
          borderRadius: 10,
          background: '#13131f',
          border: '1px solid #1e1e2e',
          padding: 16,
        }}>
          <div style={{ fontSize: 18, color: '#e8e8f0' }}>
            Checking Ollama status...
          </div>
        </div>
      ) : (
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            height: '100%',
            borderRadius: 10,
            background: '#1a1a2e',
            border: '1px solid #1e1e2e',
            padding: 16,
          }}
        >
          {status === 'online' ? (
            <div style={{ fontSize: 18, color: '#7c6ff7' }}>
              Ollama is online!
            </div>
          ) : status === 'offline' ? (
            <div style={{ fontSize: 18, color: '#f87171' }}>
              Ollama is offline.
            </div>
          ) : (
            <div style={{ fontSize: 18, color: '#6b6b8a' }}>
              Unknown status. Try again later!
            </div>
          )}
        </div>
      )}
    </div>
  );
}