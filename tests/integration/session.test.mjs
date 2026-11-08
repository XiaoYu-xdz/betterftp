import { describe, it, expect } from 'vitest'
import { FtpSession } from '../../src/main/ftp/client.js'
import { FtpOpError } from '../../src/main/ftp/errors.js'
import { withServer, testGlobal, testAccount } from '../helpers.mjs'

const PORT = 2122

describe('FTP 会话层（编码检测 / 权限探测 / 导航回退）', () => {
  it('enterDir 正常进入并列出，权限探测为 rw', async () => {
    await withServer(async ({ port }) => {
      const s = new FtpSession({ account: testAccount('zhang'), globalConfig: testGlobal(port) })
      try {
        const res = await s.enterDir('/01-课件')
        expect(res.path).toBe('/01-课件')
        expect(res.items.map((i) => i.name)).toContain('第一章 绪论.pptx')
        expect(res.perms).toBe('rw')
      } finally { s.destroy() }
    }, { port: PORT })
  })

  it('auto 编码：UTF-8 服务器文件名正常', async () => {
    await withServer(async ({ port }) => {
      const s = new FtpSession({ account: testAccount('zhang'), globalConfig: testGlobal(port) })
      try {
        const res = await s.enterDir('/')
        expect(s.getEncoding()).toBe('utf-8')
        expect(res.items.some((i) => i.name.includes('课件'))).toBe(true)
      } finally { s.destroy() }
    }, { port: PORT })
  })

  it('auto 编码：GBK 服务器自动切换并正确解码', async () => {
    await withServer(async ({ port }) => {
      const s = new FtpSession({ account: testAccount('zhang'), globalConfig: testGlobal(port) })
      try {
        const res = await s.enterDir('/')
        expect(s.getEncoding()).toBe('gbk')
        // 服务器目录里是 UTF-8 名，经 GBK 编码传输、GBK 解码后应还原为原名
        expect(res.items.some((i) => i.name.includes('\uFFFD'))).toBe(false)
        expect(res.items.map((i) => i.name)).toContain('说明 文档.txt')
        const sub = await s.enterDir('/01-课件')
        expect(sub.items.map((i) => i.name)).toContain('第一章 绪论.pptx')
      } finally { s.destroy() }
    }, { port: PORT, gbk: true })
  })

  it('只读账号：列目录成功、权限 ro、上传被拒', async () => {
    await withServer(async ({ port }) => {
      const s = new FtpSession({ account: testAccount('ro'), globalConfig: testGlobal(port) })
      try {
        const res = await s.enterDir('/')
        expect(res.perms).toBe('ro')
        expect(res.items.map((i) => i.name)).toContain('共享课件.pdf')
        await expect(s.mkdir('/', '新目录')).rejects.toBeInstanceOf(FtpOpError)
        const err = await s.mkdir('/', '新目录').catch((e) => e)
        expect(err.code).toBe('perm')
      } finally { s.destroy() }
    }, { port: PORT })
  })

  it('只写账号（投递箱）：列目录被拒 → 探测为只写，可上传', async () => {
    await withServer(async ({ port }) => {
      const s = new FtpSession({ account: testAccount('drop'), globalConfig: testGlobal(port) })
      try {
        const res = await s.enterDir('/')
        expect(res.perms).toBe('w')
        expect(res.items).toEqual([])
        await s.mkdir('/', '投递的目录')
        // 直接用会话层探针验证写权限（probePerms 也被 enterDir 内部调用过）
        expect(await s.probePerms('/', false)).toBe('w')
      } finally { s.destroy() }
    }, { port: PORT })
  })

  it('默认路径不存在 → 回退根目录并带 fellBack 标记', async () => {
    await withServer(async ({ port }) => {
      const s = new FtpSession({
        account: testAccount('zhang', { remotePath: '/不存在的目录' }),
        globalConfig: testGlobal(port)
      })
      try {
        const res = await s.enterDir('/不存在的目录')
        expect(res.path).toBe('/')
        expect(res.fellBack).toBe('/不存在的目录')
      } finally { s.destroy() }
    }, { port: PORT })
  })

  it('goParent / refresh', async () => {
    await withServer(async ({ port }) => {
      const s = new FtpSession({ account: testAccount('zhang'), globalConfig: testGlobal(port) })
      try {
        await s.enterDir('/01-课件')
        const parent = await s.goParent()
        expect(parent.path).toBe('/')
        const again = await s.refresh()
        expect(again.path).toBe('/')
      } finally { s.destroy() }
    }, { port: PORT })
  })

  it('递归删除目录', async () => {
    await withServer(async ({ port, rootDir }) => {
      const s = new FtpSession({ account: testAccount('zhang'), globalConfig: testGlobal(port) })
      try {
        await s.deleteDir('/01-课件')
        const items = (await s.enterDir('/')).items
        expect(items.map((i) => i.name)).not.toContain('01-课件')
        void rootDir
      } finally { s.destroy() }
    }, { port: PORT })
  })

  it('rename 与 mkdir', async () => {
    await withServer(async ({ port }) => {
      const s = new FtpSession({ account: testAccount('zhang'), globalConfig: testGlobal(port) })
      try {
        await s.mkdir('/', '临时目录')
        await s.rename('/', '临时目录', '临时目录2')
        const names = (await s.enterDir('/')).items.map((i) => i.name)
        expect(names).toContain('临时目录2')
      } finally { s.destroy() }
    }, { port: PORT })
  })
})
