import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { StoreProvider } from './store.tsx'
import { ToastProvider } from './components/ui.tsx'
import Splash from './components/Splash.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StoreProvider>
      <ToastProvider>
        <App />
        <Splash />
      </ToastProvider>
    </StoreProvider>
  </StrictMode>,
)
