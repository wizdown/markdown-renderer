import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { ThemeProvider } from './ui/theme'
import './styles/theme.css'
import './styles/doc.css'
import './styles/deck.css'
import './styles/app.css'

const container = document.getElementById('root')
if (container === null) throw new Error('Missing #root')

createRoot(container).render(
  <StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </StrictMode>,
)
