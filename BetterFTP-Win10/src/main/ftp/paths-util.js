/** 远程路径工具（FTP 路径一律使用正斜杠，根为 "/"） */

export function normalizeRemotePath(p) {
  if (!p || typeof p !== 'string') return '/'
  let s = p.replace(/\\/g, '/')
  s = s.replace(/\/+/g, '/')
  if (!s.startsWith('/')) s = '/' + s
  if (s.length > 1 && s.endsWith('/')) s = s.slice(0, -1)
  return s || '/'
}

export function joinRemote(base, name) {
  const b = normalizeRemotePath(base)
  if (b === '/') return '/' + name
  return b + '/' + name
}

export function parentRemote(p) {
  const n = normalizeRemotePath(p)
  if (n === '/') return null // 根目录没有上级
  const i = n.lastIndexOf('/')
  return i <= 0 ? '/' : n.slice(0, i)
}

/** 面包屑分段：/课件/数学 → [{name:'课件', path:'/课件'}, {name:'数学', path:'/课件/数学'}] */
export function breadcrumbOf(p) {
  const n = normalizeRemotePath(p)
  if (n === '/') return [{ name: '/', path: '/' }]
  const parts = n.slice(1).split('/')
  const crumbs = [{ name: '根目录', path: '/' }]
  let cur = ''
  for (const part of parts) {
    cur += '/' + part
    crumbs.push({ name: part, path: cur })
  }
  return crumbs
}

/** 从完整本地路径拆出 { dir, name, ext } */
export function splitLocalPath(p) {
  const norm = String(p || '').replace(/\\/g, '/')
  const i = norm.lastIndexOf('/')
  const name = i >= 0 ? norm.slice(i + 1) : norm
  const dir = i >= 0 ? norm.slice(0, i) : ''
  const j = name.lastIndexOf('.')
  const ext = j > 0 ? name.slice(j + 1).toLowerCase() : ''
  return { dir, name, ext }
}

/** 重命名避让：name.txt → name (1).txt；无扩展名 → name (1) */
export function dedupeName(name, exists) {
  const set = new Set(exists)
  if (!set.has(name)) return name
  const j = name.lastIndexOf('.')
  const base = j > 0 ? name.slice(0, j) : name
  const ext = j > 0 ? name.slice(j) : ''
  for (let i = 1; i < 1000; i++) {
    const cand = `${base} (${i})${ext}`
    if (!set.has(cand)) return cand
  }
  return `${base} (${Date.now()})${ext}`
}
