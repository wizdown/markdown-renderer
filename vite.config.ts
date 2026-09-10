import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Honour PORT so the dev server can be launched on an assigned port.
const port = Number(process.env.PORT)

export default defineConfig({
  plugins: [react()],
  build: { target: 'es2022' },
  server: Number.isInteger(port) && port > 0 ? { port, strictPort: true } : {},
})
