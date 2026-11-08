import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { startTestServer, prepareRoot } from './ftp-server/test-server.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
export const TMP_ROOT = path.join(__dirname, '.tmp')

/** 启动一个一次性测试 FTP 服务器 + 干净的文件根目录 */
export async function withServer(fn, { gbk = false, port = 2121, slow = false } = {}) {
  const rootDir = path.join(TMP_ROOT, `ftproot-${port}-${gbk ? 'gbk' : 'utf8'}-${slow ? 'slow' : 'fast'}-${Date.now()}`)
  prepareRoot(rootDir)
  const server = await startTestServer({ port, rootDir, gbk, slow })
  try {
    return await fn({ port, rootDir })
  } finally {
    server.close()
  }
}

/** 全局配置（测试用） */
export function testGlobal(port, over = {}) {
  return {
    server: { host: '127.0.0.1', port },
    encoding: 'auto',
    timeoutMs: 8000,
    passive: true,
    maxConcurrentTransfers: 2,
    downloadDir: 'desktop',
    ...over
  }
}

export function testAccount(username, over = {}) {
  const pwd = { zhang: '123456', li: 'abcdef', ro: 'read', drop: 'write' }[username] || ''
  return {
    id: `acc_${username}`,
    displayName: username,
    username,
    password: pwd,
    remotePath: '/',
    encoding: null,
    color: '#3B82F6',
    note: '',
    order: 0,
    ...over
  }
}

/** 轮询等待条件成立 */
export async function waitFor(fn, timeoutMs = 15000, stepMs = 100) {
  const t0 = Date.now()
  while (Date.now() - t0 < timeoutMs) {
    if (await fn()) return true
    await new Promise((r) => setTimeout(r, stepMs))
  }
  return false
}

export function readFile(rootDir, rel) {
  return fs.readFileSync(path.join(rootDir, rel))
}
