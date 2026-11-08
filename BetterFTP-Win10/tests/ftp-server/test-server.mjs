import net from 'node:net'
import fs from 'node:fs'
import path from 'node:path'
import { Transform } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import iconv from 'iconv-lite'

/**
 * 迷你 FTP 测试服务器（仅用于本项目的自动化测试与故障演练）。
 *
 * 能力（刻意覆盖真实服务器常见行为）：
 *  - 4 个账号：zhang/123456(读写)、li/abcdef(读写)、ro/read(只读)、drop/write(只写投递)
 *  - gbk 模式：LIST 输出按 GBK 编码发送（用于编码自动检测测试）
 *  - REST 断点续传（RETR）；STOR 覆盖
 *  - 只读账号对写命令回 550；只写账号对 LIST/RETR 回 550（模拟投递箱）
 */

const ACCOUNTS = {
  zhang: { password: '123456', root: 'zhang', perms: 'rw' },
  li: { password: 'abcdef', root: 'li', perms: 'rw' },
  ro: { password: 'read', root: 'readonly', perms: 'ro' },
  drop: { password: 'write', root: 'dropbox', perms: 'w' }
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function pad(n) { return String(n).padStart(2, '0') }

function listLine(name, st) {
  const d = st.mtime
  const t = `${MONTHS[d.getMonth()]} ${String(d.getDate()).padStart(2)} ${pad(d.getHours())}:${pad(d.getMinutes())}`
  return `${st.isDirectory() ? 'd' : '-'}rw-r--r-- 1 owner group ${String(st.size).padStart(12)} ${t} ${name}\r\n`
}

/** 每块延迟 ms 毫秒的 Transform（模拟慢速链路） */
function slowTransform(ms) {
  return new Transform({
    transform(chunk, _enc, cb) {
      setTimeout(() => cb(null, chunk), ms)
    }
  })
}

export function startTestServer({ port = 2121, rootDir, gbk = false, slow = false } = {}) {
  const encoding = gbk ? 'gbk' : 'utf-8'
  const servers = []

  const server = net.createServer((socket) => {
    const sess = {
      user: null,
      authed: false,
      account: null,
      renameFrom: null,
      restOffset: 0,
      pasvServer: null,   // PASV：等待 accept 的监听
      portTarget: null,   // PORT：{host, port}
      closed: false
    }
    let buf = Buffer.alloc(0)

    const send = (line) => {
      if (!socket.destroyed) socket.write(iconv.encode(line + '\r\n', encoding))
    }

    const absPath = (p) => {
      if (!p || typeof p !== 'string') return null
      let np = p.replace(/\\/g, '/')
      if (!np.startsWith('/')) return null
      np = path.posix.normalize(np)
      if (np === '..' || np.startsWith('../')) return null
      const root = path.join(rootDir, sess.account.root)
      const full = path.join(root, np.replace(/^\//, ''))
      if (!full.startsWith(root)) return null
      return full
    }

    const getDataSocket = () =>
      new Promise((resolve, reject) => {
        const to = setTimeout(() => reject(new Error('no data connection')), 8000)
        if (sess.pasvServer) {
          sess.pasvServer.once('connection', (ds) => { clearTimeout(to); resolve(ds) })
        } else if (sess.portTarget) {
          const ds = net.connect(sess.portTarget.port, sess.portTarget.host, () => { clearTimeout(to); resolve(ds) })
          ds.once('error', (e) => { clearTimeout(to); reject(e) })
        } else {
          clearTimeout(to)
          reject(new Error('425'))
        }
      })

    const closeDataSetup = () => {
      if (sess.pasvServer) { try { sess.pasvServer.close() } catch { /* */ } sess.pasvServer = null }
      sess.portTarget = null
    }

    const handle = async (line) => {
      const sp = line.indexOf(' ')
      const cmd = (sp < 0 ? line : line.slice(0, sp)).toUpperCase()
      const arg = sp < 0 ? '' : line.slice(sp + 1).trim()

      switch (cmd) {
        case 'USER':
          sess.user = arg
          send('331 need password')
          return
        case 'PASS': {
          const acc = ACCOUNTS[sess.user]
          if (!acc || acc.password !== arg) { send('530 Login incorrect'); return }
          sess.authed = true
          sess.account = acc
          fs.mkdirSync(path.join(rootDir, acc.root), { recursive: true })
          send(`230 welcome ${sess.user}`)
          return
        }
        case 'SYST': send('215 UNIX Type: L8'); return
        case 'FEAT': send('211-Features:\r\n UTF8\r\n SIZE\r\n REST STREAM\r\n211 End'); return
        case 'OPTS':
          send(gbk ? '501 not supported' : '200 OK')
          return
        case 'TYPE': send('200 OK'); return
        case 'NOOP': send('200 OK'); return
        case 'PWD': send('257 "/" is current directory'); return
        case 'CWD': send('250 OK'); return // 客户端全程用绝对路径
        case 'QUIT': send('221 bye'); socket.end(); return
      }

      if (!sess.authed) { send('530 not logged in'); return }

      switch (cmd) {
        case 'PASV': {
          closeDataSetup()
          const ps = net.createServer()
          await new Promise((r) => ps.listen(0, '127.0.0.1', r))
          sess.pasvServer = ps
          servers.push(ps)
          const { port: dport } = ps.address()
          send(`227 Entering Passive Mode (127,0,0,1,${Math.floor(dport / 256)},${dport % 256})`)
          return
        }
        case 'PORT': {
          closeDataSetup()
          const m = /^(\d+),(\d+),(\d+),(\d+),(\d+),(\d+)$/.exec(arg)
          if (!m) { send('501 bad PORT'); return }
          sess.portTarget = { host: `${m[1]}.${m[2]}.${m[3]}.${m[4]}`, port: Number(m[5]) * 256 + Number(m[6]) }
          send('200 OK')
          return
        }
      }

      // 以下命令需要数据通道或路径参数
      try {
        switch (cmd) {
          case 'LIST': {
            if (sess.account.perms === 'w') { closeDataSetup(); send('550 cannot list (write-only)'); return }
            const dir = absPath(arg || '/')
            if (!dir || !fs.existsSync(dir)) { closeDataSetup(); send('550 no such directory'); return }
            const ds = await getDataSocket()
            send('150 opening data connection')
            let text = ''
            for (const name of fs.readdirSync(dir)) {
              try { text += listLine(name, fs.statSync(path.join(dir, name))) } catch { /* 并发删除竞态 */ }
            }
            ds.end(iconv.encode(text, encoding))
            await new Promise((r) => ds.once('close', r))
            closeDataSetup()
            send('226 transfer complete')
            return
          }
          case 'RETR': {
            if (sess.account.perms === 'w') { closeDataSetup(); send('550 cannot download (write-only)'); return }
            const f = absPath(arg)
            if (!f || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { closeDataSetup(); send('550 no such file'); return }
            const ds = await getDataSocket()
            send('150 opening data connection')
            // pipeline 保证文件内容全部冲刷到 socket 后才继续（否则 226 可能先于数据到达客户端）
            // slow 模式：每 64KB 停 8ms，模拟真实网络节奏（回环太快会让"取消/续传"测试来不及触发）
            const src = fs.createReadStream(f, { start: sess.restOffset })
            await pipeline(src, ...(slow ? [slowTransform(8)] : []), ds)
            sess.restOffset = 0
            closeDataSetup()
            send('226 transfer complete')
            return
          }
          case 'STOR': {
            if (sess.account.perms === 'ro') { closeDataSetup(); send('550 permission denied (read-only)'); return }
            const f = absPath(arg)
            if (!f) { closeDataSetup(); send('550 bad path'); return }
            const ds = await getDataSocket()
            send('150 ready to receive')
            await new Promise((resolve, reject) => {
              const ws = fs.createWriteStream(f)
              ws.on('error', reject)
              ws.on('close', resolve)
              ds.pipe(ws)
            })
            closeDataSetup()
            send('226 transfer complete')
            return
          }
          case 'MKD': {
            if (sess.account.perms !== 'rw' && sess.account.perms !== 'w') { send('550 permission denied'); return }
            const f = absPath(arg)
            fs.mkdirSync(f, { recursive: false })
            send(`257 "${arg}" created`)
            return
          }
          case 'RMD': {
            if (sess.account.perms !== 'rw') { send('550 permission denied'); return }
            fs.rmdirSync(absPath(arg))
            send('250 OK')
            return
          }
          case 'DELE': {
            if (sess.account.perms !== 'rw') { send('550 permission denied'); return }
            fs.unlinkSync(absPath(arg))
            send('250 OK')
            return
          }
          case 'RNFR': {
            if (sess.account.perms !== 'rw') { send('550 permission denied'); return }
            sess.renameFrom = absPath(arg)
            send('350 ready for RNTO')
            return
          }
          case 'RNTO': {
            if (sess.account.perms !== 'rw') { send('550 permission denied'); return }
            fs.renameSync(sess.renameFrom, absPath(arg))
            sess.renameFrom = null
            send('250 OK')
            return
          }
          case 'SIZE': {
            const f = absPath(arg)
            if (!f || !fs.existsSync(f)) { send('550 no such file'); return }
            send(`213 ${fs.statSync(f).size}`)
            return
          }
          case 'REST': {
            sess.restOffset = Number(arg) || 0
            send('350 restarting at offset')
            return
          }
          default:
            send(`502 unknown command ${cmd}`)
        }
      } catch (err) {
        closeDataSetup()
        send(err.message?.startsWith('425') || err.message === 'no data connection' ? '425 no data connection' : `550 ${err.message}`)
      }
    }

    // 命令串行化处理（LIST/RETR 等命令内部有 await）
    let chain = Promise.resolve()
    socket.on('data', (chunk) => {
      buf = Buffer.concat([buf, chunk])
      let idx
      while ((idx = buf.indexOf(0x0A)) >= 0) {
        let lineBuf = buf.slice(0, idx)
        if (lineBuf.length && lineBuf[lineBuf.length - 1] === 0x0D) lineBuf = lineBuf.slice(0, -1)
        buf = buf.slice(idx + 1)
        const line = iconv.decode(lineBuf, encoding)
        chain = chain.then(() => handle(line)).catch(() => { })
      }
    })

    socket.on('error', () => { sess.closed = true })
    socket.on('close', () => { closeDataSetup() })

    send(`220 test-ftp-server ready${gbk ? ' (gbk)' : ''}`)
  })

  return new Promise((resolve, reject) => {
    server.once('error', (err) => {
      // 端口被占用等：快速失败，避免测试挂死等超时
      reject(new Error(`测试服务器启动失败（端口 ${port}）: ${err.code || err.message}。可能被 manual-server 或另一个测试占用，请换端口。`))
    })
    server.listen(port, '127.0.0.1', () => {
      resolve({
        port,
        close: () => {
          for (const s of servers) { try { s.close() } catch { /* */ } }
          server.close()
          server.closeAllConnections?.()
        }
      })
    })
  })
}

/** 准备测试目录结构与测试文件 */
export function prepareRoot(rootDir) {
  fs.rmSync(rootDir, { recursive: true, force: true })
  const mk = (rel) => fs.mkdirSync(path.join(rootDir, rel), { recursive: true })
  const put = (rel, content) => {
    fs.mkdirSync(path.dirname(path.join(rootDir, rel)), { recursive: true })
    fs.writeFileSync(path.join(rootDir, rel), content)
  }
  mk('zhang'); mk('li'); mk('readonly'); mk('dropbox')
  put('zhang/01-课件/第一章 绪论.pptx', 'PPTX-CONTENT-'.repeat(3000))   // ~36KB
  put('zhang/01-课件/教案.docx', 'DOCX-CONTENT')
  put('zhang/02-素材/图片 示例.png', 'PNG-BYTES-0123456789')
  put('zhang/说明 文档.txt', '说明内容')
  put('readonly/共享课件.pdf', 'PDF-SHARED-CONTENT-LARGE'.repeat(2000))
  put('readonly/通知.txt', '通知内容')
  put('zhang/大文件测试.bin', Buffer.alloc(16 * 1024 * 1024, 7)) // 16MB 供取消/续传测试（回环太快，小文件来不及取消）
}
