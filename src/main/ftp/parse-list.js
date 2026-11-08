import iconv from 'iconv-lite'

/**
 * 解析 LIST 命令的原始输出为文件条目数组。
 * 支持：
 *  - Unix ls -l 风格：  -rw-r--r-- 1 ftp ftp 1234567 Nov  5 14:20 课件.pptx
 *  - Windows DOS 风格：  11-05-26  02:20PM       1234567 课件.pptx / <DIR> 目录
 *  - "total N" 等干扰行自动跳过；文件名可含空格与中文（按 encoding 解码）
 *
 * 返回 [{name, isDir, size, modifiedAt: Date|null, rights: string|null}]
 */

const MONTHS = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 }

function yearFrom2Digit(y) {
  const n = Number(y)
  if (n >= 70) return 1900 + n
  return 2000 + n
}

/** Unix 时间格式：Nov  5 14:20（近一年，无年份）或 Nov  5 2024 */
function parseUnixTime(monthStr, dayStr, tail) {
  const mon = MONTHS[monthStr.slice(0, 3).toLowerCase()]
  if (mon === undefined) return null
  const day = Number(dayStr)
  const hm = /^(\d{1,2}):(\d{2})$/.exec(tail)
  const y = /^\d{4}$/.exec(tail)
  const now = new Date()
  if (hm) {
    let year = now.getFullYear()
    // 近半年内但未来超过 1 天的，视为去年（ls 行为）
    const d = new Date(year, mon, day, Number(hm[1]), Number(hm[2]))
    if (d.getTime() > now.getTime() + 86400000) d.setFullYear(year - 1)
    return d
  }
  if (y) return new Date(Number(tail), mon, day)
  return null
}

/** DOS 时间：11-05-26 或 2026-11-05 或 11/05/2026 + 02:20PM */
function parseDosTime(dateStr, timeStr) {
  const m = /^(\d{1,4})[-/](\d{1,2})[-/](\d{1,4})$/.exec(dateStr)
  if (!m) return null
  let year
  let a = Number(m[1])
  let b = Number(m[2])
  let c = Number(m[3])
  let month
  let day
  if (String(m[1]).length === 4) { // YYYY-MM-DD
    year = a; month = b - 1; day = c
  } else if (String(m[3]).length === 4) { // MM-DD-YYYY（Windows 英文默认）
    year = c; month = a - 1; day = b
  } else { // 两位年：歧义时按 Windows 常见的 MM-DD-YY
    year = yearFrom2Digit(m[3])
    if (a > 12 && b <= 12) { day = a; month = b - 1 } else { month = a - 1; day = b }
  }
  const t = /^(\d{1,2}):(\d{2})(AM|PM|am|pm)?$/.exec(timeStr || '')
  let hours = 0
  let minutes = 0
  if (t) {
    hours = Number(t[1])
    minutes = Number(t[2])
    if (t[3]) {
      const pm = /pm/i.test(t[3])
      if (pm && hours < 12) hours += 12
      if (!pm && hours === 12) hours = 0
    }
  }
  return new Date(year, month, day, hours, minutes)
}

function parseUnixLine(line) {
  // 权限 链接数 属主 组 大小 日期(2~3列) 名称...
  const m = /^([\-dlbcps][rwxstST\-]{9})\s+\d+\s+\S+\s+\S+\s+(\d+)\s+(\w{3})\s+(\d{1,2})\s+(\d{1,2}:\d{2}|\d{4})\s+(.+)$/.exec(line)
  if (!m) return null
  let name = m[6]
  const isLink = m[1][0] === 'l'
  if (isLink) name = name.split(/\s+->\s+/)[0]
  if (name.endsWith('/')) name = name.slice(0, -1)
  return {
    name,
    isDir: m[1][0] === 'd' || (isLink && m[6].endsWith('/')),
    size: Number(m[2]),
    modifiedAt: parseUnixTime(m[3], m[4], m[5]),
    rights: m[1].slice(1, 10)
  }
}

function parseDosLine(line) {
  const m = /^(\d{1,4}[-/]\d{1,2}[-/]\d{1,4})\s+(\d{1,2}:\d{2}[APMapm]{0,2})\s+(<DIR>|\d+)\s+(.+)$/.exec(line)
  if (!m) return null
  const isDir = m[3] === '<DIR>'
  return {
    name: m[4],
    isDir,
    size: isDir ? null : Number(m[3]),
    modifiedAt: parseDosTime(m[1], m[2]),
    rights: null
  }
}

export function parseListBuffer(buf, encoding) {
  const enc = encoding === 'gbk' ? 'gbk' : 'utf-8'
  const text = iconv.decode(buf, enc)
  const items = []
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/\s+$/, '')
    if (!line) continue
    if (/^total\s+\d+$/i.test(line)) continue
    let item = parseUnixLine(line) || parseDosLine(line)
    if (!item) {
      // 未知格式：至少保留名称（去掉常见前缀列），尽量不丢文件
      const guess = line.replace(/^\S+\s+\S+\s+\S+\s+\S+\s+\d+\s+/, '')
      if (guess) item = { name: guess, isDir: false, size: null, modifiedAt: null, rights: null }
    }
    if (item) items.push(item)
  }
  return items
}
