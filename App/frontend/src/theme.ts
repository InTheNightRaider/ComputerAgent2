// Universe AI design tokens — mirrors the HTML prototype
export const T = {
  bg: '#06060e',
  s1: '#0c0c1a',
  s2: '#111128',
  s3: '#181834',
  s4: '#1e1e3a',
  b: 'rgba(108,95,245,.13)',
  b2: 'rgba(108,95,245,.26)',
  b3: 'rgba(255,255,255,.05)',
  tx: '#e2dff5',
  mu: '#6e6892',
  mu2: '#3e3760',
  ac: '#6c5ff5',
  ac2: '#4a43cc',
  gr: '#0fb878',
  or: '#e05a28',
  amb: '#c47a10',
  bl: '#2b84d9',
  pk: '#d95bb5',
  tl: '#12b89e',
  rd: '#e03030',
} as const

export type ThemeKey = keyof typeof T

export const inputSx: React.CSSProperties = {
  width: '100%',
  background: T.s3,
  border: `1px solid ${T.b2}`,
  borderRadius: 8,
  padding: '8px 11px',
  color: T.tx,
  fontFamily: "'Outfit', sans-serif",
  fontSize: 13,
}

export const globalCSS = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body, #root { height: 100%; overflow: hidden; }
  body {
    background: ${T.bg};
    color: ${T.tx};
    font-family: 'Outfit', sans-serif;
    font-size: 14px;
  }
  ::-webkit-scrollbar { width: 4px; height: 4px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: #2a2858; border-radius: 2px; }
  input, textarea, select, button {
    font-family: 'Outfit', sans-serif;
    font-size: 13px;
    color: ${T.tx};
  }
  input::placeholder, textarea::placeholder { color: ${T.mu2}; }
  textarea { resize: none; }
  select option { background: ${T.s2}; color: ${T.tx}; }
  button:hover { opacity: .82; }
  button:active { opacity: .65; }
  input:focus, textarea:focus, select:focus {
    outline: none;
    border-color: rgba(108,95,245,.6) !important;
    box-shadow: 0 0 0 3px rgba(108,95,245,.1);
  }
  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(7px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes pulse {
    0%, 100% { opacity: .2; transform: scale(.75); }
    50% { opacity: 1; transform: scale(1); }
  }
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes blink {
    0%, 100% { opacity: .15; transform: scale(.7); }
    50% { opacity: 1; transform: scale(1); }
  }
`
