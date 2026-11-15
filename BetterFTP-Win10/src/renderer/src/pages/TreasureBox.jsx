import React, { useMemo, useState } from 'react'
import { T } from '../texts.js'
import { fortuneOf, dayKey } from '../fortune.js'

const FALLBACK_FORTUNES = {
  great: '爆表！今天干什么都顺',
  good: '不错，适合举手发言',
  normal: '平平淡淡才是真',
  low: '建议今天低调一点',
  bad: '今天适合安静刷题'
}

/**
 * 百宝箱（PCL 风格）：每个工具单独一行，点击就地展开。
 * 今日人品：横向 6×9 名字网格（54 人），选中即显示结果（同人同日固定）。
 */
export function TreasureBox({ data, brandName, onChangeName, onOpenAi, onBack }) {
  const [tool, setTool] = useState(null)   // null | 'fortune' | 'echo'
  const [picked, setPicked] = useState('')
  const [quoteIdx, setQuoteIdx] = useState(0)

  const quotes = data?.quotes || []
  const students = data?.students || []
  const fortunes = { ...FALLBACK_FORTUNES, ...(data?.fortunes || {}) }
  const today = useMemo(() => dayKey().replace(/-/g, '/'), [])

  const nextQuote = () => {
    if (quotes.length <= 1) return
    let next = quoteIdx
    while (next === quoteIdx) next = Math.floor(Math.random() * quotes.length)
    setQuoteIdx(next)
  }

  const onRow = (id) => {
    if (id === 'ai') { onOpenAi(); return }
    if (id === 'change') { onChangeName(); return }
    setTool((cur) => (cur === id ? null : id))
  }

  const result = picked ? fortuneOf(picked) : null

  return (
    <div className="toolbox-page">
      <div className="settings-header">
        <button className="btn" onClick={onBack}>{T.toolbox.back}</button>
        <h2>{T.toolbox.title}</h2>
      </div>

      <div className="card">
        <h3>{T.toolbox.groupTitle}</h3>
        <div className="tool-rows">
          <button className={`tool-row${tool === 'fortune' ? ' active' : ''}`} onClick={() => onRow('fortune')}>
            <span>{T.toolbox.fortune}</span>
            <span className="tool-row-arrow">{tool === 'fortune' ? '▾' : '▸'}</span>
          </button>
          {tool === 'fortune' && (
            <div className="tool-panel">
              <div className="fortune-title">{T.toolbox.fortuneTitle(today)}</div>
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
              {result && (
                <>
                  <div className="fortune-line">
                    {T.toolbox.fortuneLine(result.score)}
                    <span className="fortune-comment">{fortunes[result.tier]}</span>
                  </div>
                  <div className="tool-actions">
                    <button className="btn" onClick={() => { setTool(null); setPicked('') }}>{T.toolbox.know}</button>
                  </div>
                </>
              )}
            </div>
          )}

          <button className={`tool-row${tool === 'echo' ? ' active' : ''}`} onClick={() => onRow('echo')}>
            <span>{T.toolbox.echo}</span>
            <span className="tool-row-arrow">{tool === 'echo' ? '▾' : '▸'}</span>
          </button>
          {tool === 'echo' && (
            <div className="tool-panel">
              <div className="echo-text" onClick={nextQuote} title={T.toolbox.changeQuote}>
                {quotes.length > 0 ? quotes[quoteIdx % quotes.length] : T.toolbox.noQuotes}
              </div>
              <div className="tool-actions">
                <span className="hint-text">{T.toolbox.quoteCount(quotes.length)}</span>
                <button className="btn" onClick={nextQuote} disabled={quotes.length <= 1}>{T.toolbox.changeQuote}</button>
              </div>
            </div>
          )}

          <button className="tool-row" onClick={() => onRow('ai')}>
            <span>{T.toolbox.ai}</span>
            <span className="tool-row-arrow">↗</span>
          </button>

          <button className="tool-row" onClick={() => onRow('change')}>
            <span>{T.toolbox.change}</span>
            <span className="tool-row-extra">{brandName}</span>
          </button>
        </div>
      </div>
    </div>
  )
}
