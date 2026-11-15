import { describe, it, expect } from 'vitest'
import { footerButtonStyle } from '../../src/renderer/src/footer-style.js'

const solid = { mode: 'solid', color: '#fdfdfd', colors: ['#0078d7', '#00b7c3'] }

describe('底部按钮样式 footerButtonStyle', () => {
  it('单色填充 + 单色外框 → 普通背景/边框色，无动画类', () => {
    const r = footerButtonStyle({
      fill: { mode: 'solid', color: '#ff0000' },
      border: { mode: 'solid', color: '#00ff00' }
    })
    expect(r.className).toBe('')
    expect(r.style.backgroundColor).toBe('#ff0000')
    expect(r.style.borderColor).toBe('#00ff00')
  })

  it('填充 Rainbow → 渐变背景 + 动画类', () => {
    const r = footerButtonStyle({
      fill: { mode: 'rainbow', colors: ['#ff0000', '#00ff00', '#0000ff'] },
      border: { mode: 'solid', color: '#adadad' }
    })
    expect(r.className).toBe('bf-rainbow')
    expect(r.style.background).toContain('conic-gradient')
    expect(r.style.background).toContain('padding-box')
    expect(r.style.background).toContain('border-box')
    expect(r.style.borderColor).toBe('transparent')
  })

  it('仅外框 Rainbow → 填充保留单色', () => {
    const r = footerButtonStyle({
      fill: { mode: 'solid', color: '#123456' },
      border: { mode: 'rainbow', colors: ['#ff0000', '#00ff00'] }
    })
    expect(r.className).toBe('bf-rainbow')
    expect(r.style.background).toContain('linear-gradient(#123456')
    expect(r.style.background).toContain('conic-gradient')
  })

  it('两者都 Rainbow → 双层渐变', () => {
    const r = footerButtonStyle({
      fill: { mode: 'rainbow', colors: ['#ff0000', '#00ff00'] },
      border: { mode: 'rainbow', colors: ['#0000ff', '#ffff00'] }
    })
    expect((r.style.background.match(/conic-gradient/g) || []).length).toBe(2)
  })

  it('rainbow 模式但颜色不足 2 个 → 回退单色', () => {
    const r = footerButtonStyle({
      fill: { mode: 'rainbow', colors: ['#ff0000'] },
      border: solid
    })
    expect(r.className).toBe('')
    expect(r.style.backgroundColor).toBeDefined()
  })

  it('空配置 → 默认外观', () => {
    const r = footerButtonStyle(undefined)
    expect(r.className).toBe('')
    expect(r.style.backgroundColor).toBe('#fdfdfd')
    expect(r.style.borderColor).toBe('#adadad')
  })
})
