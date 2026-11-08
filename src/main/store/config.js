import fs from 'node:fs'
import path from 'node:path'

export const CONFIG_VERSION = 1

/** 账号卡片可选的 8 种预设颜色 */
export const PRESET_COLORS = [
  '#3B82F6', '#F59E0B', '#10B981', '#EF4444',
  '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16'
]

export function genId() {
  return 'acc_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7)
}

/**
 * 规范化服务器地址：老师习惯把地址填成 "ftp://10.180.168.3/" 或带路径，
 * 这里去掉 ftp:// 前缀、路径和首尾空白，只留主机部分。
 * 注意：不处理 "host:port"（端口语义不明确，应由设置页校验并明确提示）。
 */
export function normalizeHost(raw) {
  let s = String(raw ?? '').trim()
  s = s.replace(/^ftp:\/\//i, '')
  s = s.replace(/^sftp:\/\//i, '')
  s = s.replace(/^\/+/, '')
  const slash = s.indexOf('/')
  if (slash >= 0) s = s.slice(0, slash)
  return s.trim()
}

/** 服务器地址表单校验：返回 null（合法）或给老师的具体纠正文案 */
export function validateServerAddress(raw) {
  const s = String(raw ?? '').trim()
  if (!s) return '服务器地址不能为空。只填 IP（不要带 ftp:// 和端口）'
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(s)) return `地址里不要带 ${s.match(/^[a-z][a-z0-9+.-]*:\/\//i)[0]} 前缀——只填 IP 本身，如 10.180.168.3`
  if (s.includes('/')) return '地址里不要带路径（/）。只填 IP'
  if (s.includes(':')) return `地址里不要带端口（ "${s}"）。`
  if (!/^[\w.-]+$/.test(s)) return '地址格式不对。请填 IP 或主机名'
  return null
}

export function defaultConfig() {
  return {
    version: CONFIG_VERSION,
    global: {
      server: { host: '10.180.168.3', port: 21 },
      encoding: 'auto',            // auto | utf-8 | gbk
      timeoutMs: 30000,
      passive: true,
      maxConcurrentTransfers: 2,
      downloadDir: 'desktop'       // 'desktop' 或绝对路径
    },
    accounts: []
  }
}

export function configFilePath(dataDir) {
  return path.join(dataDir, 'config.json')
}

/** 读取配置；文件不存在时生成默认配置并落盘 */
export function loadConfig(dataDir) {
  const file = configFilePath(dataDir)
  let raw
  try {
    raw = fs.readFileSync(file, 'utf8')
  } catch (e) {
    if (e.code === 'ENOENT') {
      return saveConfig(dataDir, defaultConfig())
    }
    throw e
  }
  let cfg
  try {
    cfg = JSON.parse(raw)
  } catch (e) {
    // 配置损坏时备份原文件后重建默认配置，避免应用无法启动
    try { fs.copyFileSync(file, file + '.corrupt-' + Date.now()) } catch { /* ignore */ }
    return saveConfig(dataDir, defaultConfig())
  }
  return migrate(cfg)
}

/** 原子写入（tmp + rename），避免写一半断电损坏配置 */
export function saveConfig(dataDir, cfg) {
  fs.mkdirSync(dataDir, { recursive: true })
  cfg = migrate(cfg)
  cfg.version = CONFIG_VERSION
  const file = configFilePath(dataDir)
  const tmp = file + '.tmp'
  fs.writeFileSync(tmp, JSON.stringify(cfg, null, 2), 'utf8')
  fs.renameSync(tmp, file)
  return cfg
}

/** 补全/校验字段，兼容手工编辑或旧版本导入的配置 */
export function migrate(cfg) {
  const def = defaultConfig()
  if (!cfg || typeof cfg !== 'object') return def
  const out = { ...def, ...cfg }
  out.global = { ...def.global, ...(cfg.global || {}) }
  out.global.server = { ...def.global.server, ...(cfg.global?.server || {}) }
  out.global.server.host = normalizeHost(out.global.server.host)
  // 兼容把端口写进地址的情况（如 "127.0.0.1:2121"）：拆出端口
  const colon = out.global.server.host.lastIndexOf(':')
  if (colon > 0 && out.global.server.host.indexOf('::') < 0) {
    const maybePort = Number(out.global.server.host.slice(colon + 1))
    if (Number.isInteger(maybePort) && maybePort > 0 && maybePort <= 65535) {
      out.global.server.host = out.global.server.host.slice(0, colon)
      out.global.server.port = maybePort
    }
  }
  if (!Number.isFinite(out.global.server.port) || out.global.server.port <= 0) {
    out.global.server.port = 21
  }
  if (!Number.isFinite(out.global.timeoutMs) || out.global.timeoutMs < 3000) {
    out.global.timeoutMs = 30000
  }
  if (!['auto', 'utf-8', 'gbk'].includes(out.global.encoding)) out.global.encoding = 'auto'
  out.global.passive = out.global.passive !== false
  if (!Number.isFinite(out.global.maxConcurrentTransfers)) out.global.maxConcurrentTransfers = 2
  out.global.maxConcurrentTransfers = Math.min(5, Math.max(1, Math.round(out.global.maxConcurrentTransfers)))
  if (!Array.isArray(cfg.accounts)) out.accounts = []
  else {
    out.accounts = cfg.accounts.map((a, i) => ({
      id: typeof a.id === 'string' && a.id ? a.id : genId(),
      displayName: (a.displayName || '').trim() || (a.username || '').trim() || '未命名账号',
      username: a.username || '',
      password: typeof a.password === 'string' ? a.password : '',
      remotePath: typeof a.remotePath === 'string' && a.remotePath.trim() ? a.remotePath : '/',
      encoding: ['utf-8', 'gbk'].includes(a.encoding) ? a.encoding : null,
      color: /^#[0-9A-Fa-f]{6}$/.test(a.color || '') ? a.color : PRESET_COLORS[i % PRESET_COLORS.length],
      note: typeof a.note === 'string' ? a.note : '',
      order: Number.isFinite(a.order) ? a.order : i
    }))
  }
  return out
}

/** 按 order 排序返回账号列表（渲染层展示顺序） */
export function sortAccounts(accounts) {
  return [...accounts].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
}

/** 导入配置校验：返回 null（合法）或错误原因文本 */
export function validateImport(cfg) {
  if (!cfg || typeof cfg !== 'object') return '文件内容不是有效的 JSON 对象'
  if (cfg.accounts !== undefined && !Array.isArray(cfg.accounts)) return 'accounts 字段必须是数组'
  if (cfg.global !== undefined && typeof cfg.global !== 'object') return 'global 字段必须是对象'
  return null
}
