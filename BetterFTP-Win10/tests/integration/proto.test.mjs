import { describe, it, expect, afterAll } from 'vitest'
import path from 'node:path'
import fs from 'node:fs'
import { FtpClient, FtpAbortedError } from '../../src/main/ftp/proto.js'
import { withServer, readFile } from '../helpers.mjs'

let rootDir
const PORT = 2211 // 避开 manual-server.mjs 常驻的 2121（用户可能开着它做手工演练）

// 每个用例通过 withServer 起独立服务器（启动 <100ms），用完即关，互不干扰
describe('FTP 协议层', () => {
  it('连接 + 列目录（中文文件名）', async () => {
    await withServer(async ({ port, rootDir: rd }) => {
      rootDir = rd
      const c = new FtpClient({ ...creds(), host: '127.0.0.1', port, encoding: 'utf-8', timeoutMs: 8000, passive: true })
      try {
        await c.connect()
        const items = await c.list('/')
        const names = items.map((i) => i.name).sort()
        expect(names).toContain('01-课件')
        expect(names).toContain('说明 文档.txt')
        const sub = await c.list('/01-课件')
        expect(sub.map((i) => i.name)).toContain('第一章 绪论.pptx')
      } finally { c.close() }
    }, { port: PORT })
  })

  it('密码错误 → 530', async () => {
    await withServer(async ({ port }) => {
      const c = new FtpClient({ host: '127.0.0.1', port, user: 'zhang', password: 'wrong', encoding: 'utf-8', timeoutMs: 8000, passive: true })
      try {
        await expect(c.connect()).rejects.toMatchObject({ code: 530 })
      } finally { try { c.close() } catch { /* */ } }
    }, { port: PORT })
  })

  it('mkdir / rename / delete', async () => {
    await withServer(async ({ port }) => {
      const c = new FtpClient({ ...creds(), host: '127.0.0.1', port, encoding: 'utf-8', timeoutMs: 8000, passive: true })
      try {
        await c.connect()
        await c.mkdir('/新建目录')
        expect((await c.list('/')).map((i) => i.name)).toContain('新建目录')
        await c.rename('/新建目录', '/改名目录')
        expect((await c.list('/')).map((i) => i.name)).toContain('改名目录')
        await c.deleteFile('/说明 文档.txt')
        expect((await c.list('/')).map((i) => i.name)).not.toContain('说明 文档.txt')
      } finally { c.close() }
    }, { port: PORT })
  })

  it('上传 Buffer 与文件，下载回来内容一致', async () => {
    await withServer(async ({ port, rootDir: rd }) => {
      rootDir = rd
      const c = new FtpClient({ ...creds(), host: '127.0.0.1', port, encoding: 'utf-8', timeoutMs: 8000, passive: true })
      try {
        await c.connect()
        const payload = Buffer.from('上传内容测试 UPLOAD-PAYLOAD-中文'.repeat(100))
        await c.upload('/上传的文件.bin', { srcBuffer: payload })
        expect(readFile(rootDir, 'zhang/上传的文件.bin').equals(payload)).toBe(true)

        const local = path.join(process.env.TEMP || '/tmp', `betterftp-test-${Date.now()}.bin`)
        await c.download('/上传的文件.bin', { destPath: local })
        expect(fs.readFileSync(local).equals(payload)).toBe(true)
        fs.unlinkSync(local)
      } finally { c.close() }
    }, { port: PORT })
  })

  it('SIZE 命令', async () => {
    await withServer(async ({ port }) => {
      const c = new FtpClient({ ...creds(), host: '127.0.0.1', port, encoding: 'utf-8', timeoutMs: 8000, passive: true })
      try {
        await c.connect()
        const sz = await c.size('/01-课件/第一章 绪论.pptx')
        expect(sz).toBe(readFile(rootDir, 'zhang/01-课件/第一章 绪论.pptx').length)
        expect(await c.size('/不存在.txt')).toBeNull()
      } finally { c.close() }
    }, { port: PORT })
  })

  it('REST 断点续传下载（跳过前半段）', async () => {
    await withServer(async ({ port, rootDir: rd }) => {
      rootDir = rd
      const full = readFile(rootDir, 'zhang/大文件测试.bin')
      const local = path.join(process.env.TEMP || '/tmp', `betterftp-resume-${Date.now()}.bin`)
      // 先写一半到本地
      fs.writeFileSync(local, full.slice(0, full.length >> 1))
      const c = new FtpClient({ ...creds(), host: '127.0.0.1', port, encoding: 'utf-8', timeoutMs: 8000, passive: true })
      try {
        await c.connect()
        await c.download('/大文件测试.bin', { destPath: local, size: full.length })
        expect(fs.readFileSync(local).equals(full)).toBe(true)
      } finally { c.close(); try { fs.unlinkSync(local) } catch { /* */ } }
    }, { port: PORT })
  })

  it('主动模式（PORT）下载', async () => {
    await withServer(async ({ port, rootDir: rd }) => {
      rootDir = rd
      const local = path.join(process.env.TEMP || '/tmp', `betterftp-active-${Date.now()}.txt`)
      const c = new FtpClient({ ...creds(), host: '127.0.0.1', port, encoding: 'utf-8', timeoutMs: 8000, passive: false })
      try {
        await c.connect()
        await c.download('/说明 文档.txt', { destPath: local })
        expect(fs.readFileSync(local, 'utf8')).toBe('说明内容')
      } finally { c.close(); try { fs.unlinkSync(local) } catch { /* */ } }
    }, { port: PORT })
  })

  it('取消下载 → FtpAbortedError', async () => {
    await withServer(async ({ port }) => {
      const c = new FtpClient({ ...creds(), host: '127.0.0.1', port, encoding: 'utf-8', timeoutMs: 8000, passive: true })
      const ac = new AbortController()
      try {
        await c.connect()
        const local = path.join(process.env.TEMP || '/tmp', `betterftp-abort-${Date.now()}.bin`)
        // 先等传输真正开始（首个进度回调），再取消，避免回环太快取消跟不上
        let started = false
        const p = c.download('/大文件测试.bin', { destPath: local, signal: ac.signal, onProgress: () => { started = true } })
        const t0 = Date.now()
        while (!started && Date.now() - t0 < 8000) await new Promise((r) => setTimeout(r, 20))
        expect(started).toBe(true)
        ac.abort()
        await expect(p).rejects.toBeInstanceOf(FtpAbortedError)
        try { fs.unlinkSync(local) } catch { /* */ }
      } finally { c.close() }
    }, { port: PORT })
  })

  it('连不存在端口 → ETIMEDOUT/ECONNREFUSED', async () => {
    await withServer(async () => {
      const c = new FtpClient({ host: '127.0.0.1', port: 2999, user: 'zhang', password: 'x', encoding: 'utf-8', timeoutMs: 3000, passive: true })
      try {
        await expect(c.connect()).rejects.toMatchObject({ code: expect.stringMatching(/ECONNREFUSED|ETIMEDOUT/) })
      } catch (e) {
        // Windows 上对未监听端口快速回 RST → ECONNRESET 也可能；允许其一
        expect(['ECONNRESET']).toContain(e.code)
      } finally { try { c.close() } catch { /* */ } }
    }, { port: PORT })
  })

  it('多行回复解析（FEAT 风格）不干扰后续命令', async () => {
    await withServer(async ({ port }) => {
      const c = new FtpClient({ ...creds(), host: '127.0.0.1', port, encoding: 'utf-8', timeoutMs: 8000, passive: true })
      try {
        await c.connect()
        for (let i = 0; i < 3; i++) {
          const items = await c.list('/')
          expect(items.length).toBeGreaterThan(0)
        }
      } finally { c.close() }
    }, { port: PORT })
  })
})

function creds() {
  return { user: 'zhang', password: '123456' }
}

afterAll(() => { void rootDir })
