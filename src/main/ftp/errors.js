import { ERR_TEXTS as E, OP_NAMES } from '../texts.js'

/**
 * 把底层 FTP/网络错误翻译成老师能看懂的"原因 + 建议"。
 * 文案全部来自 src/main/texts.js（可集中修改）。
 * 返回结构：{ kind, title, hint, action }
 */

function errnoOf(err) {
  const e = err?.cause?.code || err?.code
  return typeof e === 'string' && e.startsWith('E') ? e : null
}

function ftpCodeOf(err) {
  if (Number.isInteger(err?.code) && err.code >= 400 && err.code < 600) return err.code
  const m = String(err?.message || '').match(/\b(4\d\d|5\d\d)\b/)
  return m ? Number(m[1]) : null
}

export function opName(op) {
  return OP_NAMES[op] || '操作'
}

/**
 * @param {Error} err FTP/网络错误
 * @param {{op?:string, phase?:'connect'|'data'|'ctrl', passive?:boolean}} ctx
 */
export function describeFtpError(err, ctx = {}) {
  const msg = String(err?.message || err || '')
  const code = ftpCodeOf(err)
  const errno = errnoOf(err)
  const passive = ctx.passive !== false

  // --- 认证失败 ---
  if (code === 530 || /530|Login incorrect|password|authentication/i.test(msg)) {
    return { kind: 'auth', ...E.auth, action: 'openSettings' }
  }

  // --- 连接数超限 ---
  if (code === 421 || /421|too many connections/i.test(msg)) {
    return { kind: 'toomany', ...E.toomany, action: 'openSettings' }
  }

  // --- 权限不足 / 不存在 ---
  if (code === 550 || /550|permission denied|not permitted|access denied/i.test(msg)) {
    const op = opName(ctx.op)
    if (ctx.op === 'retr' || ctx.op === 'list' || ctx.op === 'cwd') {
      return { kind: 'perm', title: E.permList.title(op), hint: E.permList.hint, action: 'openSettings' }
    }
    return { kind: 'perm', title: E.permOp.title(op), hint: E.permOp.hint, action: null }
  }

  // --- 被动模式被防火墙拦截：控制通道已通，数据通道"建立"失败 ---
  // 注意：传输中途的 ECONNRESET/EPIPE 不算（那是连接被中断，走下方 reset 分支提示重试）；
  // 防火墙拦截的表现是数据端口连不上（超时/拒绝/425）。
  const dataChannel = ctx.phase === 'data' || /data connection|passive|pasv|425/i.test(msg)
  if (dataChannel && (errno === 'ETIMEDOUT' || errno === 'ECONNREFUSED' || code === 425 || /timeout|passive/i.test(msg))) {
    return {
      kind: 'passive',
      title: E.passiveBlocked.title(passive),
      hint: passive ? E.passiveBlocked.hintPassive : E.passiveBlocked.hintActive,
      action: 'openSettings'
    }
  }

  // --- 端口不通：服务器没开或地址错误 ---
  if (errno === 'ECONNREFUSED') {
    return { kind: 'refused', ...E.refused, action: 'openSettings' }
  }

  // --- 连接超时 / 网络不可达 ---
  if (errno === 'ETIMEDOUT' || errno === 'EHOSTUNREACH' || errno === 'ENETUNREACH' || errno === 'ENETDOWN') {
    return { kind: 'timeout', ...E.timeout, action: 'openSettings' }
  }

  if (errno === 'ENOTFOUND') {
    return { kind: 'notfound', ...E.notfound, action: 'openSettings' }
  }

  // --- 传输中断 ---
  if (errno === 'ECONNRESET' || errno === 'EPIPE' || errno === 'ECONNABORTED') {
    return {
      kind: 'reset',
      title: ctx.phase === 'data' ? E.resetData.title : E.resetCtrl.title,
      hint: ctx.phase === 'data' ? E.resetData.hint : E.resetCtrl.hint,
      action: 'retry'
    }
  }

  // --- 兜底 ---
  return {
    kind: 'unknown',
    title: E.unknown.title(opName(ctx.op), msg.slice(0, 120) || '未知错误'),
    hint: E.unknown.hint,
    action: 'retry'
  }
}

/** IPC 抛错统一包装：renderer 收到 {code, title, hint, action} */
export class FtpOpError extends Error {
  constructor(err, ctx) {
    const d = describeFtpError(err, ctx)
    super(d.title)
    this.code = d.kind
    this.title = d.title
    this.hint = d.hint
    this.action = d.action
    this.raw = String(err?.message || err)
  }
  toJSON() {
    return { code: this.code, title: this.title, hint: this.hint, action: this.action, raw: this.raw }
  }
}
