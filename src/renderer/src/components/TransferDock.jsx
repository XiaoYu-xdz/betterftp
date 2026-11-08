import React, { useState } from 'react'
import { fmtSize, fmtSpeed, fmtEta } from '../utils.js'
import { T } from '../texts.js'

const DOCK_MIN = 52
const DOCK_MAX_RATIO = 0.6

/** 底部传输队列坞：进度/速度/剩余时间/失败原因+重试；高度可拖动，可折叠 */
export function TransferDock({ tasks, onCancel, onRetry, onReveal }) {
  const [collapsed, setCollapsed] = useState(false)
  const [expandedErr, setExpandedErr] = useState(null)
  const [height, setHeight] = useState(() => {
    const h = Number(window.localStorage?.getItem('betterftp.dockHeight'))
    return Number.isFinite(h) && h >= DOCK_MIN ? h : 150
  })

  const startDrag = (e) => {
    e.preventDefault()
    const startY = e.clientY
    const startH = height
    const onMove = (ev) => {
      const h = Math.max(DOCK_MIN, Math.min(window.innerHeight * DOCK_MAX_RATIO, startH + (startY - ev.clientY)))
      setHeight(Math.round(h))
    }
    const onUp = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  const running = tasks.filter((t) => t.status === 'running').length
  const pending = tasks.filter((t) => t.status === 'pending').length
  const failed = tasks.filter((t) => t.status === 'failed').length
  const active = tasks.filter((t) => !['done', 'failed', 'cancelled'].includes(t.status))
  const visible = collapsed ? active : tasks

  return (
    <div
      className={`dock${collapsed ? ' collapsed' : ''}`}
      style={collapsed ? undefined : { height }}
    >
      <div className="dock-resizer" onMouseDown={startDrag} title="拖动调整高度" />
      <div className="dock-head" onClick={() => setCollapsed(!collapsed)}>
        <span>{collapsed ? '▲' : '▼'} {T.dock.title(tasks.length)}</span>
        <span className="counts">
          {running > 0 && <span>{T.dock.running(running)}</span>}
          {pending > 0 && <span>{T.dock.pending(pending)}</span>}
          {failed > 0 && <span className="count-bad">{T.dock.failed(failed)}</span>}
          {running + pending + failed === 0 && <span>{T.dock.none}</span>}
        </span>
        <span className="arrow">▾</span>
      </div>
      <div className="dock-body">
        {visible.map((t) => (
          <TaskRow
            key={t.id}
            task={t}
            errExpanded={expandedErr === t.id}
            onToggleErr={() => setExpandedErr(expandedErr === t.id ? null : t.id)}
            onCancel={() => onCancel(t.id)}
            onRetry={() => onRetry(t.id)}
            onReveal={() => onReveal(t)}
          />
        ))}
        {visible.length === 0 && (
          <div className="dock-empty">{T.dock.emptyHint}</div>
        )}
      </div>
    </div>
  )
}

function TaskRow({ task, errExpanded, onToggleErr, onCancel, onRetry, onReveal }) {
  const pct = task.total ? Math.min(100, Math.round((task.transferred / task.total) * 100)) : null
  const finished = task.status === 'done'
  const arrow = task.kind === 'upload' ? '↑' : '↓'
  const st = T.taskStatus[task.status] || { text: task.status, cls: 'muted' }
  return (
    <div className="task-row">
      <span className="t-dir" style={{ color: task.color }}>{arrow}</span>
      <div className="t-main">
        <div className="t-name">
          <span className="n">{task.name}</span>
          <span className="s">{task.accountName}</span>
          {finished && task.kind === 'download' && (
            <button className="rbtn" onClick={onReveal} title={task.localPath}>{T.dock.reveal}</button>
          )}
        </div>
        {task.status === 'running' && (
          <div className="t-prog">
            <div className="progress"><div className="fill" style={{ width: `${pct ?? 0}%`, background: task.color }} /></div>
            <span>{pct !== null ? `${pct}%` : fmtSize(task.transferred)}</span>
            <span>{fmtSize(task.transferred)}{task.total ? ` / ${fmtSize(task.total)}` : ''}</span>
            {task.speed > 0 && <span>{fmtSpeed(task.speed)}</span>}
            {task.eta && <span>{fmtEta(task.eta)}</span>}
          </div>
        )}
        {task.status === 'pending' && (
          <div className="t-prog"><span>{T.dock.queued}</span></div>
        )}
        {task.error && (
          <div className="t-error" onClick={onToggleErr}>
            {task.error.title}
            {errExpanded && task.error.hint && <div className="hint">{task.error.hint}</div>}
          </div>
        )}
      </div>
      <span className={`t-status ${st.cls}`}>{st.text}</span>
      <div className="t-actions">
        {(task.status === 'running' || task.status === 'pending') && (
          <button className="rbtn" onClick={onCancel} title={T.dock.cancelTitle}>{T.dock.cancel}</button>
        )}
        {task.status === 'failed' && (
          <button className="rbtn" onClick={onRetry} title={T.dock.retryTitle}>{T.dock.retry}</button>
        )}
      </div>
    </div>
  )
}

