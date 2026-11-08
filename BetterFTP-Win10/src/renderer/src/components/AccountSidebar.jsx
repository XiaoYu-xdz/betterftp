import React from 'react'
import logoUrl from '../assets/logo.png'
import { T } from '../texts.js'

/** 左侧账号列表（竖栏卡片 + 底部设置按钮） */
export function AccountSidebar({ accounts, connStates, activeId, onSelect, onAdd, onOpenSettings, onOpenAbout }) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="logo"><img className="logo-img" src={logoUrl} alt="" draggable={false} /></div>
        <div>{T.side.title}{T.side.subtitle && <small>{T.side.subtitle}</small>}</div>
      </div>

      {accounts.map((a) => {
        const st = connStates[a.id] || { status: 'idle' }
        const dotCls = st.status === 'connected' ? 'ok' : st.status === 'connecting' ? 'connecting' : st.status === 'error' ? 'error' : ''
        return (
          <button
            key={a.id}
            className={`account-card${a.id === activeId ? ' active' : ''}`}
            onClick={() => onSelect(a)}
            title={`${a.displayName}${a.note ? ' · ' + a.note : ''}`}
          >
            <span className="bar" style={{ background: a.color }} />
            <div className="name">
              <span className={`status-dot ${dotCls}`} />
              <span className="txt">{a.displayName}</span>
            </div>
            {a.note && <div className="note">{a.note}</div>}
          </button>
        )
      })}

      {accounts.length === 0 && (
        <div className="side-empty-hint">{T.side.noAccountsHint}</div>
      )}

      <button className="add-account" onClick={onAdd}>{T.side.add}</button>

      <div className="sidebar-footer">
        <button className="btn settings-btn" onClick={onOpenAbout}>{T.side.about}</button>
        <button className="btn settings-btn" onClick={onOpenSettings}>{T.side.settings}</button>
      </div>
    </aside>
  )
}
