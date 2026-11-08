import { describe, it, expect } from 'vitest'
import path from 'node:path'
import fs from 'node:fs'
import os from 'node:os'
import { TransferEngine } from '../../src/main/ftp/transfer-engine.js'
import { withServer, testGlobal, testAccount, waitFor } from '../helpers.mjs'

const PORT = 2123
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'betterftp-engine-'))

function makeEngine({ port, accounts, maxConcurrent = 2 }) {
  const logs = []
  const engine = new TransferEngine({
    getConfig: () => ({ ...testGlobal(port), maxConcurrentTransfers: maxConcurrent }),
    findAccount: (id) => accounts.find((a) => a.id === id) || null,
    logger: { log: (e) => logs.push(e) }
  })
  return { engine, logs }
}

describe('传输引擎', () => {
  it('上传 + 下载全流程，内容一致，日志有记录', async () => {
    await withServer(async ({ port, rootDir }) => {
      const dir = tmp()
      const accounts = [testAccount('zhang')]
      const { engine, logs } = makeEngine({ port, accounts })
      const src = path.join(dir, '课件.pptx')
      const payload = Buffer.from('ENGINE-UPLOAD-TEST-内容'.repeat(500))
      fs.writeFileSync(src, payload)

      engine.enqueue({ kind: 'upload', accountId: 'acc_zhang', remotePath: '/', name: '课件.pptx', localPath: src, total: payload.length })
      engine.enqueue({ kind: 'download', accountId: 'acc_zhang', remotePath: '/', name: '课件.pptx', localPath: path.join(dir, '下载的.pptx') })

      expect(await waitFor(() => engine.snapshot().every((t) => t.status === 'done'))).toBe(true)
      const localDown = path.join(dir, '下载的.pptx')
      expect(fs.readFileSync(path.join(rootDir, 'zhang/课件.pptx')).equals(payload)).toBe(true)
      expect(fs.readFileSync(localDown).equals(payload)).toBe(true)
      expect(logs.filter((l) => l.result === '成功')).toHaveLength(2)
      engine.destroy()
    }, { port: PORT })
  })

  it('进度事件推送（transferred 递增）', async () => {
    await withServer(async ({ port }) => {
      const dir = tmp()
      const { engine } = makeEngine({ port, accounts: [testAccount('zhang')] })
      const src = path.join(dir, 'big.bin')
      fs.writeFileSync(src, Buffer.alloc(1024 * 1024, 9))
      let maxSeen = 0
      engine.on('updated', (tasks) => {
        for (const t of tasks) maxSeen = Math.max(maxSeen, t.transferred)
      })
      engine.enqueue({ kind: 'upload', accountId: 'acc_zhang', remotePath: '/', name: 'big.bin', localPath: src, total: 1024 * 1024 })
      expect(await waitFor(() => engine.snapshot().every((t) => t.status === 'done'))).toBe(true)
      expect(maxSeen).toBeGreaterThan(0)
      engine.destroy()
    }, { port: PORT })
  })

  it('并发限制：maxConcurrent=1 时同时只有一个 running', async () => {
    await withServer(async ({ port }) => {
      const dir = tmp()
      const { engine } = makeEngine({ port, accounts: [testAccount('zhang'), testAccount('li')], maxConcurrent: 1 })
      const src = path.join(dir, 'f.bin')
      fs.writeFileSync(src, Buffer.alloc(600 * 1024, 3))
      let everViolated = false
      engine.on('updated', (tasks) => {
        if (tasks.filter((t) => t.status === 'running').length > 1) everViolated = true
      })
      engine.enqueue({ kind: 'upload', accountId: 'acc_zhang', remotePath: '/', name: 'a1.bin', localPath: src, total: 614400 })
      engine.enqueue({ kind: 'upload', accountId: 'acc_li', remotePath: '/', name: 'a2.bin', localPath: src, total: 614400 })
      engine.enqueue({ kind: 'upload', accountId: 'acc_zhang', remotePath: '/', name: 'a3.bin', localPath: src, total: 614400 })
      expect(await waitFor(() => engine.snapshot().every((t) => t.status === 'done'))).toBe(true)
      expect(everViolated).toBe(false)
      engine.destroy()
    }, { port: PORT })
  })

  it('取消运行中的任务 → cancelled 状态', async () => {
    // slow 服务器：模拟慢速链路，让"传到一半取消"稳定可复现
    await withServer(async ({ port }) => {
      const dir = tmp()
      const { engine } = makeEngine({ port, accounts: [testAccount('zhang')] })
      engine.enqueue({ kind: 'download', accountId: 'acc_zhang', remotePath: '/', name: '大文件测试.bin', localPath: path.join(dir, 'x.bin') })
      // 等传输真正跑起来（已传出 1MB）再取消
      expect(await waitFor(() => engine.snapshot().some((t) => t.status === 'running' && t.transferred > 1024 * 1024))).toBe(true)
      engine.cancel(engine.snapshot().find((t) => t.status === 'running').id)
      expect(await waitFor(() => engine.snapshot().every((t) => ['cancelled', 'done'].includes(t.status)))).toBe(true)
      expect(engine.snapshot().some((t) => t.status === 'cancelled')).toBe(true)
      engine.destroy()
    }, { port: 2124, slow: true })
  })

  it('账号不存在 → 失败并给出可操作错误', async () => {
    await withServer(async ({ port }) => {
      const dir = tmp()
      const { engine } = makeEngine({ port, accounts: [] })
      engine.enqueue({ kind: 'upload', accountId: 'acc_none', remotePath: '/', name: 'a.txt', localPath: path.join(dir, 'a.txt') })
      expect(await waitFor(() => engine.snapshot().every((t) => t.status === 'failed'))).toBe(true)
      const t = engine.snapshot()[0]
      expect(t.error.title).toContain('账号不存在')
      expect(t.error.action).toBe('openSettings')
      engine.destroy()
    }, { port: PORT })
  })

  it('重试取消后的下载任务 → 断点续传完成', async () => {
    await withServer(async ({ port }) => {
      const dir = tmp()
      const { engine } = makeEngine({ port, accounts: [testAccount('zhang')] })
      const local = path.join(dir, 'resume.bin')
      engine.enqueue({ kind: 'download', accountId: 'acc_zhang', remotePath: '/', name: '大文件测试.bin', localPath: local })
      // 等传输真正跑起来再取消
      expect(await waitFor(() => engine.snapshot().some((t) => t.status === 'running' && t.transferred > 1024 * 1024))).toBe(true)
      engine.cancel(engine.snapshot().find((t) => t.status === 'running').id)
      expect(await waitFor(() => engine.snapshot().every((t) => t.status === 'cancelled'))).toBe(true)
      const partial = fs.existsSync(local) ? fs.statSync(local).size : 0
      expect(partial).toBeGreaterThan(0)
      // 重新入队同一个目标（模拟重试）：协议层检测本地已有部分 → REST 续传
      const id2 = engine.enqueue({ kind: 'download', accountId: 'acc_zhang', remotePath: '/', name: '大文件测试.bin', localPath: local })
      expect(await waitFor(() => engine.snapshot().find((t) => t.id === id2)?.status === 'done')).toBe(true)
      expect(fs.statSync(local).size).toBe(16 * 1024 * 1024)
      engine.destroy()
    }, { port: 2125, slow: true })
  })
})
