import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles/global.css'

// Type augmentation for window.actionshell
declare global {
  interface Window {
    actionshell: import('../electron/preload/index').ActionShellAPI
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
