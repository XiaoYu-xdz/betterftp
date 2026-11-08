import { ipcMain, dialog, shell, app, BrowserWindow } from 'electron'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { migrate, sortAccounts, validateImport } from './store/config.js'
import { OperationLogger } from './store/logger.js'
import { FtpOpError } from './ftp/errors.js'
import { FtpSession } from './ftp/client.js'
import { dedupeName } from './ftp/paths-util.js'
import { ERR_TEXTS as E } from './texts.js'

/**
 * IPC 注册：所有 handler 统一包装为 {ok, data|error}；
 * error 为 {code,title,hint,action,raw}（可操作提示），preload 解包后以异常抛给渲染层。
 */

function wrap(handler) {
  return async (_event, payload) => {
    try {
      const data = await handler(payload || {})
      return { ok: true, data }
    } catch (e) {
      if (e instanceof FtpOpError) {
        return { ok: false, error: e.toJSON() }
      }
      return {
        ok: false,
        error: {
          code: 'unknown',
          title: String(e?.message || e).slice(0, 160),
          hint: E.ipc.unknownError,
          action: 'retry',
          raw: String(e?.message || e)
        }
      }
    }
  }
}

function register(channel, handler) {
  ipcMain.handle(channel, wrap(handler))
}

export function broadcast(channel, payload) {
  for (const w of BrowserWindow.getAllWindows()) {
    if (!w.isDestroyed()) w.webContents.send(channel, payload)
  }
}

export function registerIpc(ctx) {
  const { getCfg, persist, dataDir, logger, engine, getSession, destroySession, resolveDownloadDir } = ctx

  const logOp = (accountName, action, p, result) => {
    logger.log({ account: accountName, action, path: p, result })
  }

  // ---------- 开机自启（打包版有效；自启时带 --hidden 后台隐藏） ----------
  const AUTO_ARGS = ['--hidden']
  register('app:getLoginItem', () => {
    if (!app.isPackaged) return { enabled: false, supported: false }
    return { enabled: app.getLoginItemSettings({ args: AUTO_ARGS }).openAtLogin, supported: true }
  })

  register('app:setLoginItem', ({ enabled }) => {
    if (!app.isPackaged) return { enabled: false, supported: false }
    app.setLoginItemSettings({
      openAtLogin: !!enabled,
      args: AUTO_ARGS,
      path: app.getPath('exe')
    })
    return { enabled: app.getLoginItemSettings({ args: AUTO_ARGS }).openAtLogin, supported: true }
  })

  // ---------- 文案覆盖（data\文案覆盖.json） ----------
  register('texts:getOverride', () => {
    try {
      const overFile = path.join(dataDir, '文案覆盖.json')
      const parsed = JSON.parse(fs.readFileSync(overFile, 'utf8'))
      return { override: parsed && typeof parsed === 'object' ? parsed : null }
    } catch {
      return { override: null }
    }
  })

  // ---------- 配置 ----------
  register('config:get', () => {
    const cfg = getCfg()
    return {
      cfg: { ...cfg, accounts: sortAccounts(cfg.accounts) },
      paths: {
        dataDir,
        configFile: path.join(dataDir, 'config.json'),
        logsDir: path.join(dataDir, 'logs')
      },
      appVersion: app.getVersion()
    }
  })

  register('config:saveGlobal', ({ global }) => {
    const cfg = getCfg()
    cfg.global = migrate({ ...cfg, global }).global
    // 全局连接参数变了：所有浏览会话失效重连
    for (const id of [...ctx.sessions.keys()]) destroySession(id)
    persist()
    return getCfg()
  })

  register('accounts:replaceAll', ({ accounts }) => {
    const cfg = getCfg()
    const old = new Map(cfg.accounts.map((a) => [a.id, a]))
    const next = migrate({ ...cfg, accounts: accounts || [] })
    cfg.accounts = next.accounts
    // 凭据/编码变化的账号：会话重连；删除的账号：销毁会话
    for (const a of cfg.accounts) {
      const prev = old.get(a.id)
      if (prev && (prev.username !== a.username || prev.password !== a.password || prev.encoding !== a.encoding)) {
        destroySession(a.id)
      }
    }
    for (const id of old.keys()) {
      if (!cfg.accounts.some((a) => a.id === id)) destroySession(id)
    }
    persist()
    return sortAccounts(cfg.accounts)
  })

  register('config:export', ({ filePath }) => {
    const cfg = getCfg()
    fs.writeFileSync(filePath, JSON.stringify(cfg, null, 2), 'utf8')
    logOp('系统', 'export-config', filePath, '成功')
    return { filePath }
  })

  register('config:import', ({ filePath }) => {
    const raw = fs.readFileSync(filePath, 'utf8')
    let parsed
    try {
      parsed = JSON.parse(raw)
    } catch {
      throw new Error(E.ipc.notValidJson)
    }
    const err = validateImport(parsed)
    if (err) throw new Error(err)
    const cfg = getCfg()
    cfg.global = migrate(parsed).global
    cfg.accounts = migrate(parsed).accounts
    for (const id of [...ctx.sessions.keys()]) destroySession(id)
    persist()
    logOp('系统', 'import-config', filePath, '成功')
    return getCfg()
  })

  // ---------- 连接与浏览 ----------
  register('accounts:connect', async ({ accountId }) => {
    const cfg = getCfg()
    const account = cfg.accounts.find((a) => a.id === accountId)
    if (!account) throw new Error(E.ipc.accountDeleted)
    const session = getSession(account)
    try {
      const res = await session.enterDir(account.remotePath || '/')
      logOp(account.displayName, 'connect', res.path, '成功')
      return { ...res, encoding: session.getEncoding() }
    } catch (e) {
      logOp(account.displayName, 'connect', account.remotePath || '/', e?.title ? `失败:${e.title}` : '失败')
      throw e
    }
  })

  register('browse:enter', ({ accountId, path: p }) => {
    return withSession(accountId, (s) => s.enterDir(p))
  })

  register('browse:refresh', ({ accountId }) => {
    return withSession(accountId, (s) => s.refresh())
  })

  register('browse:parent', ({ accountId }) => {
    return withSession(accountId, (s) => s.goParent())
  })

  function withSession(accountId, fn) {
    const cfg = getCfg()
    const account = cfg.accounts.find((a) => a.id === accountId)
    if (!account) throw new Error(E.ipc.accountDeleted)
    return fn(getSession(account))
  }

  // ---------- 文件管理操作 ----------
  register('ops:mkdir', async ({ accountId, dir, name }) => {
    const cfg = getCfg()
    const account = cfg.accounts.find((a) => a.id === accountId)
    const full = await withSession(accountId, (s) => s.mkdir(dir, name))
    if (account) logOp(account.displayName, 'mkdir', full, '成功')
    return { path: full }
  })

  register('ops:rename', async ({ accountId, dir, oldName, newName }) => {
    const cfg = getCfg()
    const account = cfg.accounts.find((a) => a.id === accountId)
    const from = path.posix.join(dir, oldName)
    const to = path.posix.join(dir, newName)
    await withSession(accountId, (s) => s.rename(dir, oldName, newName))
    if (account) logOp(account.displayName, 'rename', `${from} → ${to}`, '成功')
    return {}
  })

  register('ops:delete', async ({ accountId, targets }) => {
    const cfg = getCfg()
    const account = cfg.accounts.find((a) => a.id === accountId)
    for (const t of targets || []) {
      const p = path.posix.join(t.dir || '/', t.name)
      try {
        await withSession(accountId, (s) => (t.isDir ? s.deleteDir(p) : s.deleteFile(p)))
        if (account) logOp(account.displayName, t.isDir ? 'rmdir' : 'delete', p, '成功')
      } catch (e) {
        if (account) logOp(account.displayName, t.isDir ? 'rmdir' : 'delete', p, `失败:${e?.title || e?.message}`)
        throw e
      }
    }
    return {}
  })

  /** 设置页"浏览远程路径/测试连接"：独立临时连接，不影响主界面会话。
   *  支持传草稿账号（未保存的表单值）或已存账号 id。 */
  register('remote:probe', async ({ accountId, account: draft, path: p }) => {
    const cfg = getCfg()
    let account = draft || null
    if (!account && accountId) {
      account = cfg.accounts.find((a) => a.id === accountId)
    }
    if (!account) throw new Error(E.ipc.probeNoAccount)
    const tmp = new FtpSession({
      account: {
        username: account.username || '',
        password: account.password || '',
        encoding: account.encoding || null
      },
      globalConfig: cfg.global
    })
    try {
      const res = await tmp.enterDir(p || '/')
      return { ...res, encoding: tmp.getEncoding() }
    } finally {
      tmp.destroy()
    }
  })

  // ---------- 传输 ----------
  register('transfers:list', () => engine.snapshot())

  register('transfers:enqueueUploads', ({ accountId, remoteDir, files }) => {
    const ids = []
    for (const f of files || []) {
      if (f.strategy === 'skip') continue
      const size = (() => {
        try { return fs.statSync(f.localPath).size } catch { return null }
      })()
      ids.push(engine.enqueue({
        kind: 'upload',
        accountId,
        remotePath: remoteDir,
        name: f.finalName || f.name,
        localPath: f.localPath,
        total: size
      }))
    }
    return { ids }
  })

  register('transfers:enqueueDownloads', ({ accountId, remoteDir, files, destDir }) => {
    const dest = destDir && path.isAbsolute(destDir) ? destDir : resolveDownloadDir()
    const ids = []
    for (const f of files || []) {
      if (f.strategy === 'skip') continue
      const localPath = path.join(dest, f.finalName || f.name)
      ids.push(engine.enqueue({
        kind: 'download',
        accountId,
        remotePath: remoteDir,
        name: f.finalName || f.name,
        localPath,
        total: f.size ?? null
      }))
    }
    return { ids, dest }
  })

  register('transfers:cancel', ({ id }) => { engine.cancel(id); return {} })
  register('transfers:retry', ({ id }) => { engine.retry(id); return {} })
  register('transfers:remove', ({ id }) => { engine.remove(id); return {} })

  // ---------- 本地文件 ----------
  register('local:desktopPath', () => {
    try { return { path: app.getPath('desktop') } } catch { return { path: app.getPath('home') } }
  })

  register('local:downloadDir', () => ({ path: resolveDownloadDir() }))

  register('local:existsWithSize', ({ filePath }) => {
    try {
      const st = fs.statSync(filePath)
      return { exists: true, size: st.size, isDir: st.isDirectory() }
    } catch {
      return { exists: false, size: null, isDir: false }
    }
  })

  register('local:openPath', async ({ filePath }) => {
    const err = await shell.openPath(filePath)
    if (err) throw new Error(E.ipc.openFileFailed(err))
    return {}
  })

  // ---------- Windows 原生文件图标 ----------
  const iconCache = new Map() // key('__dir__'|'__file__'|ext) -> dataURL

  async function getIconDataUrl(repPath, ext) {
    try {
      return (await app.getFileIcon(repPath, { size: 'normal' })).toDataURL()
    } catch { /* 继续走兜底 */ }
    if (ext) {
      // 个别环境对不存在的路径取图标失败：造一个 0 字节临时文件再取
      const tmp = path.join(os.tmpdir(), `betterftp-icon.${ext}`)
      try {
        fs.writeFileSync(tmp, '')
        return (await app.getFileIcon(tmp, { size: 'normal' })).toDataURL()
      } catch { /* ignore */ } finally {
        try { fs.unlinkSync(tmp) } catch { /* ignore */ }
      }
    }
    return null
  }

  register('local:fileIcons', async ({ files }) => {
    const out = {}
    const jobs = []
    for (const f of files || []) {
      const key = f.isDir ? '__dir__' : (() => {
        const i = String(f.name || '').lastIndexOf('.')
        return i > 0 ? f.name.slice(i + 1).toLowerCase().replace(/[^\w]/g, '') : '__file__'
      })()
      if (!key || iconCache.has(key)) {
        if (iconCache.has(key)) out[key] = iconCache.get(key)
        continue
      }
      const rep = f.isDir
        ? 'C:\\Windows'
        : (key === '__file__' ? 'C:\\Windows\\System32\\drivers\\etc\\hosts' : `C:\\BetterFTP\\icon.${key}`)
      jobs.push(
        getIconDataUrl(rep, f.isDir || key === '__file__' ? null : key).then((url) => {
          if (url) { iconCache.set(key, url); out[key] = url }
        })
      )
    }
    await Promise.all(jobs)
    return { icons: out }
  })

  register('local:reveal', ({ filePath }) => {
    shell.showItemInFolder(filePath)
    return {}
  })

  register('local:dedupeName', ({ dir, name }) => {
    const exists = new Set()
    try {
      for (const f of fs.readdirSync(dir)) exists.add(f)
    } catch { /* 目录不存在时无需避让 */ }
    return { name: dedupeName(name, exists) }
  })

  // ---------- 对话框 ----------
  register('dialog:pickOpenFiles', async ({ defaultPath }) => {
    const r = await dialog.showOpenDialog(ctx.getWindow(), {
      title: '选择要上传的文件',
      defaultPath: defaultPath || undefined,
      properties: ['openFile', 'multiSelections']
    })
    if (r.canceled) return { canceled: true, files: [] }
    return { canceled: false, files: r.filePaths }
  })

  register('dialog:pickDirectory', async ({ defaultPath }) => {
    const r = await dialog.showOpenDialog(ctx.getWindow(), {
      title: '选择文件夹',
      defaultPath: defaultPath || undefined,
      properties: ['openDirectory']
    })
    if (r.canceled) return { canceled: true, path: null }
    return { canceled: false, path: r.filePaths[0] }
  })

  register('dialog:pickSaveFile', async ({ defaultPath, title }) => {
    const r = await dialog.showSaveDialog(ctx.getWindow(), {
      title: title || '保存到…',
      defaultPath: defaultPath || undefined
    })
    if (r.canceled || !r.filePath) return { canceled: true, path: null }
    return { canceled: false, path: r.filePath }
  })

  register('dialog:pickOpenFile', async ({ defaultPath, title }) => {
    const r = await dialog.showOpenDialog(ctx.getWindow(), {
      title: title || '选择文件',
      defaultPath: defaultPath || undefined,
      properties: ['openFile']
    })
    if (r.canceled) return { canceled: true, path: null }
    return { canceled: false, path: r.filePaths[0] }
  })

  // ---------- 日志 ----------
  register('logs:get', ({ months = 2, limit = 2000 } = {}) => {
    return { rows: logger.read({ months, limit }) }
  })

  register('logs:clear', () => {
    logger.clear()
    logOp('系统', 'clear-logs', '', '成功')
    return {}
  })

  register('logs:exportCsv', ({ filePath }) => {
    const rows = logger.read({ months: 6, limit: 0 })
    fs.writeFileSync(filePath, OperationLogger.toCsv(rows), 'utf8')
    return { count: rows.length }
  })
}
