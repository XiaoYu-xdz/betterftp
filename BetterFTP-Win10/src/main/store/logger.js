import fs from 'node:fs'
import path from 'node:path'

const KEEP_MONTHS = 6

function monthStamp(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/**
 * 本地操作日志：按月分 JSONL 文件存于 data/logs/。
 * 每行：{"time":"ISO","account":"张老师","action":"upload","path":"/xx/a.pptx","result":"成功"|"失败:原因"}
 */
export class OperationLogger {
  constructor(dataDir) {
    this.logDir = path.join(dataDir, 'logs')
  }

  log(entry) {
    const { account, action, path: filePath, result } = entry
    try {
      fs.mkdirSync(this.logDir, { recursive: true })
      const line = JSON.stringify({
        time: new Date().toISOString(),
        account: account || '',
        action: action || '',
        path: filePath || '',
        result: result || ''
      })
      fs.appendFileSync(path.join(this.logDir, `${monthStamp()}.jsonl`), line + '\n', 'utf8')
      this.cleanup()
    } catch {
      // 日志失败不阻断业务
    }
  }

  /** 读取最近 months 个月的日志，返回按时间正序数组 */
  read({ months = 1, limit = 5000 } = {}) {
    const files = this.listFiles(months)
    const rows = []
    for (const f of files) {
      try {
        const text = fs.readFileSync(f, 'utf8')
        for (const line of text.split('\n')) {
          if (!line.trim()) continue
          try { rows.push(JSON.parse(line)) } catch { /* 跳过坏行 */ }
        }
      } catch { /* 文件可能在读取间隙被清空，忽略 */ }
    }
    rows.sort((a, b) => (a.time < b.time ? -1 : 1))
    return limit > 0 ? rows.slice(-limit) : rows
  }

  listFiles(months = 1) {
    try {
      const all = fs.readdirSync(this.logDir).filter((f) => /^\d{4}-\d{2}\.jsonl$/.test(f)).sort()
      return all.slice(-Math.max(1, months)).map((f) => path.join(this.logDir, f))
    } catch {
      return []
    }
  }

  /** 清空全部日志 */
  clear() {
    for (const f of this.listFiles(KEEP_MONTHS)) {
      try { fs.unlinkSync(f) } catch { /* ignore */ }
    }
  }

  /** 只保留最近 KEEP_MONTHS 个月 */
  cleanup() {
    const all = this.listFiles(KEEP_MONTHS + 12)
    if (all.length > KEEP_MONTHS) {
      for (const f of all.slice(0, all.length - KEEP_MONTHS)) {
        try { fs.unlinkSync(f) } catch { /* ignore */ }
      }
    }
  }

  /** 导出为 CSV（Excel 可直接打开，带 BOM 防中文乱码） */
  static toCsv(rows) {
    const esc = (s) => `"${String(s ?? '').replace(/"/g, '""')}"`
    const head = ['时间', '账号', '操作', '文件路径', '结果'].map(esc).join(',')
    const body = rows.map((r) => {
      const t = r.time ? r.time.replace('T', ' ').replace(/\.\d+Z$/, '') : ''
      return [t, r.account, r.action, r.path, r.result].map(esc).join(',')
    })
    return '\uFEFF' + [head, ...body].join('\r\n')
  }
}
