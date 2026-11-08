import { describe, it, expect } from 'vitest'
import { migrate, sortAccounts, validateImport, defaultConfig, normalizeHost, validateServerAddress } from '../../src/main/store/config.js'
import { normalizeRemotePath, joinRemote, parentRemote, breadcrumbOf, dedupeName, splitLocalPath } from '../../src/main/ftp/paths-util.js'
import { hasReplacementChar, looksGarbled, resolveDetectedEncoding } from '../../src/main/ftp/encoding.js'
import { OperationLogger } from '../../src/main/store/logger.js'

describe('配置迁移 migrate', () => {
  it('空配置 → 默认配置', () => {
    const cfg = migrate(null)
    expect(cfg.global.server.host).toBe('10.180.168.3')
    expect(cfg.global.server.port).toBe(21)
    expect(cfg.accounts).toEqual([])
  })

  it('补全账号缺失字段', () => {
    const cfg = migrate({
      accounts: [{ displayName: '张老师', username: 'zhang' }]
    })
    const a = cfg.accounts[0]
    expect(a.id).toBeTruthy()
    expect(a.remotePath).toBe('/')
    expect(a.password).toBe('')
    expect(a.color).toMatch(/^#[0-9A-Fa-f]{6}$/)
    expect(a.order).toBe(0)
  })

  it('非法编码回退 null（跟随全局）', () => {
    const cfg = migrate({ accounts: [{ username: 'x', encoding: 'latin1' }] })
    expect(cfg.accounts[0].encoding).toBeNull()
  })

  it('并发数夹在 1..5', () => {
    expect(migrate({ global: { maxConcurrentTransfers: 99 } }).global.maxConcurrentTransfers).toBe(5)
    expect(migrate({ global: { maxConcurrentTransfers: 0 } }).global.maxConcurrentTransfers).toBe(1)
  })

  it('端口非法回退 21', () => {
    expect(migrate({ global: { server: { port: 0 } } }).global.server.port).toBe(21)
  })

  it('地址带 ftp:// 前缀/路径 → migrate 自动规范为纯 IP', () => {
    expect(migrate({ global: { server: { host: 'ftp://10.180.168.3/' } } }).global.server.host).toBe('10.180.168.3')
    expect(migrate({ global: { server: { host: 'ftp://10.180.168.3/teachers' } } }).global.server.host).toBe('10.180.168.3')
    expect(migrate({ global: { server: { host: ' 10.180.168.3 ' } } }).global.server.host).toBe('10.180.168.3')
  })

  it('地址带端口（如 127.0.0.1:2121）→ migrate 拆出端口', () => {
    const g = migrate({ global: { server: { host: '127.0.0.1:2121', port: 21 } } }).global.server
    expect(g.host).toBe('127.0.0.1')
    expect(g.port).toBe(2121)
  })
})

describe('服务器地址校验', () => {
  it('normalizeHost：去前缀/路径/空白', () => {
    expect(normalizeHost('ftp://10.180.168.3/')).toBe('10.180.168.3')
    expect(normalizeHost('FTP://10.180.168.3/teachers')).toBe('10.180.168.3')
    expect(normalizeHost(' 127.0.0.1 ')).toBe('127.0.0.1')
    expect(normalizeHost('ftp.school.edu')).toBe('ftp.school.edu')
  })
  it('validateServerAddress：精确提示各类错误填法', () => {
    expect(validateServerAddress('')).toContain('不能为空')
    expect(validateServerAddress('ftp://10.180.168.3')).toContain('前缀')
    expect(validateServerAddress('10.180.168.3/')).toContain('路径')
    expect(validateServerAddress('127.0.0.1:2121')).toContain('端口')
    expect(validateServerAddress('服务器!!')).toContain('格式不对')
    expect(validateServerAddress('10.180.168.3')).toBeNull()
    expect(validateServerAddress('ftp.school.edu')).toBeNull()
  })

  it('validateImport 拦截坏结构', () => {
    expect(validateImport(null)).toBeTruthy()
    expect(validateImport({ accounts: 'x' })).toBeTruthy()
    expect(validateImport({ accounts: [] })).toBeNull()
  })

  it('sortAccounts 按 order 排序', () => {
    const sorted = sortAccounts([
      { id: 'b', order: 2 }, { id: 'a', order: 1 }, { id: 'c', order: 3 }
    ])
    expect(sorted.map((a) => a.id)).toEqual(['a', 'b', 'c'])
  })
})

describe('远程路径工具', () => {
  it('normalizeRemotePath', () => {
    expect(normalizeRemotePath('')).toBe('/')
    expect(normalizeRemotePath('\\a\\b\\')).toBe('/a/b')
    expect(normalizeRemotePath('a//b')).toBe('/a/b')
    expect(normalizeRemotePath('/')).toBe('/')
  })
  it('joinRemote', () => {
    expect(joinRemote('/', 'a')).toBe('/a')
    expect(joinRemote('/a', 'b')).toBe('/a/b')
  })
  it('parentRemote', () => {
    expect(parentRemote('/')).toBeNull()
    expect(parentRemote('/a')).toBe('/')
    expect(parentRemote('/a/b')).toBe('/a')
  })
  it('breadcrumbOf', () => {
    const c = breadcrumbOf('/课件/数学')
    expect(c.map((x) => x.name)).toEqual(['根目录', '课件', '数学'])
    expect(c[2].path).toBe('/课件/数学')
  })
  it('dedupeName', () => {
    expect(dedupeName('a.txt', ['b.txt'])).toBe('a.txt')
    expect(dedupeName('a.txt', ['a.txt'])).toBe('a (1).txt')
    expect(dedupeName('a.txt', ['a.txt', 'a (1).txt'])).toBe('a (2).txt')
    expect(dedupeName('无扩展', ['无扩展'])).toBe('无扩展 (1)')
  })
  it('splitLocalPath', () => {
    const s = splitLocalPath('C:\\Users\\x\\桌面\\课件.pptx')
    expect(s.name).toBe('课件.pptx')
    expect(s.ext).toBe('pptx')
    expect(s.dir).toBe('C:/Users/x/桌面')
  })
})

describe('编码检测', () => {
  it('utf-8 正常 → utf-8', () => {
    expect(resolveDetectedEncoding({ utf8Names: ['课件', 'a.txt'] })).toBe('utf-8')
  })
  it('utf-8 出现替换符 → gbk', () => {
    expect(resolveDetectedEncoding({ utf8Names: ['数学\ufffd课件'], gbkNames: ['数学课件'] })).toBe('gbk')
  })
  it('hasReplacementChar / looksGarbled', () => {
    expect(hasReplacementChar(['ok.txt'])).toBe(false)
    expect(hasReplacementChar(['\ufffd\ufffd'])).toBe(true)
    expect(looksGarbled(['涓枃浠跺す'])).toBe(true)
    expect(looksGarbled(['数学课件.pptx'])).toBe(false)
  })
})

describe('操作日志 CSV', () => {
  it('导出 CSV 含 BOM 与转义', () => {
    const csv = OperationLogger.toCsv([
      { time: '2026-11-06T10:00:00.000Z', account: '张老师', action: 'upload', path: '/a"b.pptx', result: '成功' }
    ])
    expect(csv.charCodeAt(0)).toBe(0xFEFF)
    expect(csv).toContain('"张老师"')
    expect(csv).toContain('""b.pptx')
  })
})
