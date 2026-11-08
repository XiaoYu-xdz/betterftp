import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import { ErrorBoundary } from './ErrorBoundary.jsx'
import { applyTextsOverride } from './texts.js'
import './styles.css'

// 启动前加载文案覆盖（data\文案覆盖.json），让"改文字不重新打包"成为可能
async function boot() {
  try {
    const { override } = await window.betterftp.textsOverride()
    if (override) applyTextsOverride(override)
  } catch { /* 覆盖不可用：用默认文案 */ }
  createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </React.StrictMode>
  )
}

boot()
