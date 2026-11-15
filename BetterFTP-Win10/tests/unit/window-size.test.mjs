import { describe, it, expect } from 'vitest'
import { resolveWindowSize, clampWindowSize, DEFAULT_WINDOW, MIN_WINDOW } from '../../src/main/window-size.js'

describe('窗口尺寸 resolveWindowSize', () => {
  it('大屏首次启动：默认 1280×820，不最大化', () => {
    const r = resolveWindowSize(null, { width: 1920, height: 1040 })
    expect(r).toEqual({ width: 1280, height: 820, maximize: false })
  })

  it('希沃 1366×768（可用 1366×728）首次启动：高度夹到 728，自动最大化', () => {
    const r = resolveWindowSize(undefined, { width: 1366, height: 728 })
    expect(r.width).toBe(1280)
    expect(r.height).toBe(728)
    expect(r.maximize).toBe(true)
  })

  it('1080p@125% 缩放（可用 1536×824）首次启动：默认 820 高可放下，仍自动最大化', () => {
    const r = resolveWindowSize({}, { width: 1536, height: 824 })
    expect(r.height).toBe(820)
    expect(r.maximize).toBe(true)
  })

  it('可用高度低于默认值 → 夹到可用高度', () => {
    const r = resolveWindowSize(null, { width: 1366, height: 700 })
    expect(r.height).toBe(700)
  })

  it('用户保存过的尺寸优先于小屏自动最大化', () => {
    const r = resolveWindowSize({ width: 1100, height: 700, maximized: false }, { width: 1366, height: 728 })
    expect(r).toEqual({ width: 1100, height: 700, maximize: false })
  })

  it('保存过最大化状态 → 恢复最大化', () => {
    const r = resolveWindowSize({ width: 1280, height: 820, maximized: true }, { width: 1920, height: 1040 })
    expect(r.maximize).toBe(true)
  })

  it('保存的尺寸超出屏幕 → 夹取到可用区域', () => {
    const r = resolveWindowSize({ width: 3000, height: 2000, maximized: false }, { width: 1920, height: 1040 })
    expect(r.width).toBe(1920)
    expect(r.height).toBe(1040)
  })

  it('保存的尺寸小于最小 → 夹取到最小值', () => {
    const r = resolveWindowSize({ width: 500, height: 400, maximized: false }, { width: 1920, height: 1040 })
    expect(r.width).toBe(MIN_WINDOW.width)
    expect(r.height).toBe(MIN_WINDOW.height)
  })

  it('极小屏幕：不低于最小尺寸（避免不可用）', () => {
    const r = resolveWindowSize(null, { width: 800, height: 500 })
    expect(r.width).toBe(MIN_WINDOW.width)
    expect(r.height).toBe(MIN_WINDOW.height)
    expect(r.maximize).toBe(true)
  })

  it('非法保存值按无保存处理', () => {
    const r = resolveWindowSize({ width: -5, height: 'x', maximized: false }, { width: 1920, height: 1040 })
    expect(r.width).toBe(DEFAULT_WINDOW.width)
    expect(r.height).toBe(DEFAULT_WINDOW.height)
  })
})

describe('窗口尺寸 clampWindowSize（设置页滑块应用）', () => {
  it('正常值原样通过', () => {
    expect(clampWindowSize({ width: 1200, height: 760 }, { width: 1920, height: 1040 })).toEqual({ width: 1200, height: 760 })
  })
  it('低于最小夹到最小，高于屏幕夹到屏幕', () => {
    expect(clampWindowSize({ width: 300, height: 9999 }, { width: 1920, height: 1040 }))
      .toEqual({ width: MIN_WINDOW.width, height: 1040 })
  })
  it('非法值回退默认', () => {
    expect(clampWindowSize({ width: 'x', height: null }, { width: 1920, height: 1040 }))
      .toEqual({ width: DEFAULT_WINDOW.width, height: DEFAULT_WINDOW.height })
  })
})
