import React, { useEffect, useRef, useState } from 'react'
import { T } from '../texts.js'

/** 基础弹窗骨架 */
export function Modal({ title, icon, children, footer, wide, onClose }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose?.() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="modal-mask" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.() }}>
      <div className={`modal${wide ? ' wide' : ''}`}>
        <div className="modal-head">{icon && <span>{icon}</span>}{title}</div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  )
}

/** 通用确认框：confirm({title, message|messageHtml, warn, danger, okText}) → Promise<boolean> */
export function ConfirmDialog({ spec, onResult }) {
  if (!spec) return null
  return (
    <Modal
      title={spec.title || T.dialog.confirm}
      icon={spec.danger ? '⚠️' : '❓'}
      onClose={() => onResult(false)}
      footer={
        <>
          <button className="btn" onClick={() => onResult(false)}>{T.dialog.cancel}</button>
          <button
            className={`btn ${spec.danger ? 'danger' : 'primary'}`}
            autoFocus
            onClick={() => onResult(true)}
          >{spec.okText || T.dialog.ok}</button>
        </>
      }
    >
      {spec.messageHtml
        ? <div className="msg" dangerouslySetInnerHTML={spec.messageHtml} />
        : <div className="msg">{spec.message}</div>}
      {spec.warn && <div className="warn-text">{spec.warn}</div>}
    </Modal>
  )
}

/** 输入框弹窗：prompt({title, label, initial, okText, placeholder, validate}) → Promise<string|null> */
export function PromptDialog({ spec, onResult }) {
  const [value, setValue] = useState(spec?.initial || '')
  const [err, setErr] = useState('')
  const inputRef = useRef(null)
  useEffect(() => { inputRef.current?.focus(); inputRef.current?.select() }, [])
  if (!spec) return null

  const submit = () => {
    const v = value.trim()
    if (!v) { setErr(T.dialog.promptEmpty); return }
    if (/[\\/:*?"<>|]/.test(v)) { setErr(T.dialog.promptBadChars); return }
    if (spec.validate) {
      const e = spec.validate(v)
      if (e) { setErr(e); return }
    }
    onResult(v)
  }

  return (
    <Modal
      title={spec.title}
      icon={spec.icon || '✏️'}
      onClose={() => onResult(null)}
      footer={
        <>
          <button className="btn" onClick={() => onResult(null)}>{T.dialog.cancel}</button>
          <button className="btn primary" onClick={submit}>{spec.okText || T.dialog.ok}</button>
        </>
      }
    >
      {spec.label && <div className="msg" style={{ marginBottom: 10 }}>{spec.label}</div>}
      <input
        ref={inputRef}
        className="input"
        value={value}
        placeholder={spec.placeholder}
        onChange={(e) => { setValue(e.target.value); setErr('') }}
        onKeyDown={(e) => { if (e.key === 'Enter') submit() }}
      />
      {err && <div className="err-text">{err}</div>}
    </Modal>
  )
}

/**
 * 冲突三选一（跳过/覆盖/重命名）：
 * conflict({title, name, detail, oldDesc}) → Promise<'skip'|'overwrite'|'rename'|null>
 */
export function ConflictDialog({ spec, onResult }) {
  const [choice, setChoice] = useState(spec?.defaultChoice || 'overwrite')
  if (!spec) return null
  const opts = [
    { key: 'overwrite', t: T.dialog.optOverwrite, d: T.dialog.optOverwriteDesc(spec.oldDesc) },
    { key: 'rename', t: T.dialog.optRename, d: T.dialog.optRenameDesc },
    { key: 'skip', t: T.dialog.optSkip, d: T.dialog.optSkipDesc(spec.oldDesc) }
  ]
  return (
    <Modal
      title={spec.title || T.dialog.conflictTitle}
      icon="❗"
      onClose={() => onResult(null)}
      footer={
        <>
          <button className="btn" onClick={() => onResult(null)}>{T.dialog.cancel}</button>
          <button className="btn primary" onClick={() => onResult(choice)}>{T.dialog.ok}</button>
        </>
      }
    >
      <div className="msg">
        <b>{spec.name}</b> {T.dialog.conflictAsk('')}{spec.detail ? `（${spec.detail}）` : ''}
      </div>
      <div className="conflict-opts">
        {opts.map((o) => (
          <button key={o.key} className={`conflict-opt${choice === o.key ? ' selected' : ''}`} onClick={() => setChoice(o.key)}>
            <div>
              <div className="t">{o.t}</div>
              <div className="d">{o.d}</div>
            </div>
          </button>
        ))}
      </div>
    </Modal>
  )
}

/** 可操作错误弹窗：showError({title, hint, action})；action='openSettings' 显示「去设置」 */
export function ErrorDialog({ spec, onResult, onGoSettings }) {
  if (!spec) return null
  return (
    <Modal
      title={T.dialog.errorTitle}
      icon="🛠️"
      onClose={() => onResult()}
      footer={
        <>
          {spec.action === 'openSettings' && (
            <button className="btn primary" onClick={() => { onResult(); onGoSettings?.() }}>{T.empty.goSettings}</button>
          )}
          <button className="btn" onClick={() => onResult()}>{T.dialog.knowBtn}</button>
        </>
      }
    >
      <div className="msg"><b>{spec.title}</b></div>
      {spec.hint && <div className="warn-text">{spec.hint}</div>}
      {spec.raw && spec.raw !== spec.title && (
        <div style={{ marginTop: 10, color: 'var(--text-3)', fontSize: 12, fontFamily: 'Consolas, monospace', wordBreak: 'break-all' }}>
          {T.dialog.techDetail(spec.raw)}
        </div>
      )}
    </Modal>
  )
}

/** 全屏区块型错误（连接失败时嵌在文件区中间，带重试/去设置） */
export function ErrorPanel({ error, onRetry, onGoSettings }) {
  return (
    <div className="error-panel">
      <div className="icon">🔌</div>
      <div className="title">{error.title}</div>
      <div className="hint">{error.hint}</div>
      <div className="actions">
        {onRetry && <button className="btn primary" onClick={onRetry}>{T.empty.retry}</button>}
        <button className="btn" onClick={onGoSettings}>{T.empty.goSettings}</button>
      </div>
    </div>
  )
}
