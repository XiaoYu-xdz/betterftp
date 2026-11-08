/** 格式化与图标工具（界面文字在 texts.js 集中管理） */

/** 格式化字节大小（null/undefined → '—'） */
export function fmtSize(n) {
  if (n === null || n === undefined || Number.isNaN(n)) return '—'
  if (n < 1024) return `${n} B`
  const units = ['KB', 'MB', 'GB', 'TB']
  let v = n
  let i = -1
  do { v /= 1024; i++ } while (v >= 1024 && i < units.length - 1)
  return `${v >= 100 ? v.toFixed(0) : v.toFixed(1)} ${units[i]}`
}

export function fmtSpeed(bps) {
  if (!Number.isFinite(bps) || bps <= 0) return ''
  return `${fmtSize(bps)}/s`
}

export function fmtEta(sec) {
  if (!Number.isFinite(sec) || sec <= 0) return ''
  if (sec < 60) return `剩 ${Math.round(sec)} 秒`
  const m = Math.floor(sec / 60)
  if (m < 60) return `剩 ${m} 分${Math.round(sec % 60) ? Math.round(sec % 60) + ' 秒' : ''}`
  return `剩 ${Math.floor(m / 60)} 时${m % 60} 分`
}

/** ISO → 'MM-DD HH:mm'（当年显示 MM-DD，跨年带年份） */
export function fmtTime(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  const now = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  const hm = `${pad(d.getHours())}:${pad(d.getMinutes())}`
  if (d.getFullYear() === now.getFullYear()) {
    return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${hm}`
  }
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${hm}`
}

export function fmtClock(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

/** 文件图标（文件夹/常见类型区分） */
export function fileIcon(item) {
  if (item.isDir) return '📁'
  const i = item.name.lastIndexOf('.')
  const ext = i > 0 ? item.name.slice(i + 1).toLowerCase() : ''
  if (['ppt', 'pptx'].includes(ext)) return '📊'
  if (['doc', 'docx'].includes(ext)) return '📄'
  if (['xls', 'xlsx', 'csv'].includes(ext)) return '📈'
  if (ext === 'pdf') return '📕'
  if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'].includes(ext)) return '🖼️'
  if (['mp4', 'avi', 'mkv', 'mov', 'wmv', 'flv'].includes(ext)) return '🎬'
  if (['mp3', 'wav', 'wma', 'm4a'].includes(ext)) return '🎵'
  if (['zip', 'rar', '7z'].includes(ext)) return '🗜️'
  return '📄'
}
