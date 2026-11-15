import React from 'react'
import { createRoot } from 'react-dom/client'

function AiPage() {
  return (
    <div style={{
      height: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 14,
      fontFamily: '"Segoe UI", "Microsoft YaHei UI", sans-serif',
      background: '#f0f0f0', color: '#1a1a1a'
    }}>
      <div style={{ fontSize: 44 }}>🤖</div>
      <div style={{ fontSize: 18, fontWeight: 700 }}>AI 助手</div>
      <div style={{ fontSize: 14, color: '#767676' }}>功能开发中，敬请期待…</div>
    </div>
  )
}

createRoot(document.getElementById('root')).render(<AiPage />)
