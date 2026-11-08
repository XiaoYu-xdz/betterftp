import path from 'node:path'

/**
 * 解析数据目录（便携模式）。
 *
 * 班级电脑 C 盘有冰点还原，D 盘没有：程序和配置都应放在 D 盘。
 * - electron-builder 的 portable 目标运行时会注入 PORTABLE_EXECUTABLE_DIR，
 *   指向便携 exe 的真实所在目录（运行时自身被解压到临时目录，不能用 app.getPath('exe')）。
 * - 普通打包（目录版）：data 目录取 exe 所在目录旁边。
 * - 开发模式：使用 userData 下的独立目录，避免污染真实配置。
 */
export function resolveDataDir({ isPackaged, exePath, portableDir, userDataDir }) {
  if (isPackaged) {
    const base = portableDir || path.dirname(exePath)
    return path.join(base, 'data')
  }
  return path.join(userDataDir, 'BetterFTP-dev-data')
}
