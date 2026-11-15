import React, { useEffect, useRef, useState } from 'react'
import logoUrl from '../assets/logo.png'
import { T } from '../texts.js'

/**
 * PCL 风格自绘标题栏：左侧软件名，中间总搜索栏（命令启动，不搜文件），右侧最小化/关闭。
 * 拖动空白区域移动窗口；双击空白区域最大化/还原。
 */
export function TitleBar({ brandName, onRun }) {
  const [value, setValue] = useState('')
  const [open, setOpen] = useState(false)
  const wrapRef = useRef(null)

  const commands = [
    { id: 'editQuotes', label: T.command.editQuotes, hint: T.command.editQuotesHint },
    { id: 'editNames', label: T.command.editNames, hint: T.command.editNamesHint },
    { id: 'editFortunes', label: T.command.editFortunes, hint: T.command.editFortunesHint }
  ]
  const matched = value.trim().toLowerCase().includes('zcode') ? commands : []

  useEffect(() => {
    const onDocClick = (e) => { if (!wrapRef.current?.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  const run = (cmd) => {
    setOpen(false)
    setValue('')
    onRun(cmd.id)
  }

  return (
    <div
      className="titlebar"
      onDoubleClick={(e) => {
        if (e.target.closest('input,button')) return
        window.betterftp?.toggleMaximize?.()
      }}
    >
      <div className="tb-left">
        <img className="tb-logo" src={logoUrl} alt="" draggable={false} />
        <span className="tb-name">{brandName || 'BetterFTP'}</span>
      </div>

      <div className="tb-center">
        <div className="tb-search" ref={wrapRef}>
          <span className="tb-search-icon">⌘</span>
          <input
            value={value}
            onChange={(e) => { setValue(e.target.value); setOpen(true) }}
            onFocus={() => setOpen(true)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') { setOpen(false); setValue('') }
              if (e.key === 'Enter' && matched.length > 0) run(matched[0])
            }}
            placeholder={T.command.placeholder}
            spellCheck={false}
          />
          {open && matched.length > 0 && (
            <div className="command-menu">
              {matched.map((c) => (
                <button key={c.id} className="command-item" onClick={() => run(c)}>
                  <span className="cmd-label">{c.label}</span>
                  <span className="cmd-hint">{c.hint}</span>
                </button>
              ))}
            </div>
          )}
          {open && value.trim() !== '' && matched.length === 0 && (
            <div className="command-menu"><div className="command-empty">{T.command.noMatch}</div></div>
          )}
        </div>
      </div>

      <div className="tb-controls">
        <button className="tb-btn" title={T.titlebar.minimize} onClick={() => window.betterftp?.minimizeWindow?.()}>─</button>
        <button className="tb-btn close" title={T.titlebar.close} onClick={() => window.betterftp?.closeWindow?.()}>✕</button>
      </div>
    </div>
  )
}
