import React from 'react'
import logoUrl from '../assets/logo.png'
import { T } from '../texts.js'

/** 左侧账号列表（竖栏卡片 + 底部设置按钮） */
export function AccountSidebar({ accounts, connStates, activeId, onSelect, onAdd, onOpenSettings, onOpenAbout, onOpenToolbox, onOpenPromo, brandName, footerStyles }) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="logo"><img className="logo-img" src={logoUrl} alt="" draggable={false} /></div>
        <div>{brandName || T.side.title}{T.side.subtitle && <small>{T.side.subtitle}</small>}</div>
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
        <button className={`btn settings-btn ${footerStyles?.promo?.className || ''}`} style={footerStyles?.promo?.style} onClick={onOpenPromo}>{T.side.promo}</button>
        <button className={`btn settings-btn ${footerStyles?.toolbox?.className || ''}`} style={footerStyles?.toolbox?.style} onClick={onOpenToolbox}>{T.side.toolbox}</button>
        <button className={`btn settings-btn ${footerStyles?.about?.className || ''}`} style={footerStyles?.about?.style} onClick={onOpenAbout}>{T.side.about}</button>
        <button className={`btn settings-btn ${footerStyles?.settings?.className || ''}`} style={footerStyles?.settings?.style} onClick={onOpenSettings}>{T.side.settings}</button>
      </div>
    </aside>
  )
}
