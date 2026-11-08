import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AccountSidebar } from './components/AccountSidebar.jsx'
import { TransferDock } from './components/TransferDock.jsx'
import { SettingsPage } from './components/SettingsPage.jsx'
import { AboutPage } from './components/AboutDialog.jsx'
import { ConfirmDialog, PromptDialog, ConflictDialog, ErrorDialog, ErrorPanel } from './components/dialogs.jsx'
import { fmtSize, fmtTime, fileIcon } from './utils.js'
import { T } from './texts.js'

const api = () => window.betterftp

/** 图标缓存键：目录 → '__dir__'，无扩展名 → '__file__'，否则为小写扩展名 */
function iconKeyOf(item) {
  if (item.isDir) return '__dir__'
  const i = item.name.lastIndexOf('.')
  return i > 0 ? item.name.slice(i + 1).toLowerCase().replace(/[^\w]/g, '') || '__file__' : '__file__'
}

export default function App() {
  // ---------- 全局状态 ----------
  const [booted, setBooted] = useState(false)
  const [accounts, setAccounts] = useState([])
  const [globalCfg, setGlobalCfg] = useState(null)
  const [paths, setPaths] = useState(null)
  const [appVersion, setAppVersion] = useState('')
  const [showAbout, setShowAbout] = useState(false)
  // showAbout 为 true 时整页切换到关于页（主界面内嵌，非弹窗）
  const [view, setView] = useState('main')
  const [settingsTab, setSettingsTab] = useState('global')
  const [toast, setToast] = useState(null)

  // ---------- 浏览状态 ----------
  const [activeId, setActiveId] = useState(null)
  const [conns, setConns] = useState({})   // accountId -> {status, path, items, perms, encoding, error, fellBack}
  const [selected, setSelected] = useState(() => new Set())
  const [search, setSearch] = useState('')
  const [transfers, setTransfers] = useState([])
  const [icons, setIcons] = useState({})   // 扩展名 -> Windows 原生图标 dataURL
  const pendingOpens = useRef(new Map())   // taskId -> localPath（下载完成后自动打开）
  const autoRefreshed = useRef(new Set())  // 本轮已触发过刷新的任务 id

  // ---------- 弹窗 ----------
  const [confirmSpec, setConfirmSpec] = useState(null)
  const [promptSpec, setPromptSpec] = useState(null)
  const [conflictSpec, setConflictSpec] = useState(null)
  const [errorSpec, setErrorSpec] = useState(null)
  const confirmResolve = useRef(null)
  const promptResolve = useRef(null)
  const conflictResolve = useRef(null)
  const errorResolve = useRef(null)

  const confirm = (spec) => new Promise((r) => { confirmResolve.current = r; setConfirmSpec(spec) })
  const prompt = (spec) => new Promise((r) => { promptResolve.current = r; setPromptSpec(spec) })
  const conflict = (spec) => new Promise((r) => { conflictResolve.current = r; setConflictSpec(spec) })
  const showError = (spec) => new Promise((r) => { errorResolve.current = r; setErrorSpec(spec) })
  const showToast = (text, type = 'ok') => {
    setToast({ text, type })
    setTimeout(() => setToast(null), 2600)
  }

  // ---------- 启动 ----------
  useEffect(() => {
    ;(async () => {
      try {
        const info = await api().configGet()
        setAccounts(info.cfg.accounts)
        setGlobalCfg(info.cfg.global)
        setPaths(info.paths)
        setAppVersion(info.appVersion || '')
      } catch (e) {
        showError({ title: T.dialog.errorTitle, hint: e?.hint || String(e?.message || e), action: null })
      }
      try {
        setTransfers(await api().transfersList())
      } catch { /* 首次无任务 */ }
      setBooted(true)
    })()
  }, [])

  // 传输进度推送
  useEffect(() => {
    const off = api().onTransfersUpdated((tasks) => {
      setTransfers(tasks)
      // 上传完成后：刷新当前目录；需要自动打开的下载任务执行打开
      let needRefresh = false
      for (const t of tasks) {
        if (t.status === 'done' && !autoRefreshed.current.has(t.id)) {
          autoRefreshed.current.add(t.id)
          const target = pendingOpens.current.get(t.id)
          if (target) {
            pendingOpens.current.delete(t.id)
            api().openPath({ filePath: target }).catch((e) => showError({ title: T.msgs.openFailed, hint: e?.hint || e?.message, raw: e?.raw }))
          }
          if (t.kind === 'upload' && t.accountId === activeIdRef.current && t.remotePath === connPathRef.current) needRefresh = true
        }
      }
      if (needRefresh) refreshConn(activeIdRef.current, { silent: true })
    })
    return off
  }, [])

  // ref 镜像，供订阅回调读取最新值
  const activeIdRef = useRef(null)
  const connPathRef = useRef('/')
  useEffect(() => { activeIdRef.current = activeId }, [activeId])
  useEffect(() => {
    connPathRef.current = conns[activeId]?.path || '/'
  }, [conns, activeId])

  const activeConn = conns[activeId]
  const activeAccount = accounts.find((a) => a.id === activeId)

  // ---------- 连接与浏览 ----------
  const setConn = (id, patch) => setConns((c) => ({ ...c, [id]: { ...c[id], ...patch } }))

  const connectAccount = useCallback(async (account, { quiet = false } = {}) => {
    setActiveId(account.id)
    setSelected(new Set())
    setSearch('')
    setConn(account.id, { status: 'connecting', error: null })
    try {
      const res = await api().connectAccount({ accountId: account.id })
      setConn(account.id, {
        status: 'connected', path: res.path, items: res.items,
        perms: res.perms, encoding: res.encoding, error: null, fellBack: res.fellBack || null
      })
      if (res.fellBack) showToast(T.msgs.fellBack(res.fellBack), 'error')
    } catch (err) {
      setConn(account.id, { status: 'error', error: err })
      if (!quiet) showError(err)
    }
  }, [])

  const refreshConn = useCallback(async (accountId, { silent = false } = {}) => {
    if (!accountId) return
    try {
      const res = await api().browseRefresh({ accountId })
      setConn(accountId, { status: 'connected', path: res.path, items: res.items, perms: res.perms, error: null })
    } catch (err) {
      if (!silent) {
        setConn(accountId, { status: 'error', error: err })
        showError(err)
      }
    }
  }, [])

  const enterPath = async (p) => {
    if (!activeId) return
    setSelected(new Set())
    try {
      const res = await api().browseEnter({ accountId: activeId, path: p })
      setConn(activeId, { status: 'connected', path: res.path, items: res.items, perms: res.perms, error: null })
    } catch (err) {
      showError(err)
    }
  }

  const goParent = async () => {
    if (!activeId) return
    setSelected(new Set())
    try {
      const res = await api().browseParent({ accountId: activeId })
      setConn(activeId, { status: 'connected', path: res.path, items: res.items, perms: res.perms, error: null })
    } catch (err) {
      showError(err)
    }
  }

  // ---------- 打开（下载到桌面后打开 / 进入目录） ----------
  const openItem = async (item) => {
    if (item.isDir) return enterPath(joinRemote(activeConn.path, item.name))
    const dest = (await api().downloadDir()).path
    const localPath = dest + '\\' + item.name
    const exists = await api().existsWithSize({ filePath: localPath })
    let finalName = item.name
    if (exists.exists && exists.size !== item.size) {
      finalName = (await api().dedupeName({ dir: dest, name: item.name })).name
    }
    if (exists.exists && exists.size === item.size) {
      // 桌面上已有同名同大小文件：直接打开
      try {
        await api().openPath({ filePath: localPath })
        showToast(T.msgs.openSkippedExists)
      } catch (e) {
        showError({ title: T.msgs.openFailedTitle, hint: e?.hint || e?.message })
      }
      return
    }
    const { ids } = await api().enqueueDownloads({
      accountId: activeId,
      remoteDir: activeConn.path,
      destDir: dest,
      files: [{ name: item.name, finalName, size: item.size, strategy: 'overwrite' }]
    })
    if (ids[0]) pendingOpens.current.set(ids[0], dest + '\\' + finalName)
    showToast(T.msgs.openingAfterDownload)
  }

  // ---------- 上传 ----------
  const pickUploadFiles = async () => {
    const perms = activeConn?.perms
    if (perms === 'ro' || perms === 'none') {
      showError({ title: T.msgs.uploadDeniedRo, hint: T.msgs.uploadDeniedRoHint })
      return
    }
    const desktop = (await api().desktopPath()).path
    const r = await api().pickOpenFiles({ defaultPath: desktop })
    if (r.canceled || r.files.length === 0) return
    const items = activeConn?.items || []
    const existing = new Map(items.map((i) => [i.name, i]))
    const conflicts = r.files.filter((f) => existing.has(f.split(/[\\/]/).pop()))
    let strategy = 'overwrite'
    if (conflicts.length > 0) {
      const one = conflicts[0].split(/[\\/]/).pop()
      const remote = existing.get(one)
      const choice = await conflict({
        title: conflicts.length > 1 ? T.dialog.conflictMultiTitle(conflicts.length) : T.dialog.conflictTitle,
        name: conflicts.length > 1 ? `${one} 等 ${conflicts.length} 个文件` : one,
        detail: T.msgs.conflictRemoteDetail(fmtSize(remote?.size), fmtTime(remote?.modifiedAt)),
        oldDesc: T.msgs.oldRemote
      })
      if (choice === null) return
      if (choice === 'skip') return
      strategy = choice // 'overwrite' | 'rename'
    }
    const files = []
    for (const f of r.files) {
      const name = f.split(/[\\/]/).pop()
      let finalName = name
      if (strategy === 'rename' && conflicts.includes(f)) {
        const names = new Set(items.map((i) => i.name))
        let i = 1
        const dot = name.lastIndexOf('.')
        const base = dot > 0 ? name.slice(0, dot) : name
        const ext = dot > 0 ? name.slice(dot) : ''
        while (names.has(finalName)) finalName = `${base} (${i++})${ext}`
      }
      files.push({ localPath: f, name, finalName, strategy: 'overwrite' })
    }
    await api().enqueueUploads({ accountId: activeId, remoteDir: activeConn.path, files })
    showToast(T.msgs.queuedUploads(files.length))
  }

  // ---------- 下载（支持单个/批量） ----------
  const downloadItems = async (rawTargets) => {
    const targets = rawTargets.filter((i) => !i.isDir)
    if (targets.length === 0) {
      showToast(T.msgs.selectDownloadFirst, 'error')
      return
    }
    const dest = (await api().downloadDir()).path
    const conflicts = []
    for (const t of targets) {
      const ex = await api().existsWithSize({ filePath: dest + '\\' + t.name })
      if (ex.exists) conflicts.push({ item: t, localSize: ex.size })
    }
    let strategy = 'overwrite'
    if (conflicts.length > 0) {
      const c0 = conflicts[0]
      const same = c0.localSize === c0.item.size
      const choice = await conflict({
        title: conflicts.length > 1 ? T.msgs.conflictMultiLocalTitle(conflicts.length) : T.dialog.conflictTitle,
        name: conflicts.length > 1 ? `${c0.item.name} 等 ${conflicts.length} 个文件` : c0.item.name,
        detail: T.msgs.conflictLocalDetail(dest, fmtSize(c0.localSize), same),
        oldDesc: T.msgs.oldLocal
      })
      if (choice === null) return
      if (choice === 'skip') return
      strategy = choice
    }
    const files = []
    for (const t of targets) {
      let finalName = t.name
      if (strategy === 'rename' && conflicts.some((c) => c.item === t)) {
        finalName = (await api().dedupeName({ dir: dest, name: t.name })).name
      }
      files.push({ name: t.name, finalName, size: t.size, strategy: 'overwrite' })
    }
    await api().enqueueDownloads({ accountId: activeId, remoteDir: activeConn.path, destDir: dest, files })
    showToast(T.msgs.downloadingTo(files.length, dest))
  }

  const downloadSelected = async () => {
    await downloadItems(filteredItems().filter((i) => selected.has(i.name)))
  }

  // ---------- 新建 / 重命名 / 删除 ----------
  const mkdir = async () => {
    if (!assertManage()) return
    const name = await prompt({
      title: T.prompts.mkdirTitle, icon: '📂', okText: T.prompts.mkdirOk, placeholder: T.prompts.mkdirPlaceholder,
      validate: (v) => ((activeConn.items || []).some((i) => i.name === v && i.isDir) ? T.prompts.mkdirDup : null)
    })
    if (!name) return
    try {
      await api().opsMkdir({ accountId: activeId, dir: activeConn.path, name })
      showToast(T.msgs.mkdirCreated(name))
      refreshConn(activeId, { silent: true })
    } catch (err) { showError(err) }
  }

  const renameItem = async (item) => {
    if (!assertManage()) return
    const newName = await prompt({
      title: T.prompts.renameTitle(item.isDir), icon: '✏️', okText: T.table.rename, initial: item.name,
      validate: (v) => (v === item.name ? T.prompts.renameSame : (activeConn.items || []).some((i) => i.name === v) ? T.prompts.renameDup : null)
    })
    if (!newName) return
    try {
      await api().opsRename({ accountId: activeId, dir: activeConn.path, oldName: item.name, newName })
      setSelected(new Set())
      showToast(T.msgs.renamed)
      refreshConn(activeId, { silent: true })
    } catch (err) { showError(err) }
  }

  const deleteItems = async (targets) => {
    if (!assertManage()) return
    if (targets.length === 0) { showToast(T.msgs.selectDeleteFirst, 'error'); return }
    const dirCount = targets.filter((t) => t.isDir).length
    const names = targets.slice(0, 3).map((t) => t.name).join('、') + (targets.length > 3 ? ' 等' : '')
    const ok = await confirm({
      title: T.confirm.deleteTitle,
      danger: true,
      okText: T.confirm.deleteBtn,
      messageHtml: targets.length === 1 ? T.confirm.deleteOne(targets[0].name) : T.confirm.deleteMany(targets.length, names),
      warn: dirCount > 0 ? T.confirm.deleteDirWarn : T.confirm.deleteWarn
    })
    if (!ok) return
    try {
      await api().opsDelete({
        accountId: activeId,
        targets: targets.map((t) => ({ dir: activeConn.path, name: t.name, isDir: t.isDir }))
      })
      setSelected(new Set())
      showToast(T.msgs.deleted(targets.length))
      refreshConn(activeId, { silent: true })
    } catch (err) {
      showError(err)
      refreshConn(activeId, { silent: true })
    }
  }

  const deleteSelected = async () => {
    await deleteItems((activeConn.items || []).filter((i) => selected.has(i.name)))
  }

  const assertManage = () => {
    const perms = activeConn?.perms
    if (perms === 'ro' || perms === 'none') {
      showError({ title: T.msgs.manageDeniedRo, hint: T.msgs.manageDeniedRoHint })
      return false
    }
    return true
  }

  // ---------- 列表 ----------
  const filteredItems = () => {
    const items = activeConn?.items || []
    if (!search.trim()) return items
    const q = search.trim().toLowerCase()
    return items.filter((i) => i.name.toLowerCase().includes(q))
  }

  const toggleSelect = (item) => {
    setSelected((s) => {
      const n = new Set(s)
      if (n.has(item.name)) n.delete(item.name)
      else n.add(item.name)
      return n
    })
  }

  const perms = activeConn?.perms || 'unknown'
  const permInfo = T.perms[perms] || T.perms.unknown
  const canUpload = ['rw', 'w', 'unknown'].includes(perms)
  const canManage = ['rw', 'unknown'].includes(perms)
  const canDownload = ['rw', 'ro', 'unknown'].includes(perms)

  // ---------- Windows 原生图标 ----------
  useEffect(() => {
    const items = activeConn?.items
    if (!items?.length) return
    const keys = new Set(items.map(iconKeyOf))
    const missing = [...keys].filter((k) => !(k in icons))
    if (missing.length === 0) return
    api().fileIcons({
      files: items
        .filter((it) => missing.includes(iconKeyOf(it)))
        .map((it) => ({ name: it.name, isDir: it.isDir }))
    }).then(({ icons: got }) => { if (got && Object.keys(got).length) setIcons((m) => ({ ...m, ...got })) }).catch(() => { /* 图标失败用 emoji 兜底 */ })
  }, [activeConn?.items, icons])

  // ---------- 面包屑 ----------
  const crumbs = useMemo(() => {
    const p = activeConn?.path || '/'
    const parts = [{ name: T.top.rootCrumb, path: '/' }]
    if (p !== '/') {
      let cur = ''
      for (const seg of p.slice(1).split('/')) {
        cur += '/' + seg
        parts.push({ name: seg, path: cur })
      }
    }
    return parts
  }, [activeConn?.path])

  const items = filteredItems()

  if (!booted) {
    return <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', color: 'var(--text-3)' }}>…</div>
  }

  const goSettings = (tab = 'global') => { setSettingsTab(tab); setView('settings') }
  const connected = activeConn?.status === 'connected'
  const listable = connected && perms !== 'w' && perms !== 'none'

  return (
    <div className="app">
      <AccountSidebar
        accounts={accounts}
        connStates={conns}
        activeId={activeId}
        onSelect={(a) => { if (view === 'settings') setView('main'); if (a.id !== activeId) connectAccount(a) }}
        onAdd={() => goSettings('accounts')}
        onOpenSettings={() => goSettings('global')}
        onOpenAbout={() => { setShowAbout(true); setView('about') }}
      />

      {view === 'settings' ? (
        <SettingsPage
          accounts={accounts}
          globalCfg={globalCfg}
          paths={paths}
          tab={settingsTab}
          onTab={setSettingsTab}
          onBack={() => setView('main')}
          onAccountsChanged={(list) => setAccounts(list)}
          onGlobalChanged={(g) => setGlobalCfg(g)}
          showError={showError}
          confirm={confirm}
          showToast={showToast}
        />
      ) : view === 'about' ? (
        <AboutPage version={appVersion} onBack={() => { setShowAbout(false); setView('main') }} />
      ) : (
        <div className="main">
          {/* 顶栏（两行：状态行 + 路径行） */}
          <div className="topbar">
            <div className="topbar-row">
              <div className="who">
                <span style={{ color: activeAccount?.color }}>●</span>
                <span className="who-name">{activeAccount ? activeAccount.displayName : T.top.unselected}</span>
                <span className="conn">
                  {connected && T.top.connected}
                  {activeConn?.status === 'connecting' && T.top.connecting}
                  {activeConn?.status === 'error' && T.top.connectFailed}
                  {!activeConn && T.top.hintPickAccount}
                </span>
              </div>
              {connected && (
                <span className={`badge ${permInfo.cls}`} title={permInfo.tip}>{permInfo.text}</span>
              )}
              {connected && activeConn.encoding === 'gbk' && (
                <span className="badge muted" title="与服务器通信使用的文件名编码">{T.top.gbkBadge}</span>
              )}
              <div className="top-actions">
                {listable && (
                  <div className="search-wrap">
                    <span className="icon">🔍</span>
                    <input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder={T.top.searchPlaceholder}
                    />
                  </div>
                )}
              </div>
            </div>
            <div className="topbar-row path-row">
              <button className="btn icon" disabled={!connected} onClick={goParent} title={T.top.parentTitle}>↑</button>
              <button className="btn icon" disabled={!connected} onClick={() => refreshConn(activeId)} title={T.top.refreshTitle}>⟳</button>
              {listable && (
                <div className="crumb-box">
                  <div className="crumbs">
                    {crumbs.map((c, i) => (
                      <React.Fragment key={c.path}>
                        {i > 0 && <span className="crumb-sep">›</span>}
                        <button
                          className={`crumb${i === crumbs.length - 1 ? ' current' : ''}`}
                          onClick={() => enterPath(c.path)}
                        >{c.name}</button>
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 文件区 */}
          <FileArea
            conn={activeConn}
            hasAccounts={accounts.length > 0}
            items={items}
            selected={selected}
            search={search}
            icons={icons}
            canDownload={canDownload}
            canManage={canManage}
            onRetry={() => { const a = activeAccount || accounts.find((x) => x.id === activeId); if (a) connectAccount(a) }}
            onGoSettings={() => goSettings('accounts')}
            onOpen={openItem}
            onDownload={(item) => downloadItems([item])}
            onRename={renameItem}
            onDelete={(item) => deleteItems([item])}
            onToggle={toggleSelect}
            onAddAccount={() => goSettings('accounts')}
          />

          {/* 操作按钮行 */}
          <div className="action-bar">
            <button className="btn primary" disabled={!connected || !canUpload} onClick={pickUploadFiles}>⬆ {T.actions.upload}</button>
            <button className="btn" disabled={!connected || !canDownload} onClick={downloadSelected}>⬇ {T.actions.download}</button>
            <button className="btn" disabled={!connected || !canManage} onClick={mkdir}>{T.actions.mkdir}</button>
            <span className="action-hint">
              {selected.size > 0 ? T.actions.selected(selected.size) : T.actions.hint}
            </span>
          </div>

          <TransferDock
            tasks={transfers}
            onCancel={(id) => api().transferCancel({ id })}
            onRetry={(id) => api().transferRetry({ id })}
            onReveal={(t) => api().revealItem({ filePath: t.localPath })}
          />
        </div>
      )}

      {/* 弹窗 */}
      <ConfirmDialog spec={confirmSpec} onResult={(v) => { setConfirmSpec(null); confirmResolve.current?.(v) }} />
      <PromptDialog spec={promptSpec} onResult={(v) => { setPromptSpec(null); promptResolve.current?.(v) }} />
      <ConflictDialog spec={conflictSpec} onResult={(v) => { setConflictSpec(null); conflictResolve.current?.(v) }} />
      <ErrorDialog spec={errorSpec} onResult={() => { setErrorSpec(null); errorResolve.current?.() }} onGoSettings={() => goSettings('accounts')} />

      {toast && <div className={`toast ${toast.type === 'error' ? 'error' : ''}`}>{toast.text}</div>}
    </div>
  )
}

/** 文件区（空态/骨架/错误面板 + 列表 + 行内操作按钮） */
function FileArea({ conn, hasAccounts, items, selected, search, icons, canDownload, canManage, onRetry, onGoSettings, onOpen, onDownload, onRename, onDelete, onToggle, onAddAccount }) {
  if (!conn) {
    return (
      <div className="file-area">
        <div className="empty-state">
          <div className="big">👋</div>
          <div className="title">{hasAccounts ? T.empty.pickAccount : T.empty.welcome}</div>
          <div>{hasAccounts ? T.empty.pickAccountHint : T.empty.welcomeHint}</div>
          {hasAccounts
            ? <div className="pick-hint">← {T.empty.pickAccountBtn}</div>
            : <button className="btn primary" onClick={onAddAccount}>{T.empty.addAccount}</button>}
        </div>
      </div>
    )
  }
  if (conn.status === 'connecting') {
    return (
      <div className="file-area">
        <div className="file-panel">
          {[...Array(6)].map((_, i) => <div key={i} className="skeleton-line" style={{ width: `${88 - i * 7}%` }} />)}
        </div>
      </div>
    )
  }
  if (conn.status === 'error') {
    return (
      <div className="file-area" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <ErrorPanel error={conn.error} onRetry={onRetry} onGoSettings={onGoSettings} />
      </div>
    )
  }
  // connected
  if (conn.perms === 'w') {
    return (
      <div className="file-area">
        <div className="empty-state">
          <div className="big">📮</div>
          <div className="title">{T.empty.dropboxTitle}</div>
          <div>{T.empty.dropboxHint}</div>
        </div>
      </div>
    )
  }
  if (items.length === 0) {
    return (
      <div className="file-area">
        <div className="empty-state">
          <div className="big">🗂️</div>
          <div className="title">{search ? T.empty.noSearchMatch(search) : T.empty.dirEmpty}</div>
          <div>{search ? T.empty.noSearchMatchHint : T.empty.dirEmptyHint}</div>
        </div>
      </div>
    )
  }
  return (
    <div className="file-area">
      <table className="file-table">
        <thead>
          <tr>
            <th>{T.table.name}</th>
            <th className="col-size">{T.table.size}</th>
            <th className="col-time">{T.table.time}</th>
            <th className="col-actions-h">{T.table.actions}</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr
              key={item.name}
              className={selected.has(item.name) ? 'selected' : ''}
              onClick={() => onToggle(item)}
              onDoubleClick={() => onOpen(item)}
              title={item.isDir ? T.table.rowTipDir : T.table.rowTipFile}
            >
              <td>
                <div className="f-name">
                  <FileIcon item={item} icons={icons} />
                  <span className="txt">{item.name}</span>
                </div>
              </td>
              <td className="col-size">{item.isDir ? '—' : fmtSize(item.size)}</td>
              <td className="col-time">{fmtTime(item.modifiedAt)}</td>
              <td className="col-actions">
                <div className="row-actions">
                  <button className="rbtn" onClick={(e) => { e.stopPropagation(); onOpen(item) }} title={T.table.open}>{T.table.open}</button>
                  <button
                    className="rbtn"
                    disabled={item.isDir || !canDownload}
                    onClick={(e) => { e.stopPropagation(); onDownload(item) }}
                    title={item.isDir ? T.table.dirNoDownload : T.table.download}
                  >{T.table.download}</button>
                  <button
                    className="rbtn"
                    disabled={!canManage}
                    onClick={(e) => { e.stopPropagation(); onRename(item) }}
                    title={canManage ? T.table.rename : T.table.noPerm}
                  >{T.table.rename}</button>
                  <button
                    className="rbtn danger"
                    disabled={!canManage}
                    onClick={(e) => { e.stopPropagation(); onDelete(item) }}
                    title={canManage ? T.table.delete : T.table.noPerm}
                  >{T.table.delete}</button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function joinRemote(base, name) {
  return base === '/' ? '/' + name : base + '/' + name
}

/** 文件图标：Windows 原生图标（加载失败回退 emoji） */
function FileIcon({ item, icons }) {
  const url = icons?.[iconKeyOf(item)]
  if (url) return <img className="f-ico" src={url} alt="" draggable={false} />
  return <span>{fileIcon(item)}</span>
}
