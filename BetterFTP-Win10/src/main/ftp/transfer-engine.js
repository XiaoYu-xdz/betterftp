import { EventEmitter } from 'node:events'
import fs from 'node:fs'
import path from 'node:path'
import { FtpClient, FtpAbortedError, FtpProtocolError } from './proto.js'
import { FtpOpError, describeFtpError } from './errors.js'
import { ERR_TEXTS as E } from '../texts.js'

let SEQ = 0

/**
 * 传输引擎：队列 + 独立连接池。
 * - 每个任务用自己的 FtpClient 连接（与浏览连接分离），切换页面/账号不影响传输。
 * - 断点续传：下载重试时按本地已有字节数 REST 续传（协议层实现）；上传重试从头传。
 * - 事件 'updated'（任务快照数组，含节流后的进度）推给渲染进程。
 */
export class TransferEngine extends EventEmitter {
  /**
   * @param {() => object} getConfig 返回最新全局配置（并发数可运行时调整）
   * @param {(account) => object} findAccount 按 id 找账号配置
   * @param {{log: Function}} logger 操作日志
   */
  constructor({ getConfig, findAccount, logger }) {
    super()
    this.getConfig = getConfig
    this.findAccount = findAccount
    this.logger = logger
    this.tasks = new Map() // id -> task
    this._signals = new Map() // id -> AbortController
    this._running = 0
    this.setMaxListeners(50)
  }

  snapshot() {
    return [...this.tasks.values()].map((t) => this.#publicTask(t))
  }

  #publicTask(t) {
    return {
      id: t.id,
      kind: t.kind,                    // 'upload' | 'download'
      accountId: t.accountId,
      accountName: t.accountName,
      color: t.color,
      name: t.name,                    // 文件名
      remotePath: t.remotePath,        // 所在目录（上传目标/下载来源目录）
      localPath: t.localPath,
      total: t.total,
      transferred: t.transferred,
      status: t.status,                // pending|running|done|failed|cancelled
      speed: t.speed,                  // 字节/秒（null=未知）
      eta: t.eta,                      // 秒（null=未知）
      error: t.error,                  // {title, hint, action} | null
      retryOf: t.retryOf
    }
  }

  #emitUpdated() {
    this.emit('updated', this.snapshot())
  }

  /**
   * 入队一个任务。
   * @param {{kind:'upload'|'download', accountId, remotePath, name, localPath,
   *          total?:number|null, autoStart?:boolean}} spec
   */
  enqueue(spec) {
    const account = this.findAccount(spec.accountId)
    const task = {
      id: `t${++SEQ}_${Date.now().toString(36)}`,
      kind: spec.kind,
      accountId: spec.accountId,
      accountName: account?.displayName || spec.accountId,
      color: account?.color || '#3B82F6',
      name: spec.name,
      remotePath: spec.remotePath,
      localPath: spec.localPath,
      total: spec.total ?? null,
      transferred: 0,
      status: 'pending',
      speed: null,
      eta: null,
      error: null,
      retryOf: 0,
      _speedWindow: null
    }
    this.tasks.set(task.id, task)
    this.#emitUpdated()
    setImmediate(() => this.#pump())
    return task.id
  }

  /** 取消：pending 直接标记；running 通过 AbortController 中断数据通道 */
  cancel(id) {
    const task = this.tasks.get(id)
    if (!task) return
    if (task.status === 'pending') {
      task.status = 'cancelled'
      this.#emitUpdated()
    } else if (task.status === 'running') {
      this._signals.get(id)?.abort()
    }
  }

  remove(id) {
    const task = this.tasks.get(id)
    if (task && (task.status === 'running' || task.status === 'pending')) {
      this.cancel(id)
    }
    if (!task || task.status !== 'running') {
      this.tasks.delete(id)
      this.#emitUpdated()
    }
  }

  /** 重试失败任务（下载自动断点续传） */
  retry(id) {
    const task = this.tasks.get(id)
    if (!task || task.status !== 'failed') return
    task.status = 'pending'
    task.error = null
    task.speed = null
    task.eta = null
    task.retryOf++
    // 下载续传：transferred 重置为本地已有字节数（协议层按 destPath 大小 REST）
    if (task.kind === 'download') {
      try {
        task.transferred = fs.existsSync(task.localPath) ? fs.statSync(task.localPath).size : 0
        if (task.total && task.transferred >= task.total) task.transferred = 0 // 已完整？重传
      } catch { task.transferred = 0 }
    } else {
      task.transferred = 0
    }
    this.#emitUpdated()
    setImmediate(() => this.#pump())
  }

  #pump() {
    const max = Math.max(1, Math.min(5, this.getConfig().maxConcurrentTransfers || 2))
    while (this._running < max) {
      const next = [...this.tasks.values()].find((t) => t.status === 'pending')
      if (!next) break
      this.#start(next)
    }
  }

  async #start(task) {
    this._running++
    task.status = 'running'
    task.speed = null
    task.eta = null
    task._speedWindow = { t0: Date.now(), b0: task.transferred, last: Date.now() }
    this.#emitUpdated()

    const ac = new AbortController()
    this._signals.set(task.id, ac)

    try {
      const account = this.findAccount(task.accountId)
      if (!account) throw Object.assign(new Error(E.engine.noAccount.title), { kind: 'noaccount' })
      const g = this.getConfig()
      const client = new FtpClient({
        host: g.server.host,
        port: g.server.port,
        user: account.username,
        password: account.password,
        encoding: account.encoding || (g.encoding === 'gbk' ? 'gbk' : 'utf-8'),
        timeoutMs: g.timeoutMs || 30000,
        passive: g.passive !== false
      })
      try {
        await client.connect()
        await this.#doTransfer(client, task, ac.signal)
      } finally {
        try { client.close() } catch { /* ignore */ }
      }
      task.status = 'done'
      task.transferred = task.total ?? task.transferred
      task.speed = null
      task.eta = null
      this.logger.log({
        account: task.accountName,
        action: task.kind,
        path: path.posix.join(task.remotePath, task.name),
        result: '成功'
      })
    } catch (err) {
      await this.#onTaskError(task, err)
    } finally {
      this._signals.delete(task.id)
      this._running--
      this.#emitUpdated()
      this.#pump()
    }
  }

  async #doTransfer(client, task, signal) {
    const remoteFull = path.posix.join(task.remotePath, task.name)
    if (task.kind === 'download') {
      // 目标大小：优先 SIZE（用于进度与续传）
      if (!task.total) {
        const sz = await client.size(remoteFull).catch(() => null)
        task.total = sz
      }
      await client.download(remoteFull, {
        destPath: task.localPath,
        size: task.total,
        signal,
        onProgress: (transferred) => this.#progress(task, transferred)
      })
    } else {
      await client.upload(remoteFull, {
        srcPath: task.localPath,
        signal,
        onProgress: (transferred) => this.#progress(task, transferred)
      })
    }
  }

  #progress(task, transferred) {
    task.transferred = transferred
    const w = task._speedWindow
    if (w) {
      const now = Date.now()
      const dt = (now - w.last) / 1000
      if (dt >= 0.5) {
        task.speed = (transferred - w.b0) / ((now - w.t0) / 1000)
        w.last = now
        if (task.total && task.total > transferred && task.speed > 0) {
          task.eta = Math.round((task.total - transferred) / task.speed)
        } else {
          task.eta = null
        }
      }
    }
    this.#emitUpdated()
  }

  async #onTaskError(task, err) {
    // 传输中断线自动重试一次（下载利用 REST 续传）
    const resetLike = err?.code === 'ECONNRESET' || err?.code === 'EPIPE' || err?.code === 'ECONNABORTED'
    if (resetLike && task.retryOf < 1 && !this._signals.get(task.id)?.aborted) {
      task.retryOf++
      task.transferred = task.kind === 'download' && fs.existsSync(task.localPath)
        ? fs.statSync(task.localPath).size
        : 0
      task.status = 'pending'
      this.#emitUpdated()
      setImmediate(() => this.#pump())
      return
    }

    if (err instanceof FtpAbortedError) {
      task.status = 'cancelled'
      task.error = null
      this.logger.log({
        account: task.accountName,
        action: task.kind,
        path: path.posix.join(task.remotePath, task.name),
        result: '已取消'
      })
      return
    }

    task.status = 'failed'
    const ctx = { op: task.kind === 'upload' ? 'stor' : 'retr', phase: 'data', passive: this.getConfig().passive !== false }
    if (err instanceof FtpOpError) {
      task.error = { title: err.title, hint: err.hint, action: err.action }
    } else if (err instanceof FtpProtocolError || Number.isInteger(err?.code)) {
      const d = describeFtpError(err, ctx)
      task.error = { title: d.title, hint: d.hint, action: d.action }
    } else if (err?.kind === 'noaccount') {
      task.error = { title: E.engine.noAccount.title, hint: E.engine.noAccount.hint, action: E.engine.noAccount.action }
    } else if (err?.code === 'ENOENT' || err?.code === 'EPERM' || err?.code === 'EACCES') {
      task.error = {
        title: E.engine.localWrite.title,
        hint: E.engine.localWrite.hint(err.code),
        action: null
      }
    } else {
      const d = describeFtpError(err, ctx)
      task.error = { title: d.title, hint: d.hint, action: d.action }
    }
    this.logger.log({
      account: task.accountName,
      action: task.kind,
      path: path.posix.join(task.remotePath, task.name),
      result: `失败:${task.error.title}`
    })
  }

  destroy() {
    for (const ac of this._signals.values()) ac.abort()
    this.tasks.clear()
  }
}
