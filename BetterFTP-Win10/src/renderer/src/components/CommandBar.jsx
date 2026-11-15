import React, { useEffect, useRef, useState } from 'react'
import { T } from '../texts.js'

/**
 * 顶部总命令栏（类 VS Code 命令面板）。
 * 只用于启动命令，不搜索文件：输入 zcode 显示编辑命令。
 */
export function CommandBar({ onRun }) {
  const [value, setValue] = useState('')
  const [open, setOpen] = useState(false)
  const wrapRef = useRef(null)

  const commands = [
    { id: 'editQuotes', label: T.command.editQuotes, hint: T.command.editQuotesHint },
    { id: 'editNames', label: T.command.editNames, hint: T.command.editNamesHint }
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
    <div className="command-bar">
      <div className="command-wrap" ref={wrapRef}>
        <span className="command-icon">⌘</span>
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
  )
}
