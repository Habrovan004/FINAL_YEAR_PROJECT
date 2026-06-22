import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import './i18n' // Corrected comment style for i18n initialization

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
