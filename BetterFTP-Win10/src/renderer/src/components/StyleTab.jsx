import React, { useEffect, useState } from 'react'
import { T } from '../texts.js'
import { footerButtonStyle } from '../footer-style.js'

const api = () => window.betterftp
const IDS = ['promo', 'toolbox', 'about', 'settings']

const DEFAULT_COLORS = ['#0078d7', '#00b7c3', '#8764b8']

function defaultStyle() {
  return {
    fill: { mode: 'solid', color: '#fdfdfd', colors: [...DEFAULT_COLORS] },
    border: { mode: 'solid', color: '#adadad', colors: [...DEFAULT_COLORS] }
  }
}

function cloneStyles(src) {
  const out = {}
  for (const id of IDS) {
    const s = src?.[id] || defaultStyle()
    out[id] = {
      fill: { ...defaultStyle().fill, ...(s.fill || {}) },
      border: { ...defaultStyle().border, ...(s.border || {}) }
    }
  }
  return out
}

/** 设置 → 样式：窗口大小 + 每个按钮独立样式（仅模式切换，颜色使用默认值），独立保存 */
export function StyleTab({ globalCfg, onSaved, showToast, showError }) {
  const [styles, setStyles] = useState(() => cloneStyles(globalCfg?.ui?.buttonStyles))
  const [target, setTarget] = useState('promo')
  const [winInfo, setWinInfo] = useState(null)
  const [winW, setWinW] = useState(1280)
  const [winH, setWinH] = useState(820)

  useEffect(() => {
    api().windowInfo().then((info) => {
      setWinInfo(info)
      setWinW(info.width || 1280)
      setWinH(info.height || 820)
    }).catch(() => { /* 窗口信息不可用则隐藏尺寸区 */ })
  }, [])

  const current = styles[target]
  const preview = footerButtonStyle(current)

  const setMode = (which, mode) => {
    setStyles((s) => ({ ...s, [target]: { ...s[target], [which]: { ...s[target][which], mode } } }))
  }

  const save = async () => {
    try {
      const next = await api().saveGlobal({ global: { ...globalCfg, ui: { ...(globalCfg.ui || {}), buttonStyles: styles } } })
      onSaved(next.global)
      if (winInfo) {
        const r = await api().applyWindowSize({ width: winW, height: winH })
        setWinW(r.width)
        setWinH(r.height)
      }
      showToast(T.styleTab.saved)
    } catch (e) { showError(e) }
  }

  const restore = async () => {
    const fresh = Object.fromEntries(IDS.map((id) => [id, defaultStyle()]))
    setStyles(fresh)
    try {
      const next = await api().saveGlobal({ global: { ...globalCfg, ui: { ...(globalCfg.ui || {}), buttonStyles: fresh } } })
      onSaved(next.global)
      showToast(T.styleTab.restored)
    } catch (e) { showError(e) }
  }

  return (
    <div className="style-tab">
      {winInfo && (
        <div className="card">
          <h3>{T.styleTab.windowSection}</h3>
          <div className="form-grid">
            <label>{T.styleTab.width}</label>
            <div className="inline-row">
              <input
                type="range"
                className="slider"
                min={winInfo.min.width}
                max={Math.max(winInfo.workArea.width, winInfo.min.width)}
                step={10}
                value={winW}
                onChange={(e) => setWinW(Number(e.target.value))}
              />
              <span className="slider-val">{winW} px</span>
            </div>
            <label>{T.styleTab.height}</label>
            <div className="inline-row">
              <input
                type="range"
                className="slider"
                min={winInfo.min.height}
                max={Math.max(winInfo.workArea.height, winInfo.min.height)}
                step={10}
                value={winH}
                onChange={(e) => setWinH(Number(e.target.value))}
              />
              <span className="slider-val">{winH} px</span>
            </div>
            <div className="full hint-text">{T.styleTab.windowHint(winInfo.workArea, winInfo.min)}</div>
          </div>
        </div>
      )}

      <div className="card">
        <h3>{T.styleTab.buttonSection}</h3>
        <div className="form-grid">
          <label>{T.styleTab.target}</label>
          <select className="select" value={target} onChange={(e) => setTarget(e.target.value)} style={{ maxWidth: 240 }}>
            {IDS.map((id) => <option key={id} value={id}>{T.styleTab.targets[id]}</option>)}
          </select>

          <label>{T.styleTab.fill}</label>
          <ModeChoice value={current.fill.mode} onChange={(m) => setMode('fill', m)} />

          <label>{T.styleTab.border}</label>
          <ModeChoice value={current.border.mode} onChange={(m) => setMode('border', m)} />

          <label>{T.styleTab.preview}</label>
          <div className="inline-row">
            <button className={`btn settings-btn ${preview.className}`} style={{ ...preview.style, width: 180 }}>
              {T.styleTab.targets[target]}
            </button>
          </div>
        </div>
        <div style={{ marginTop: 16, display: 'flex', gap: 10 }}>
          <button className="btn primary" onClick={save}>{T.styleTab.save}</button>
          <button className="btn" onClick={restore}>{T.styleTab.restore}</button>
        </div>
      </div>
    </div>
  )
}

/** Solid / Rainbow 模式切换（颜色使用默认值，不提供调色板） */
function ModeChoice({ value, onChange }) {
  return (
    <div className="mode-row">
      <label className="mode-item">
        <input type="radio" checked={value !== 'rainbow'} onChange={() => onChange('solid')} />
        {T.styleTab.solid}
      </label>
      <label className="mode-item">
        <input type="radio" checked={value === 'rainbow'} onChange={() => onChange('rainbow')} />
        {T.styleTab.rainbow}
      </label>
    </div>
  )
}
