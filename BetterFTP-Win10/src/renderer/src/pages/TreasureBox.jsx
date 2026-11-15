import React, { useMemo, useState } from 'react'
import { T } from '../texts.js'
import { fortuneOf, dayKey } from '../fortune.js'

/**
 * 百宝箱（结构参考 PCL2：工具磁贴网格 → 点击进入对应小工具面板）
 * 工具：今日人品 / 老师经典语录 / AI（独立窗口）/ 变化的软件名
 */
export function TreasureBox({ data, brandName, onChangeName, onOpenAi, onBack }) {
  const [tool, setTool] = useState(null)
  const [picked, setPicked] = useState(null)
  const [quoteIndex, setQuoteIndex] = useState(() => Math.floor(Math.random() * 1000))

  const quotes = data?.quotes || []
  const students = data?.students || []
  const names = data?.names || []
  const today = useMemo(() => dayKey(), [])

  const pickQuote = () => {
    if (quotes.length <= 1) return
    let next = quoteIndex
    while (next === quoteIndex) next = Math.floor(Math.random() * quotes.length)
    setQuoteIndex(next)
  }

  return (
    <div className="toolbox-page">
      <div className="settings-header">
        <button className="btn" onClick={() => (tool ? setTool(null) : onBack())}>{T.toolbox.back}</button>
        <h2>{T.toolbox.title}</h2>
        {tool === 'fortune' && <span className="toolbox-sub">{T.toolbox.todayIs(today)}</span>}
      </div>

      {!tool && (
        <div className="toolbox-grid">
          <button className="toolbox-tile" onClick={() => { setTool('fortune'); setPicked(null) }}>
            <span className="tile-icon">🎲</span>
            <span className="tile-name">{T.toolbox.fortune}</span>
            <span className="tile-desc">{T.toolbox.fortuneDesc}</span>
          </button>
          <button className="toolbox-tile" onClick={() => { setTool('quotes'); setQuoteIndex(Math.floor(Math.random() * Math.max(1, quotes.length))) }}>
            <span className="tile-icon">📢</span>
            <span className="tile-name">{T.toolbox.quotes}</span>
            <span className="tile-desc">{T.toolbox.quotesDesc}</span>
          </button>
          <button className="toolbox-tile" onClick={onOpenAi}>
            <span className="tile-icon">🤖</span>
            <span className="tile-name">{T.toolbox.ai}</span>
            <span className="tile-desc">{T.toolbox.aiDesc}</span>
          </button>
          <button className="toolbox-tile" onClick={onChangeName}>
            <span className="tile-icon">🪪</span>
            <span className="tile-name">{T.toolbox.nameChanger}</span>
            <span className="tile-desc">{T.toolbox.nameChangerDesc}</span>
            <span className="tile-current">{brandName}</span>
          </button>
        </div>
      )}

      {tool === 'fortune' && (
        <div className="card toolbox-panel">
          {students.length === 0 ? (
            <div className="hint-text">{T.toolbox.noNames}</div>
          ) : (
            <>
              <h3>{T.toolbox.pickName}</h3>
              <div className="fortune-grid">
                {students.map((name) => (
                  <button
                    key={name}
                    className={`fortune-name${picked === name ? ' selected' : ''}`}
                    onClick={() => setPicked(name)}
                    title={name}
                  >{name}</button>
                ))}
              </div>
              {picked && (() => {
                const f = fortuneOf(picked)
                return (
                  <div className={`fortune-result tier-${f.tier}`}>
                    <div className="fr-name">{T.toolbox.fortuneResult(f.name)}</div>
                    <div className="fr-score">{f.score}<small> / 100</small></div>
                    <div className="fr-text">{T.toolbox.fortunes[f.tier]}</div>
                    <div className="fr-hint">{T.toolbox.fortuneStable}</div>
                  </div>
                )
              })()}
            </>
          )}
        </div>
      )}

      {tool === 'quotes' && (
        <div className="card toolbox-panel">
          <div className="quote-card">
            <div className="quote-mark">“</div>
            <div className="quote-text">{quotes.length > 0 ? quotes[quoteIndex % quotes.length] : T.toolbox.noQuotes}</div>
          </div>
          <div className="quote-foot">
            <span className="hint-text">{T.toolbox.quoteCount(quotes.length)}</span>
            <button className="btn" onClick={pickQuote} disabled={quotes.length <= 1}>{T.toolbox.changeQuote}</button>
          </div>
        </div>
      )}
    </div>
  )
}
