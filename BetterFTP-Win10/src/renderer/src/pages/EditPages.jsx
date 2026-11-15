import React, { useState } from 'react'
import { T } from '../texts.js'

/** 编辑老师经典语录（通过顶部命令栏 zcode 进入） */
export function EditQuotes({ quotes, onSave, onBack, showToast, showError }) {
  const [list, setList] = useState(() => [...(quotes || [])])
  const [saving, setSaving] = useState(false)

  const update = (i, v) => setList((l) => l.map((x, j) => (j === i ? v : x)))
  const remove = (i) => setList((l) => l.filter((_, j) => j !== i))
  const add = () => setList((l) => [...l, ''])

  const save = async () => {
    const cleaned = list.map((x) => x.trim()).filter(Boolean)
    setSaving(true)
    try {
      await onSave(cleaned)
      showToast(T.editQuotes.saved)
    } catch (e) { showError(e) } finally { setSaving(false) }
  }

  return (
    <div className="edit-page">
      <div className="settings-header">
        <button className="btn" onClick={onBack}>{T.toolbox.back}</button>
        <h2>{T.editQuotes.title}</h2>
        <button className="btn primary" style={{ marginLeft: 'auto' }} onClick={save} disabled={saving}>{T.editQuotes.save}</button>
      </div>
      <div className="card">
        {list.length === 0 && <div className="hint-text">{T.editQuotes.empty}</div>}
        {list.map((q, i) => (
          <div className="edit-row" key={i}>
            <span className="edit-index">{i + 1}</span>
            <textarea
              className="input edit-textarea"
              value={q}
              rows={2}
              placeholder={T.editQuotes.placeholder}
              onChange={(e) => update(i, e.target.value)}
            />
            <button className="btn mini danger" onClick={() => remove(i)}>{T.settings.del}</button>
          </div>
        ))}
        <button className="btn" style={{ marginTop: 10 }} onClick={add}>{T.editQuotes.add}</button>
      </div>
    </div>
  )
}

/** 编辑「变化的软件名」名字列表（通过顶部命令栏 zcode 进入） */
export function EditNames({ names, onSave, onBack, showToast, showError }) {
  const [list, setList] = useState(() => [...(names || [])])
  const [saving, setSaving] = useState(false)

  const update = (i, v) => setList((l) => l.map((x, j) => (j === i ? v : x)))
  const remove = (i) => setList((l) => l.filter((_, j) => j !== i))
  const add = () => setList((l) => [...l, ''])

  const save = async () => {
    const cleaned = list.map((x) => x.trim()).filter(Boolean)
    if (cleaned.length === 0) { showError({ title: T.editNames.empty, hint: T.editNames.needOne }); return }
    setSaving(true)
    try {
      await onSave(cleaned)
      showToast(T.editNames.saved)
    } catch (e) { showError(e) } finally { setSaving(false) }
  }

  return (
    <div className="edit-page">
      <div className="settings-header">
        <button className="btn" onClick={onBack}>{T.toolbox.back}</button>
        <h2>{T.editNames.title}</h2>
        <button className="btn primary" style={{ marginLeft: 'auto' }} onClick={save} disabled={saving}>{T.editNames.save}</button>
      </div>
      <div className="card">
        <div className="hint-text" style={{ marginBottom: 10 }}>{T.editNames.hint}</div>
        {list.map((n, i) => (
          <div className="edit-row" key={i}>
            <span className="edit-index">{i + 1}</span>
            <input
              className="input edit-input"
              value={n}
              placeholder={T.editNames.placeholder}
              onChange={(e) => update(i, e.target.value)}
            />
            <button className="btn mini danger" onClick={() => remove(i)}>{T.settings.del}</button>
          </div>
        ))}
        <button className="btn" style={{ marginTop: 10 }} onClick={add}>{T.editNames.add}</button>
      </div>
    </div>
  )
}
