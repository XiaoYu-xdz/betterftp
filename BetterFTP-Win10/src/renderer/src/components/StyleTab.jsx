import React, { useEffect, useState } from 'react'
import { T } from '../texts.js'
import { footerButtonStyle } from '../footer-style.js'

const api = () => window.betterftp
const IDS = ['promo', 'toolbox', 'about', 'settings']

/** 调色板（不使用系统取色器） */
const PALETTE = ['#fdfdfd', '#0078d7', '#00b7c3', '#8764b8', '#107c10', '#c19c00', '#d13438', '#e3008c', '#4c4a48', '#ffffff', '#ff8c00', '#00cc6a']

const DEFAULT_COLORS = ['#0078d7', '#00b7c3', '#8764b8']

function defaultStyle() {
  return {
    fill: { mode: 'solid', color: '#fdfdfd', colors: [...DEFAULT_COLORS] },
    border: { mode: 'solid', color: '#adadad', colors: [...DEFAULT_COLORS] },
    saturation: 100
  }
}

function cloneStyles(src) {
  const out = {}
  for (const id of IDS) {
    const s = src?.[id] || defaultStyle()
    out[id] = {
      fill: { ...defaultStyle().fill, ...(s.fill || {}) },
      border: { ...defaultStyle().border, ...(s.border || {}) },
      saturation: Number.isFinite(s.saturation) ? s.saturation : 100
    }
  }
  return out
}

/** 设置 → 样式：窗口大小 + 每个按钮独立样式（单色/Rainbow、调色板、饱和度），独立保存 */
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

  const setChoice = (which, value) => {
    setStyles((s) => ({ ...s, [target]: { ...s[target], [which]: value } }))
  }
  const setSaturation = (value) => {
    setStyles((s) => ({ ...s, [target]: { ...s[target], saturation: value } }))
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
          <ColorChoice value={current.fill} onChange={(v) => setChoice('fill', v)} />

          <label>{T.styleTab.border}</label>
          <ColorChoice value={current.border} onChange={(v) => setChoice('border', v)} />

          <label>{T.styleTab.saturation}</label>
          <div className="inline-row">
            <input
              type="range"
              className="slider"
              min={0}
              max={200}
              step={5}
              value={current.saturation ?? 100}
              onChange={(e) => setSaturation(Number(e.target.value))}
            />
            <span className="slider-val">{current.saturation ?? 100}%</span>
          </div>

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

/** 单色 / Rainbow 切换 + 调色板（仅调色板，无系统取色器） */
function ColorChoice({ value, onChange }) {
  const rainbow = value?.mode === 'rainbow'
  const colors = value?.colors || []
  const [slot, setSlot] = useState(0)

  return (
    <div className="color-choice">
      <div className="mode-row">
        <label className="mode-item">
          <input type="radio" checked={!rainbow} onChange={() => onChange({ ...value, mode: 'solid' })} />
          {T.styleTab.solid}
        </label>
        <label className="mode-item">
          <input type="radio" checked={rainbow} onChange={() => onChange({ ...value, mode: 'rainbow' })} />
          {T.styleTab.rainbow}
        </label>
      </div>

      {!rainbow ? (
        <div className="palette-row">
          {PALETTE.map((c) => (
            <button
              key={c}
              className={`palette-swatch${value?.color?.toLowerCase() === c.toLowerCase() ? ' selected' : ''}`}
              style={{ background: c }}
              onClick={() => onChange({ ...value, color: c })}
              title={c}
            />
          ))}
        </div>
      ) : (
        <div className="rainbow-colors">
          <div className="swatch-row">
            {colors.map((c, i) => (
              <span key={i} className="swatch-wrap">
                <button
                  className={`palette-swatch${slot === i ? ' selected' : ''}`}
                  style={{ background: c }}
                  onClick={() => setSlot(i)}
                  title={c}
                />
                {colors.length > 2 && (
                  <button
                    className="swatch-del"
                    title={T.styleTab.remove}
                    onClick={() => {
                      onChange({ ...value, colors: colors.filter((_, j) => j !== i) })
                      setSlot(0)
                    }}
                  >×</button>
                )}
              </span>
            ))}
            <button className="btn mini" onClick={() => {
              const next = [...colors, '#0078d7']
              onChange({ ...value, colors: next })
              setSlot(next.length - 1)
            }}>{T.styleTab.addColor}</button>
          </div>
          <div className="palette-row">
            {PALETTE.map((c) => (
              <button
                key={c}
                className="palette-swatch"
                style={{ background: c }}
                onClick={() => onChange({ ...value, colors: colors.map((x, j) => (j === slot ? c : x)) })}
              />
            ))}
          </div>
          <div className="hint-text">{T.styleTab.colorHint}</div>
        </div>
      )}
    </div>
  )
}
