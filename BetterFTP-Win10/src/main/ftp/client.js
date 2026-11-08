import { FtpClient, FtpAbortedError } from './proto.js'
import { parseListBuffer } from './parse-list.js'
import { FtpOpError } from './errors.js'
import { hasReplacementChar, toIconvEncoding } from './encoding.js'
import { normalizeRemotePath, joinRemote, parentRemote } from './paths-util.js'

const CONN_DROP = /closed|not connected|EPIPE|ECONNRESET|ETIMEDOUT/i

/** 把协议层返回的原始条目归一化为界面用结构 */
function normalizeItems(items) {
  const list = items.map((f) => ({
    name: f.name,
    isDir: !!f.isDir,
    size: Number.isFinite(f.size) ? f.size : null,
    modifiedAt: f.modifiedAt instanceof Date && !Number.isNaN(f.modifiedAt.getTime())
      ? f.modifiedAt.toISOString()
      : null,
    rights: f.rights || null
  }))
  const zh = 'zh-Hans-CN'
  list.sort((a, b) => {
    if (a.isDir !== b.isDir) return a.isDir ? -1 : 1
    return a.name.localeCompare(b.name, zh, { numeric: true })
  })
  return list
}

/** 一个账号的"浏览连接"：列目录/导航/文件管理。传输走传输引擎的独立连接，互不影响。 */
export class FtpSession {
  constructor({ account, globalConfig }) {
    this.account = account
    this.globalConfig = globalConfig
    this.client = null
    this.encoding = null        // 已解析编码：'utf-8' | 'gbk'
    this.currentPath = null
    this.permsCache = new Map() // remotePath -> 'rw'|'ro'|'w'|'none'|'unknown'
    this._encodingChecked = false
  }

  #preferredEncoding() {
    const pref = this.account.encoding || this.globalConfig.encoding || 'auto'
    return pref === 'auto' ? 'utf-8' : pref
  }

  #newClient() {
    const g = this.globalConfig
    return new FtpClient({
      host: g.server.host,
      port: g.server.port,
      user: this.account.username,
      password: this.account.password,
      encoding: toIconvEncoding(this.encoding || this.#preferredEncoding()),
      timeoutMs: g.timeoutMs || 30000,
      passive: g.passive !== false
    })
  }

  async #connect() {
    if (this.encoding === null) this.encoding = this.#preferredEncoding()
    const client = this.#newClient()
    try {
      await client.connect()
    } catch (err) {
      try { client.close() } catch { /* ignore */ }
      throw new FtpOpError(err, { op: 'connect', phase: 'connect', passive: this.globalConfig.passive !== false })
    }
    this.client = client
    this._encodingChecked = (this.account.encoding || this.globalConfig.encoding || 'auto') !== 'auto'
    return client
  }

  /** 操作包装：断线静默重连一次 + 错误翻译 */
  async #withConn(fn, ctx) {
    if (!this.client || this.client.closed) {
      await this.#connect()
      if (this.encoding) this.client.setEncoding(this.encoding)
    }
    try {
      return await fn(this.client)
    } catch (err) {
      if (err instanceof FtpOpError) throw err
      if (err instanceof FtpAbortedError) throw err
      if (this.client?.closed || CONN_DROP.test(String(err?.message || '')) || err?.code === 'ENOTCONN') {
        // 控制连接已断：重连一次再试（登录失败等在 #connect 内已抛出）
        try {
          await this.#connect()
          if (this.encoding) this.client.setEncoding(this.encoding)
          return await fn(this.client)
        } catch (e2) {
          if (e2 instanceof FtpOpError) throw e2
          throw new FtpOpError(e2, { ...ctx, passive: this.globalConfig.passive !== false })
        }
      }
      throw new FtpOpError(err, { ...ctx, passive: this.globalConfig.passive !== false })
    }
  }

  get connected() {
    return !!this.client && !this.client.closed
  }

  /** 列目录：auto 编码时用原始字节做检测，乱码则换编码重新解码（不重发命令） */
  async #rawList(remotePath) {
    const p = normalizeRemotePath(remotePath)
    const raw = await this.#withConn((c) => c.listRaw(p), { op: 'list', phase: 'data' })

    let enc = this.encoding || 'utf-8'
    let items = parseListBuffer(raw, enc)
    if (!this._encodingChecked && hasReplacementChar(items.map((i) => i.name))) {
      // UTF-8 解码出现替换符 → 服务器是 GBK，换编码重解码并记住
      enc = 'gbk'
      this.encoding = 'gbk'
      this.client?.setEncoding('gbk')
      items = parseListBuffer(raw, enc)
    }
    this._encodingChecked = true
    return normalizeItems(items)
  }

  /** 进入目录：返回 {path, items, perms}；不可进时视情况探测只写权限或回根目录 */
  async enterDir(remotePath, { fallbackToRoot = true } = {}) {
    const want = normalizeRemotePath(remotePath || '/')
    try {
      const items = await this.#rawList(want)
      this.currentPath = want
      const perms = await this.#permsFor(want, true)
      return { path: want, items, perms }
    } catch (err) {
      if (err instanceof FtpOpError && (err.code === 'perm' || err.code === 'notfound')) {
        // 列目录被拒：可能是只写目录（可上传不可列）——探测写权限。
        // 注意根目录也可能是投递箱，探测不分根/非根。
        let probe = 'unknown'
        try {
          probe = await this.probePerms(want, false)
        } catch { /* 探测失败按原错误走 */ }
        if (probe === 'w') {
          this.currentPath = want
          this.permsCache.set(want, 'w')
          return { path: want, items: [], perms: 'w' }
        }
        if (probe === 'none' || probe === 'unknown') {
          // 真没权限（或探测失败）：非根目录回退根目录并标记，根目录把原错误抛出
          if (want !== '/' && fallbackToRoot) {
            const res = await this.enterDir('/', { fallbackToRoot: false })
            res.fellBack = want
            return res
          }
        }
      }
      throw err
    }
  }

  refresh() {
    return this.enterDir(this.currentPath || '/', { fallbackToRoot: false })
  }

  goParent() {
    const parent = parentRemote(this.currentPath || '/')
    return this.enterDir(parent || '/', { fallbackToRoot: false })
  }

  /** 目录权限（会话内缓存） */
  async #permsFor(remotePath, listOk) {
    const key = normalizeRemotePath(remotePath)
    if (this.permsCache.has(key)) return this.permsCache.get(key)
    const perm = await this.probePerms(remotePath, listOk)
    this.permsCache.set(key, perm)
    return perm
  }

  clearPermsCache() {
    this.permsCache.clear()
  }

  /**
   * 主动探测目录权限：上传 0 字节探针文件（随后删除，删除失败不影响判定）。
   * 返回 'rw' | 'ro' | 'w' | 'none' | 'unknown'（网络异常按 unknown，操作失败时再给具体提示）。
   */
  async probePerms(remotePath, listOk) {
    const probeName = `.betterftp-probe-${Date.now().toString(36)}`
    const probePath = joinRemote(remotePath, probeName)
    try {
      await this.#withConn((c) => c.upload(probePath, { srcBuffer: Buffer.alloc(0) }), {
        op: 'stor', phase: 'data'
      })
    } catch (err) {
      if (err instanceof FtpOpError && err.code === 'perm') {
        return listOk ? 'ro' : 'none'
      }
      return 'unknown'
    }
    try {
      await this.#withConn((c) => c.deleteFile(probePath), { op: 'dele', phase: 'ctrl' })
    } catch { /* 探针删不掉不影响写判定 */ }
    return listOk ? 'rw' : 'w'
  }

  async mkdir(dirPath, name) {
    const full = joinRemote(dirPath, name)
    await this.#withConn((c) => c.mkdir(full), { op: 'mkd', phase: 'ctrl' })
    return full
  }

  async rename(dirPath, oldName, newName) {
    await this.#withConn(
      (c) => c.rename(joinRemote(dirPath, oldName), joinRemote(dirPath, newName)),
      { op: 'rnfr', phase: 'ctrl' }
    )
  }

  async deleteFile(filePath) {
    await this.#withConn((c) => c.deleteFile(filePath), { op: 'dele', phase: 'ctrl' })
  }

  /** 递归删除目录（先删内容再 RMD；遇到权限不足会中断并抛错） */
  async deleteDir(dirPath) {
    const p = normalizeRemotePath(dirPath)
    const entries = await this.#withConn((c) => c.list(p), { op: 'list', phase: 'data' })
    for (const entry of entries) {
      const full = joinRemote(p, entry.name)
      if (entry.isDir) await this.deleteDir(full)
      else await this.deleteFile(full)
    }
    await this.#withConn((c) => c.removeDir(p), { op: 'rmd', phase: 'ctrl' })
  }

  /** 查远程文件大小（冲突检测/续传用）；服务器不支持时返回 null */
  async fileSize(filePath) {
    try {
      return await this.#withConn((c) => c.size(filePath), { op: 'size', phase: 'ctrl' })
    } catch {
      return null
    }
  }

  getEncoding() {
    return this.encoding || 'utf-8'
  }

  destroy() {
    if (this.client) {
      try { this.client.close() } catch { /* ignore */ }
      this.client = null
    }
  }
}
