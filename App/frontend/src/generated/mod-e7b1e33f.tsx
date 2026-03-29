import { useState, useEffect } from 'react'

export default function WordCounter() {
  const [text, setText] = useState('')
  const [charCount, setCharCount] = useState(0)
  const [wordCount, setWordCount] = useState(0)

  useEffect(() => {
    setCharCount(text.length)
    setWordCount(text.split(/\s+/).length)
  }, [text])

  return (
    <div style={{ flex: 1, overflow: 'auto', padding: 24, background: '#13131f', color: '#e8e8f0' }}>
      <input
        type="text"
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder="Type something..."
        style={{
          width: '100%',
          height: 32,
          padding: 12,
          borderRadius: 4,
          border: `1px solid #1e1e2e`,
          background: '#0d0d1a',
          color: '#e8e8f0'
        }}
      />
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 16, marginRight: 24 }}>Characters: {charCount}</span>
        <span style={{ fontSize: 16, marginLeft: 24 }}>Words: {wordCount}</span>
      </div>
    </div>
  )
}