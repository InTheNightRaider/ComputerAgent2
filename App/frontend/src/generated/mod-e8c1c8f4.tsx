import { useState, useEffect } from 'react'

export default function NoteTakingPanel() {
  const [note, setNote] = useState('');
  const [savedNotes, setSavedNotes] = useState(['']);

  const handleNoteChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setNote(event.target.value);
  };

  const handleSaveNote = () => {
    setSavedNotes((prev) => [...prev, note]);
    setNote('');
  };

  return (
    <div style={{ flex: 1, overflow: 'auto', padding: 24, background: '#0d0d1a', color: '#e8e8f0' }}>
      <div style={{ borderRadius: 10, background: '#1a1a2e', border: '1px solid #1e1e2e', padding: 16, display: 'flex', flexDirection: 'column' }}>
        <input
          type="text"
          value={note}
          onChange={handleNoteChange}
          placeholder="Enter your note..."
          style={{ flex: 1, fontSize: 18, padding: 8 }}
        />
        <button
          onClick={handleSaveNote}
          style={{
            background: '#7c6ff7',
            border: 'none',
            borderRadius: 8,
            color: '#e8e8f0',
            cursor: 'pointer',
            padding: '8px 18px'
          }}
        >
          Save Note
        </button>
      </div>
      <ul style={{ listStyle: 'none', padding: 16, border: '1px solid #1e1e2e' }}>
        {savedNotes.map((note, index) => (
          <li key={index} style={{ borderBottom: '1px solid #1e1e2e', padding: 8 }}>
            {note}
          </li>
        ))}
      </ul>
    </div>
  );
}