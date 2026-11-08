import { describe, it, expect } from 'vitest'
import { describeFtpError } from '../../src/main/ftp/errors.js'

const E = (code, msg) => Object.assign(new Error(msg || 'x'), { code })

describe('错误映射 describeFtpError', () => {
  it('530 → 认证失败，提示去设置', () => {
    const d = describeFtpError(E(530, '530 Login incorrect'), { phase: 'connect' })
    expect(d.kind).toBe('auth')
    expect(d.title).toContain('密码')
    expect(d.action).toBe('openSettings')
  })

  it('421 → 连接数超限，提示降并发', () => {
    const d = describeFtpError(E(421, '421 Too many connections'), { phase: 'connect' })
    expect(d.kind).toBe('toomany')
    expect(d.hint).toContain('并发')
  })

  it('550 上传 → 权限不足', () => {
    const d = describeFtpError(E(550, '550 Access denied'), { op: 'stor' })
    expect(d.kind).toBe('perm')
    expect(d.title).toContain('上传')
  })

  it('550 列目录 → 权限不足或路径不存在，提示编码', () => {
    const d = describeFtpError(E(550, '550 No such file'), { op: 'list' })
    expect(d.kind).toBe('perm')
    expect(d.hint).toContain('编码')
  })

  it('ECONNREFUSED → 端口不通', () => {
    const d = describeFtpError(E('ECONNREFUSED', 'connect ECONNREFUSED 10.0.0.1:21'), { phase: 'connect' })
    expect(d.kind).toBe('refused')
    expect(d.title).toContain('端口不通')
  })

  it('ETIMEDOUT → 连接超时', () => {
    const d = describeFtpError(E('ETIMEDOUT', 'connect ETIMEDOUT'), { phase: 'connect' })
    expect(d.kind).toBe('timeout')
    expect(d.hint).toContain('校园网')
  })

  it('ENOTFOUND → 地址错误', () => {
    const d = describeFtpError(E('ENOTFOUND', 'getaddrinfo ENOTFOUND foo'), { phase: 'connect' })
    expect(d.kind).toBe('notfound')
  })

  it('被动模式数据通道超时 → 提示防火墙拦截并切主动模式', () => {
    const d = describeFtpError(E('ETIMEDOUT', 'data connection timeout (passive)'), { phase: 'data', passive: true })
    expect(d.kind).toBe('passive')
    expect(d.hint).toContain('被动')
    expect(d.hint).toContain('主动')
    expect(d.action).toBe('openSettings')
  })

  it('主动模式数据通道失败 → 提示恢复被动', () => {
    const d = describeFtpError(E('ETIMEDOUT', 'data connection timeout (active)'), { phase: 'data', passive: false })
    expect(d.kind).toBe('passive')
    expect(d.hint).toContain('被动模式')
  })

  it('425 → 数据通道问题', () => {
    const d = describeFtpError(E(425, "425 Can't open data connection"), { op: 'list' })
    expect(d.kind).toBe('passive')
  })

  it('ECONNRESET 传输中 → 提示重试', () => {
    const d = describeFtpError(E('ECONNRESET', 'socket hang up'), { op: 'retr', phase: 'data' })
    expect(d.kind).toBe('reset')
    expect(d.action).toBe('retry')
  })

  it('未知错误兜底 → 包含原始消息', () => {
    const d = describeFtpError(new Error('something weird'), { op: 'mkd' })
    expect(d.kind).toBe('unknown')
    expect(d.title).toContain('something weird')
  })

  it('从消息文本中提取 5xx 码（无整数 code 时）', () => {
    const d = describeFtpError(new Error('550 permission denied for /x'), { op: 'dele' })
    expect(d.kind).toBe('perm')
  })
})
