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
 * 百宝箱（PCL 风格）：工具按列表显示，无图标无说明；点击后在下方就地展开。
 * 今日人品：下拉选择名字 → 就地显示结果（同人同日固定）。
 */
export function TreasureBox({ data, brandName, onChangeName, onOpenAi, onBack }) {
  const [tool, setTool] = useState(null)   // null | 'fortune' | 'echo'
  const [picked, setPicked] = useState('')
  const [quoteIdx, setQuoteIdx] = useState(0)

  const quotes = data?.quotes || []
  const students = data?.students || []
  const fortunes = { ...FALLBACK_FORTUNES, ...(data?.fortunes || {}) }
  const today = useMemo(() => dayKey().replace(/-/g, '/'), [])

  const toggle = (id) => setTool((cur) => (cur === id ? null : id))

  const nextQuote = () => {
    if (quotes.length <= 1) return
    let next = quoteIdx
    while (next === quoteIdx) next = Math.floor(Math.random() * quotes.length)
    setQuoteIdx(next)
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
        <div className="tool-list">
          <button className={`tool-btn${tool === 'fortune' ? ' active' : ''}`} onClick={() => toggle('fortune')}>{T.toolbox.fortune}</button>
          <button className={`tool-btn${tool === 'echo' ? ' active' : ''}`} onClick={() => toggle('echo')}>{T.toolbox.echo}</button>
          <button className="tool-btn" onClick={onOpenAi}>{T.toolbox.ai}</button>
          <button className="tool-btn" onClick={onChangeName}>{T.toolbox.change}</button>
        </div>

        {tool === 'fortune' && (
          <div className="tool-panel">
            <div className="fortune-title">{T.toolbox.fortuneTitle(today)}</div>
            <select
              className="input fortune-select"
              value={picked}
              onChange={(e) => setPicked(e.target.value)}
            >
              <option value="">{T.toolbox.selectStudent}</option>
              {students.map((name) => <option key={name} value={name}>{name}</option>)}
            </select>
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
      </div>
    </div>
  )
}
