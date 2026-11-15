import { describe, it, expect } from 'vitest'
import path from 'node:path'
import fs from 'node:fs'
import os from 'node:os'
import { FtpSession } from '../../src/main/ftp/client.js'
import { walkRemoteTree } from '../../src/main/ftp/tree-download.js'
import { TransferEngine } from '../../src/main/ftp/transfer-engine.js'
import { withServer, testGlobal, testAccount, waitFor } from '../helpers.mjs'

const PORT = 2131

describe('文件夹整体下载', () => {
  it('walkRemoteTree 递归收集全部文件（含子目录）', async () => {
    await withServer(async ({ port }) => {
      const s = new FtpSession({ account: testAccount('zhang'), globalConfig: testGlobal(port) })
      try {
        const files = await walkRemoteTree(s, '/')
        const paths = files.map((f) => (f.dir === '/' ? `/${f.name}` : `${f.dir}/${f.name}`)).sort()
        expect(paths).toContain('/01-课件/第一章 绪论.pptx')
        expect(paths).toContain('/01-课件/教案.docx')
        expect(paths).toContain('/02-素材/图片 示例.png')
        expect(paths).toContain('/说明 文档.txt')
        expect(paths.some((p) => p.endsWith('/大文件测试.bin'))).toBe(true)
        expect(files.length).toBe(5)
      } finally { s.destroy() }
    }, { port: PORT })
  })

  it('walkRemoteTree 指定子目录时只收集该目录', async () => {
    await withServer(async ({ port }) => {
      const s = new FtpSession({ account: testAccount('zhang'), globalConfig: testGlobal(port) })
      try {
        const files = await walkRemoteTree(s, '/01-课件')
        expect(files.length).toBe(2)
        expect(files.every((f) => f.dir === '/01-课件')).toBe(true)
      } finally { s.destroy() }
    }, { port: PORT })
  })

  it('引擎下载自动创建多级本地目录（文件夹下载落子目录）', async () => {
    await withServer(async ({ port }) => {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'betterftp-tree-'))
      const engine = new TransferEngine({
        getConfig: () => ({ ...testGlobal(port), maxConcurrentTransfers: 2 }),
        findAccount: () => testAccount('zhang'),
        logger: { log: () => {} }
      })
      try {
        const localPath = path.join(dir, '张老师11.15', '01-课件', '第一章 绪论.pptx')
        const id = engine.enqueue({
          kind: 'download',
          accountId: 'acc_zhang',
          remotePath: '/01-课件',
          name: '第一章 绪论.pptx',
          localPath,
          total: null
        })
        expect(await waitFor(() => engine.snapshot().find((t) => t.id === id)?.status === 'done')).toBe(true)
        expect(fs.existsSync(localPath)).toBe(true)
        expect(fs.statSync(localPath).size).toBeGreaterThan(0)
      } finally {
        engine.destroy()
      }
    }, { port: PORT })
  })
})
