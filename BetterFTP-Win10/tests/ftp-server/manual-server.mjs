/**
 * 手工演练用常驻测试 FTP 服务器：node tests/ftp-server/manual-server.mjs
 * 监听 127.0.0.1:2121，文件根目录 tests/ftp-server/ftproot/（自动创建）。
 * Ctrl+C 停止。加 --gbk 以 GBK 编码发送 LIST（验证编码自动检测）。
 */
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { startTestServer, prepareRoot } from './test-server.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.join(__dirname, 'ftproot')
const gbk = process.argv.includes('--gbk')

prepareRoot(rootDir)
const srv = await startTestServer({ port: 2121, rootDir, gbk })

console.log('测试 FTP 服务器已启动: ftp://127.0.0.1:2121' + (gbk ? '（GBK 模式）' : ''))
console.log('文件根目录:', rootDir)
console.log('账号: zhang/123456(读写)  li/abcdef(读写)  ro/read(只读)  drop/write(只写投递箱)')
console.log('应用「设置 → 全局」：服务器地址填 127.0.0.1（不带 ftp:// 和端口），端口填 2121。按 Ctrl+C 停止。')

process.on('SIGINT', () => {
  srv.close()
  process.exit(0)
})
