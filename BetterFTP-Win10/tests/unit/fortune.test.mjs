import { describe, it, expect } from 'vitest'
import { fortuneOf, dayKey, hashString } from '../../src/renderer/src/fortune.js'

describe('今日人品 fortuneOf（同一人同一天必须一致）', () => {
  const d1 = new Date(2026, 10, 15, 9, 30)
  const d2 = new Date(2026, 10, 15, 18, 45)

  it('同一人同一天多次调用结果完全一致（不论几点查看）', () => {
    const a = fortuneOf('张三', d1)
    const b = fortuneOf('张三', d2)
    expect(a).toEqual(b)
    expect(a.name).toBe('张三')
  })

  it('分数在 0~100 之间', () => {
    for (const name of ['张三', '李四', '王五', '同学01', '同学54']) {
      const { score } = fortuneOf(name, d1)
      expect(score).toBeGreaterThanOrEqual(0)
      expect(score).toBeLessThanOrEqual(100)
    }
  })

  it('不同的人同一天分数有差异（54 人不会全一样）', () => {
    const scores = new Set()
    for (let i = 1; i <= 54; i++) scores.add(fortuneOf('同学' + String(i).padStart(2, '0'), d1).score)
    expect(scores.size).toBeGreaterThan(5)
  })

  it('同一人不同天分数会变化', () => {
    const dayA = fortuneOf('张三', new Date(2026, 10, 15))
    const dayB = fortuneOf('张三', new Date(2026, 10, 16))
    expect(dayA.day).not.toBe(dayB.day)
    expect(dayA.score).not.toBe(dayB.score)
  })

  it('dayKey 两位补零', () => {
    expect(dayKey(new Date(2026, 0, 5))).toBe('2026-01-05')
    expect(dayKey(new Date(2026, 11, 31))).toBe('2026-12-31')
  })

  it('hashString 稳定且为无符号 32 位', () => {
    expect(hashString('abc')).toBe(hashString('abc'))
    expect(hashString('abc')).toBeGreaterThanOrEqual(0)
    expect(hashString('abc')).toBeLessThanOrEqual(0xffffffff)
  })
})
