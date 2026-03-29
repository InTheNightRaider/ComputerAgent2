import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { globalCSS } from './theme'
import { App } from './App'

// Inject global styles
const style = document.createElement('style')
style.textContent = globalCSS
document.head.appendChild(style)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
