import React from 'react' // UPDATED: Changed from StrictMode to React
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  // By removing the <StrictMode> tags, we prevent the double-render
  // behavior in development mode, which will stop the double API call.
  <App />
)
