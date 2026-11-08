import net from 'node:net'
import fs from 'node:fs'
import { Transform } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import iconv from 'iconv-lite'
import { parseListBuffer } from './parse-list.js'

/**
 * 精简的传统 FTP 协议客户端（仅本项目所需功能）。
 *
 * 为什么自研而不是用现成库：本项目的硬需求是 GBK 中文文件名（校园网 Serv-U/IIS
 * 服务器普遍非 UTF-8），主流 Node FTP 库不能按任意编码收发控制/数据通道。
 * 这里基于 net.Socket + iconv-lite 实现 RFC 959 的最小子集：
 *   USER/PASS/TYPE/PASV/PORT/LIST/RETR/STOR/DELE/RMD/MKD/RNFR/RNTO/SIZE/REST/NOOP/QUIT
 *
 * 错误约定（配合 errors.js 映射）：
 *  - FTP 4xx/5xx 回复 → 抛出 Error 带整数 err.code（如 530）
 *  - 网络层错误 → 透传 Node errno（err.code = 'ECONNREFUSED' 等），数据通道错误带 err.phase='data'
 *  - 用户取消 → FtpAbortedError（code='EABORT'）
 */

export class FtpProtocolError extends Error {
  constructor(code, message) {
    super(message)
    this.code = code // 整数 FTP 回复码
  }
}

export class FtpAbortedError extends Error {
  constructor() {
    super('transfer aborted by user')
    this.code = 'EABORT'
  }
}

const CRLF = '\r\n'
const TRANSFER_FINAL_TIMEOUT = 300000 // 数据传完后等最终回复的兜底时长

function timeoutErr(msg) {
  const err = new Error(msg || 'ETIMEDOUT')
  err.code = 'ETIMEDOUT'
  return err
}

function cmdLine(cmd, arg) {
  return arg === undefined ? cmd + CRLF : `${cmd} ${arg}${CRLF}`
}

/** 计数字节并限频回调进度的 Transform（同时解决背压：pipeline 自动管理） */
function countingTransform(onProgress, getTotal) {
  let transferred = 0
  let lastTick = 0
  return new Transform({
    transform(chunk, _enc, cb) {
      transferred += chunk.length
      const now = Date.now()
      if (onProgress && now - lastTick > 100) {
        lastTick = now
        onProgress(transferred, getTotal())
      }
      cb(null, chunk)
    },
    flush(cb) {
      if (onProgress) onProgress(transferred, getTotal())
      cb()
    }
  })
}

export class FtpClient {
  /**
   * @param {{host:string, port:number, user:string, password:string,
   *          encoding:'utf-8'|'gbk', timeoutMs:number, passive:boolean}} opts
   */
  constructor(opts) {
    this.host = opts.host
    this.port = opts.port || 21
    this.user = opts.user || 'anonymous'
    this.password = opts.password || ''
    this.timeoutMs = opts.timeoutMs || 30000
    this.passive = opts.passive !== false
    this.encoding = opts.encoding === 'gbk' ? 'gbk' : 'utf-8'
    this.socket = null
    this.closed = true
    this._buf = Buffer.alloc(0)
    this._activeReply = null
    this._cmdChain = Promise.resolve()
  }

  setEncoding(enc) {
    this.encoding = enc === 'gbk' ? 'gbk' : 'utf-8'
  }

  // ---------- 控制通道底层 ----------

  #sendRaw(line) {
    if (!this.socket || this.closed) {
      const err = new Error('not connected')
      err.code = 'ENOTCONN'
      throw err
    }
    this.socket.write(iconv.encode(line, this.encoding))
  }

  #onCtrlData(chunk) {
    this._buf = Buffer.concat([this._buf, chunk])
    while (true) {
      const idx = this._buf.indexOf(0x0A)
      if (idx < 0) break
      let lineBuf = this._buf.slice(0, idx)
      if (lineBuf.length && lineBuf[lineBuf.length - 1] === 0x0D) lineBuf = lineBuf.slice(0, -1)
      this._buf = this._buf.slice(idx + 1)
      this.#onLine(iconv.decode(lineBuf, this.encoding))
    }
  }

  #onLine(line) {
    const a = this._activeReply
    if (!a) return
    a.lines.push(line)
    if (a.firstLine === null) {
      const m = /^\s*(\d{3})([- ]?)/.exec(line)
      if (m) {
        a.code = Number(m[1])
        a.multiline = m[2] === '-'
        a.firstLine = line
        if (!a.multiline) this.#finishReply(a)
      }
      return
    }
    if (a.multiline && new RegExp(`^\\s*${a.code}(\\s|$)`).test(line)) {
      this.#finishReply(a)
    }
  }

  #finishReply(a) {
    this._activeReply = null
    if (a.timer) clearTimeout(a.timer)
    a.resolve({ code: a.code, text: a.lines.join('\n') })
  }

  /** 等待下一个（组）回复，超时自动失败 */
  #waitReply(timeoutMs) {
    return new Promise((resolve, reject) => {
      const a = { code: null, lines: [], firstLine: null, multiline: false, resolve, reject, timer: null }
      a.timer = setTimeout(() => {
        if (this._activeReply === a) {
          this._activeReply = null
          reject(timeoutErr('ftp reply timeout'))
        }
      }, timeoutMs)
      this._activeReply = a
    })
  }

  #onCtrlError(err) {
    const a = this._activeReply
    if (a) {
      this._activeReply = null
      if (a.timer) clearTimeout(a.timer)
      a.reject(err)
    }
    this.#destroySocket()
  }

  #onCtrlClose() {
    this.#destroySocket()
  }

  #destroySocket() {
    if (this.socket) {
      try { this.socket.destroy() } catch { /* ignore */ }
      this.socket = null
    }
    this.closed = true
    const a = this._activeReply
    if (a) {
      this._activeReply = null
      if (a.timer) clearTimeout(a.timer)
      const err = new Error('connection closed')
      err.code = 'ECONNRESET'
      a.reject(err)
    }
  }

  // ---------- 命令收发（_cmdChain 保证同一时刻只有一条命令在等回复） ----------

  /**
   * 发送命令并等待最终回复。1xx 中间态（传输命令）继续等最终回复，
   * 最终回复兜底超时放宽到 TRANSFER_FINAL_TIMEOUT（真正的卡死由数据通道超时发现）。
   */
  #raw(cmd, arg) {
    const run = async () => {
      this.#sendRaw(cmdLine(cmd, arg))
      let reply = await this.#waitReply(this.timeoutMs)
      if (reply.code >= 100 && reply.code < 200) {
        reply = await this.#waitReply(TRANSFER_FINAL_TIMEOUT)
      }
      return reply
    }
    const p = this._cmdChain.then(run, run)
    this._cmdChain = p.catch(() => { /* 防链断裂；错误由调用者处理 */ })
    return p
  }

  /** 简单命令：回复码必须在 okCodes 内，否则抛 FtpProtocolError */
  async #run(cmd, arg, okCodes) {
    const r = await this.#raw(cmd, arg)
    if (!okCodes.includes(r.code)) throw new FtpProtocolError(r.code, r.text.trim())
    return r
  }

  // ---------- 连接 ----------

  async connect() {
    const socket = net.connect({ host: this.host, port: this.port, family: 4 })
    this.socket = socket
    socket.setNoDelay(true)
    // 协议处理器在等待 TCP 连接时就挂好，防问候语竞态
    socket.on('data', (c) => this.#onCtrlData(c))
    socket.on('close', () => this.#onCtrlClose())

    await new Promise((resolve, reject) => {
      const to = setTimeout(() => {
        socket.destroy()
        reject(timeoutErr(`connect ${this.host}:${this.port} timeout`))
      }, this.timeoutMs)
      socket.once('connect', () => { clearTimeout(to); resolve() })
      socket.once('error', (err) => { clearTimeout(to); reject(err) })
    })
    // 连接建立后再挂持久 error 处理
    socket.on('error', (err) => this.#onCtrlError(err))
    this.closed = false

    // 问候语
    const greeting = await this.#waitReply(this.timeoutMs)
    if (greeting.code !== 220) throw new FtpProtocolError(greeting.code, greeting.text.trim())

    // 登录（USER 可能直接 230，也可能 331 要密码）
    const u = await this.#run('USER', this.user, [230, 331, 202])
    if (u.code === 331) {
      await this.#run('PASS', this.password, [230, 202])
    }

    // 二进制模式；UTF-8 时尝试协商（服务器拒绝则忽略）
    try { await this.#run('TYPE', 'I', [200]) } catch (e) {
      if (e instanceof FtpProtocolError && e.code >= 500) throw e
    }
    if (this.encoding === 'utf-8') {
      try { await this.#raw('OPTS UTF8 ON') } catch { /* 老服务器不支持，忽略 */ }
    }
    return this
  }

  close() {
    if (this.socket && !this.closed) {
      try { this.#sendRaw('QUIT' + CRLF) } catch { /* ignore */ }
    }
    this.#destroySocket()
  }

  // ---------- 数据通道 ----------

  /** PASV：要一个被动端口。数据连接一律连控制通道 host（防服务器报内网 IP 导致连不上）。 */
  async #pasvPort() {
    const r = await this.#run('PASV', undefined, [227])
    const m = /(\d+),(\d+),(\d+),(\d+),(\d+),(\d+)/.exec(r.text)
    if (!m) throw new FtpProtocolError(227, `无法解析 PASV 响应: ${r.text}`)
    const port = Number(m[5]) * 256 + Number(m[6])
    if (!port) throw new FtpProtocolError(227, `PASV 端口无效: ${r.text}`)
    return port
  }

  /** PORT 主动模式：本机监听临时端口。返回 server（调用方负责 close）。 */
  async #portListener() {
    const server = net.createServer()
    await new Promise((resolve) => server.listen(0, '0.0.0.0', resolve))
    const port = server.address().port
    const local = (this.socket?.localAddress || '127.0.0.1').replace(/^::ffff:/, '')
    const ip = local.split('.').map(Number)
    const okIp = ip.length === 4 && ip.every((n) => Number.isInteger(n) && n >= 0 && n <= 255)
    const p1 = Math.floor(port / 256)
    const p2 = port % 256
    try {
      // PORT 参数格式：h1,h2,h3,h4,p1,p2（IP 段也用逗号分隔）
      await this.#run('PORT', `${okIp ? ip.join(',') : '127,0,0,1'},${p1},${p2}`, [200])
    } catch (err) {
      server.close()
      throw err
    }
    return server
  }

  /**
   * 发起数据通道并发出传输命令。
   * @returns {{ dataReady: Promise<net.Socket>, replyPromise: Promise, server: net.Server|null }}
   */
  async #openData(cmd, arg) {
    let server = null
    let dataReady
    if (this.passive) {
      const port = await this.#pasvPort()
      dataReady = new Promise((resolve, reject) => {
        const ds = net.connect({ host: this.host, port, family: 4 })
        const to = setTimeout(() => {
          ds.destroy()
          const err = timeoutErr('data connection timeout (passive)')
          err.phase = 'data'
          reject(err)
        }, this.timeoutMs)
        ds.once('connect', () => { clearTimeout(to); resolve(ds) })
        ds.once('error', (err) => { clearTimeout(to); err.phase = 'data'; reject(err) })
      })
    } else {
      server = await this.#portListener()
      dataReady = new Promise((resolve, reject) => {
        const to = setTimeout(() => {
          server.close()
          const err = timeoutErr('data connection timeout (active)')
          err.phase = 'data'
          reject(err)
        }, this.timeoutMs)
        server.once('connection', (ds) => { clearTimeout(to); resolve(ds) })
        server.once('error', (err) => { clearTimeout(to); err.phase = 'data'; reject(err) })
      })
    }
    const replyPromise = this.#raw(cmd, arg)
    return { dataReady, replyPromise, server }
  }

  #cleanupData(ds, server) {
    if (ds) try { ds.destroy() } catch { /* ignore */ }
    if (server) try { server.close() } catch { /* ignore */ }
  }

  // ---------- 高层操作 ----------

  /** 列目录，返回原始字节（调用方可按不同编码重复解码，无需重发命令） */
  async listRaw(remotePath) {
    const { dataReady, replyPromise, server } = await this.#openData('LIST', remotePath === '/' ? '' : remotePath)
    let ds = null
    try {
      ds = await dataReady
      const chunks = []
      await new Promise((resolve, reject) => {
        ds.on('data', (c) => chunks.push(c))
        ds.on('end', resolve)
        ds.on('close', () => setTimeout(resolve, 0)) // 兜底：个别服务器不发 FIN
        ds.on('error', (e) => { e.phase = 'data'; reject(e) })
        replyPromise.then(
          (r) => { if (r.code >= 400) reject(new FtpProtocolError(r.code, r.text.trim())) },
          (e) => reject(e)
        )
      })
      const reply = await replyPromise // end 先于 226 到达时在此等最终回复
      if (reply.code >= 400) throw new FtpProtocolError(reply.code, reply.text.trim())
      return Buffer.concat(chunks)
    } catch (err) {
      // 数据通道建立失败时，丢弃悬空的控制回复，把数据错误抛出去（据此提示"被动被防火墙拦截"）
      replyPromise.catch(() => { /* 已处理 */ })
      this.#cleanupData(ds, server)
      throw err
    } finally {
      this.#cleanupData(ds, server)
    }
  }

  async list(remotePath) {
    const raw = await this.listRaw(remotePath)
    const items = parseListBuffer(raw, this.encoding)
    return items.filter((f) => f.name && f.name !== '.' && f.name !== '..')
  }

  async mkdir(remotePath) {
    await this.#run('MKD', remotePath, [257])
  }

  async rename(fromPath, toPath) {
    await this.#run('RNFR', fromPath, [350])
    await this.#run('RNTO', toPath, [250])
  }

  async deleteFile(remotePath) {
    await this.#run('DELE', remotePath, [250])
  }

  async removeDir(remotePath) {
    await this.#run('RMD', remotePath, [250])
  }

  async size(remotePath) {
    const r = await this.#raw('SIZE', remotePath)
    if (r.code === 213) {
      const n = Number(r.text.split('\n')[0].replace(/^213\s*/, '').trim())
      return Number.isFinite(n) ? n : null
    }
    return null // 服务器不支持 SIZE（如部分 IIS 配置）
  }

  /**
   * 下载到本地文件。startAt>0 时断点续传（服务器不支持则自动从头重来）。
   * onProgress(transferred, total)；signal.aborted 触发取消。
   */
  async download(remotePath, { destPath, size, onProgress, signal } = {}) {
    let startAt = 0
    if (size && fs.existsSync(destPath)) {
      const have = fs.statSync(destPath).size
      if (have > 0 && have < size) {
        try {
          const r = await this.#raw('REST', String(have))
          if (r.code === 350) startAt = have
        } catch { /* 不支持续传 */ }
      }
    }
    const { dataReady, replyPromise, server } = await this.#openData('RETR', remotePath)
    let ds = null
    try {
      ds = await dataReady
      const total = size ?? null
      const counter = countingTransform(onProgress, () => total)
      if (startAt > 0 && onProgress) onProgress(startAt, total)
      const abortTimer = setInterval(() => {
        if (signal?.aborted) {
          try { ds.destroy() } catch { /* ignore */ }
        }
      }, 60)
      try {
        await pipeline(
          ds,
          counter,
          fs.createWriteStream(destPath, { flags: startAt > 0 ? 'r+' : 'w', start: startAt > 0 ? startAt : undefined })
        )
      } finally {
        clearInterval(abortTimer)
      }
      const reply = await replyPromise
      if (reply.code >= 400) throw new FtpProtocolError(reply.code, reply.text.trim())
      if (signal?.aborted) throw new FtpAbortedError()
      return startAt
    } catch (err) {
      replyPromise.catch(() => { /* 已处理 */ })
      this.#cleanupData(ds, server)
      if (signal?.aborted && !(err instanceof FtpProtocolError)) throw new FtpAbortedError()
      throw err
    } finally {
      this.#cleanupData(ds, server)
    }
  }

  /**
   * 上传本地文件（srcPath）或 Buffer（srcBuffer）。total 用于进度显示。
   * 返回 { transferred }。
   */
  async upload(remotePath, { srcPath, srcBuffer, onProgress, signal } = {}) {
    const total = srcPath ? fs.statSync(srcPath).size : srcBuffer.length
    const { dataReady, replyPromise, server } = await this.#openData('STOR', remotePath)
    let ds = null
    try {
      ds = await dataReady
      const counter = countingTransform(onProgress, () => total)
      const abortTimer = setInterval(() => {
        if (signal?.aborted) {
          try { ds.destroy() } catch { /* ignore */ }
        }
      }, 60)
      try {
        if (srcPath) {
          await pipeline(fs.createReadStream(srcPath), counter, ds)
        } else {
          await pipeline((async function* () { yield srcBuffer })(), counter, ds)
        }
      } finally {
        clearInterval(abortTimer)
      }
      const reply = await replyPromise
      if (reply.code >= 400) throw new FtpProtocolError(reply.code, reply.text.trim())
      if (signal?.aborted) throw new FtpAbortedError()
      return { transferred: total }
    } catch (err) {
      replyPromise.catch(() => { /* 已处理 */ })
      this.#cleanupData(ds, server)
      if (signal?.aborted && !(err instanceof FtpProtocolError)) throw new FtpAbortedError()
      throw err
    } finally {
      this.#cleanupData(ds, server)
    }
  }
}
