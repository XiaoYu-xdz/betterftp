/**
 * 远程目录树遍历（文件夹整体下载用）
 * 用独立的临时会话执行，避免占用浏览连接。
 */

const MAX_DEPTH = 30

/**
 * 递归收集目录下所有文件
 * @param {{listDir: Function}} session FtpSession（需有 listDir 方法）
 * @param {string} remoteDir 远程目录
 * @param {{depth?:number, onFile?:Function}} opts
 * @returns {Promise<Array<{dir:string, name:string, size:number|null}>>}
 *   dir 为文件所在的远程目录，size 可能为 null（服务器不支持）
 */
export async function walkRemoteTree(session, remoteDir, { depth = 0, onFile } = {}) {
  if (depth > MAX_DEPTH) {
    throw new Error(`目录层级过深（超过 ${MAX_DEPTH} 层），可能存在循环链接`)
  }
  const items = await session.listDir(remoteDir)
  const files = []
  for (const item of items) {
    const full = remoteDir === '/' ? `/${item.name}` : `${remoteDir}/${item.name}`
    if (item.isDir) {
      const sub = await walkRemoteTree(session, full, { depth: depth + 1, onFile })
      files.push(...sub)
    } else {
      const f = { dir: remoteDir, name: item.name, size: item.size }
      if (onFile) onFile(f)
      files.push(f)
    }
  }
  return files
}
