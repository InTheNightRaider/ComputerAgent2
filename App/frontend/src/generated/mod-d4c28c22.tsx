import { useState, useEffect } from 'react'

export default function ClockPanel() {
  const [date, setDate] = useState(new Date());
  const [time, setTime] = useState(date.toLocaleTimeString());

  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setDate(now);
      setTime(now.toLocaleTimeString());
    };
    setInterval(updateClock, 1000);
  }, []);

  return (
    <div style={{ flex: 1, overflow: 'auto', padding: 24, background: '#13131f', color: '#e8e8f0' }}>
      <div style={{
        backgroundColor: '#1a1a2e',
        borderRadius: 10,
        border: '1px solid #1e1e2e',
        padding: 16,
        display: 'flex',
        justifyContent: 'center'
      }}>
        <span style={{ fontSize: 36, color: '#e8e8f0' }}>{time}</span>
      </div>
      <p style={{ marginTop: 24, fontSize: 18, color: '#6b6b8a' }}>{date.toLocaleDateString()}</p>
    </div>
  );
}