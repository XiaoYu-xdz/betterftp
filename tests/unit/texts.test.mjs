import { describe, it, expect } from 'vitest'
import { T, deepMergeTexts, applyTextsOverride } from '../../src/renderer/src/texts.js'
import { ERR_TEXTS, applyMainTextsOverride, deepMergeTexts as mergeMain } from '../../src/main/texts.js'

describe('文案中心', () => {
  it('渲染层文案包含关键分节', () => {
    for (const key of ['side', 'top', 'perms', 'table', 'actions', 'empty', 'dock', 'taskStatus', 'dialog', 'msgs', 'confirm', 'settings', 'logActions']) {
      expect(T[key], `缺少分节 ${key}`).toBeTruthy()
    }
  })

  it('deepMergeTexts：部分覆盖，其余保留', () => {
    const base = { a: { b: 1, c: 2 }, d: 3 }
    const merged = deepMergeTexts(base, { a: { b: 9 } })
    expect(merged).toEqual({ a: { b: 9, c: 2 }, d: 3 })
    expect(base.a.b).toBe(1) // 不改原对象
  })

  it('applyTextsOverride：原地替换且 T 引用稳定', () => {
    const before = T.actions.upload
    applyTextsOverride({ actions: { upload: '传课件' } })
    expect(T.actions.upload).toBe('传课件')
    expect(T.actions.download).toBe('下载') // 未覆盖的键保留
    applyTextsOverride({ actions: { upload: before } }) // 还原
    expect(T.actions.upload).toBe(before)
  })

  it('主进程错误文案：类型齐全 + 覆盖生效', () => {
    for (const key of ['auth', 'toomany', 'permList', 'permOp', 'passiveBlocked', 'refused', 'timeout', 'notfound', 'resetData', 'resetCtrl', 'unknown', 'engine', 'ipc']) {
      expect(ERR_TEXTS[key], `缺少错误文案 ${key}`).toBeTruthy()
    }
    const before = ERR_TEXTS.auth.title
    applyMainTextsOverride({ auth: { title: '测试错误标题' } })
    expect(ERR_TEXTS.auth.title).toBe('测试错误标题')
    applyMainTextsOverride({ auth: { title: before } })
    expect(ERR_TEXTS.auth.title).toBe(before)
  })

  it('mergeMain 与 deepMergeTexts 行为一致（两端各有一份实现）', () => {
    expect(mergeMain({ a: { b: 1 } }, { a: { c: 2 } })).toEqual({ a: { b: 1, c: 2 } })
  })
})
