import { describe, it, expect } from 'vitest'
import { normalizeUi, defaultButtonStyle, FOOTER_BUTTON_IDS } from '../../src/main/store/config.js'

describe('底部按钮样式配置 normalizeUi', () => {
  it('空配置 → 四个按钮都有默认样式', () => {
    const ui = normalizeUi(undefined)
    for (const id of FOOTER_BUTTON_IDS) {
      expect(ui.buttonStyles[id]).toBeTruthy()
      expect(ui.buttonStyles[id].fill.mode).toBe('solid')
      expect(ui.buttonStyles[id].border.color).toBe('#adadad')
    }
  })

  it('每个按钮可独立设置，互不影响', () => {
    const ui = normalizeUi({
      buttonStyles: {
        promo: { fill: { mode: 'rainbow', colors: ['#ff0000', '#00ff00'] }, border: { mode: 'solid', color: '#123456' } },
        toolbox: { fill: { mode: 'solid', color: '#abcdef' }, border: { mode: 'solid', color: '#000000' } }
      }
    })
    expect(ui.buttonStyles.promo.fill.mode).toBe('rainbow')
    expect(ui.buttonStyles.promo.border.color).toBe('#123456')
    expect(ui.buttonStyles.toolbox.fill.color).toBe('#abcdef')
    expect(ui.buttonStyles.about.fill.mode).toBe('solid')
    expect(ui.buttonStyles.settings.fill.color).toBe('#fdfdfd')
  })

  it('旧版 footerStyle 迁移为所有按钮的初始样式', () => {
    const ui = normalizeUi({
      footerStyle: { fill: { mode: 'solid', color: '#ffaa00' }, border: { mode: 'solid', color: '#00aaff' } }
    })
    for (const id of FOOTER_BUTTON_IDS) {
      expect(ui.buttonStyles[id].fill.color).toBe('#ffaa00')
      expect(ui.buttonStyles[id].border.color).toBe('#00aaff')
    }
  })

  it('非法颜色被替换为默认值', () => {
    const ui = normalizeUi({
      buttonStyles: { promo: { fill: { mode: 'solid', color: 'red' }, border: { mode: 'rainbow', colors: ['x'] } } }
    })
    expect(ui.buttonStyles.promo.fill.color).toBe(defaultButtonStyle().fill.color)
    expect(ui.buttonStyles.promo.border.colors.length).toBeGreaterThanOrEqual(2)
  })
})
