/**
 * 文件名编码检测。
 *
 * 背景：Windows 上的 FTP 服务器（Serv-U/IIS）常以 GBK 发送中文文件名，
 * Linux 服务器多用 UTF-8。fluent-ftp 默认按 UTF-8 解码，遇到 GBK 字节会
 * 产生 U+FFFD（�）替换符；反过来（UTF-8 字节按 GBK 解）则出现「涓鏂枃」这类
 * 典型双字错位乱码。两种方向都能被下面的启发式识别。
 */

const FFFD = '\uFFFD'

/** utf-8 解码遇到非法字节（多半是 GBK 文件名） */
export function hasReplacementChar(names) {
  return names.some((n) => n.includes(FFFD))
}

/** 常见「UTF-8 字节被按 GBK 解码」产生的特征字（如"中"→"涓"） */
const GBK_MOJIBAKE_CHARS = /[涓鏂浠殑鏈枃鏍嶇浠舵枃浠跺す杩樻槸鏈枃浠跺す]/ // eslint-disable-line no-misleading-character-class

/** 启发式：names 是否像被错误解码（两个方向都查） */
export function looksGarbled(names) {
  if (hasReplacementChar(names)) return true
  let hits = 0
  let total = 0
  for (const n of names) {
    total += n.length
    for (const ch of n) {
      if (GBK_MOJIBAKE_CHARS.test(ch)) hits++
    }
  }
  // 特征字占比过高（正常中文文本极少出现这些字密集组合）
  return total > 0 && hits / total > 0.3
}

/**
 * 自动检测：先按 UTF-8 列目录，若出现 U+FFFD 说明服务器发的不是 UTF-8，
 * 切换 GBK 再列一次确认。返回 'utf-8' | 'gbk'。
 */
export function resolveDetectedEncoding({ utf8Names, gbkNames }) {
  if (!hasReplacementChar(utf8Names)) return 'utf-8'
  if (gbkNames && !hasReplacementChar(gbkNames)) return 'gbk'
  return 'gbk' // 两个方向都有替换符时，GBK 服务器可能性更大
}

/** iconv 编码名映射（fluent-ftp 的 client.ftp.encoding 直接使用） */
export function toIconvEncoding(encoding) {
  if (encoding === 'gbk') return 'gbk'
  return 'utf-8'
}
