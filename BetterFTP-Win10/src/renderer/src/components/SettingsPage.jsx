import React, { useCallback, useEffect, useState } from 'react'
import { Modal } from './dialogs.jsx'
import { fmtClock } from '../utils.js'
import { T } from '../texts.js'

const api = () => window.betterftp

const PRESET_COLORS = ['#3B82F6', '#F59E0B', '#10B981', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16']

function validateServerAddress(raw) {
  const s = String(raw ?? '').trim()
  if (!s) return T.settings.addrEmpty
  const scheme = /^[a-z][a-z0-9+.-]*:\/\//i.exec(s)
  if (scheme) return T.settings.addrScheme(scheme[0])
  if (s.includes('/')) return T.settings.addrPath
  if (s.includes(':')) return T.settings.addrPort(s)
  if (!/^[\w.-]+$/.test(s)) return T.settings.addrBad
  return null
}

function emptyAccount() {
  return {
    id: null,
    displayName: '',
    username: '',
    password: '',
    remotePath: '/',
    encoding: null,
    color: PRESET_COLORS[Math.floor(Math.random() * PRESET_COLORS.length)],
    note: ''
  }
}

export function SettingsPage({ accounts, globalCfg, paths, tab, onTab, onBack, onAccountsChanged, onGlobalChanged, showError, confirm, showToast }) {
  return (
    <div className="settings">
      <div className="settings-header">
        <button className="btn" onClick={onBack}>{T.settings.back}</button>
        <h2>{T.settings.title}</h2>
      </div>
      <div className="tabs">
        <button className={`tab${tab === 'global' ? ' active' : ''}`} onClick={() => onTab('global')}>{T.settings.tabGlobal}</button>
        <button className={`tab${tab === 'accounts' ? ' active' : ''}`} onClick={() => onTab('accounts')}>{T.settings.tabAccounts}</button>
        <button className={`tab${tab === 'logs' ? ' active' : ''}`} onClick={() => onTab('logs')}>{T.settings.tabLogs}</button>
      </div>

      {tab === 'global' && <GlobalTab globalCfg={globalCfg} paths={paths} accounts={accounts} onSaved={onGlobalChanged} onAccountsChanged={onAccountsChanged} showError={showError} confirm={confirm} showToast={showToast} />}
      {tab === 'accounts' && <AccountsTab accounts={accounts} globalCfg={globalCfg} onAccountsChanged={onAccountsChanged} showError={showError} confirm={confirm} showToast={showToast} />}
      {tab === 'logs' && <LogsTab accounts={accounts} showError={showError} confirm={confirm} showToast={showToast} />}
    </div>
  )
}

/* ================= 全局 ================= */

function GlobalTab({ globalCfg, paths, accounts, onSaved, onAccountsChanged, showError, confirm, showToast }) {
  const [autoStart, setAutoStart] = useState(false)
  useEffect(() => {
    api().getLoginItem?.().then((r) => setAutoStart(!!r.enabled)).catch(() => {})
  }, [])
  const toggleAutoStart = async (on) => {
    try {
      const r = await api().setLoginItem?.({ enabled: on })
      setAutoStart(!!r.enabled)
      if (!r.supported) showToast('开发模式下不可设置，请用打包版')
      else showToast(r.enabled ? '已开启开机自动启动' : '已关闭开机自动启动')
    } catch (e) { showError(e) }
  }
  const [form, setForm] = useState(() => ({
    host: globalCfg.server.host,
    port: globalCfg.server.port,
    encoding: globalCfg.encoding,
    timeoutSec: Math.round(globalCfg.timeoutMs / 1000),
    passive: globalCfg.passive,
    maxConcurrentTransfers: globalCfg.maxConcurrentTransfers,
    downloadDir: globalCfg.downloadDir
  }))
  useEffect(() => {
    setForm({
      host: globalCfg.server.host,
      port: globalCfg.server.port,
      encoding: globalCfg.encoding,
      timeoutSec: Math.round(globalCfg.timeoutMs / 1000),
      passive: globalCfg.passive,
      maxConcurrentTransfers: globalCfg.maxConcurrentTransfers,
      downloadDir: globalCfg.downloadDir
    })
  }, [globalCfg])

  const save = async () => {
    const port = Number(form.port)
    const sec = Number(form.timeoutSec)
    const addrErr = validateServerAddress(form.host)
    if (addrErr) { showError({ title: T.settings.errHostEmpty, hint: addrErr }); return }
    if (!Number.isInteger(port) || port <= 0 || port > 65535) { showError({ title: T.settings.errPort, hint: T.settings.errPortHint }); return }
    if (!Number.isFinite(sec) || sec < 3 || sec > 300) { showError({ title: T.settings.errTimeout, hint: T.settings.errTimeoutHint }); return }
    try {
      const next = await api().saveGlobal({
        global: {
          ...globalCfg,
          server: { host: form.host.trim(), port },
          encoding: form.encoding,
          timeoutMs: Math.round(sec * 1000),
          passive: form.passive,
          maxConcurrentTransfers: Number(form.maxConcurrentTransfers),
          downloadDir: form.downloadDir
        }
      })
      onSaved(next.global)
      showToast(T.settings.savedToast)
    } catch (e) { showError(e) }
  }

  const pickDir = async () => {
    const r = await api().pickDirectory({ defaultPath: form.downloadDir !== 'desktop' ? form.downloadDir : undefined })
    if (!r.canceled && r.path) setForm({ ...form, downloadDir: r.path })
  }

  const exportCfg = async () => {
    const r = await api().pickSaveFile({
      title: T.settings.export,
      defaultPath: `BetterFTP配置备份-${new Date().toISOString().slice(0, 10)}.json`
    })
    if (r.canceled) return
    try {
      await api().exportConfig({ filePath: r.path })
      showToast(T.settings.exportToast(r.path))
    } catch (e) { showError(e) }
  }

  const importCfg = async () => {
    const r = await api().pickOpenFile({ title: T.settings.import })
    if (r.canceled) return
    const ok = await confirm({
      title: T.confirm.importTitle,
      messageHtml: T.confirm.importMsg(accounts.length),
      warn: T.confirm.importWarn,
      okText: T.confirm.importBtn
    })
    if (!ok) return
    try {
      const cfg = await api().importConfig({ filePath: r.path })
      onAccountsChanged(cfg.accounts)
      onSaved(cfg.global)
      showToast(T.settings.importSuccess)
    } catch (e) { showError({ title: T.settings.importFailed, hint: e?.message, raw: e?.raw }) }
  }

  return (
    <>
      <div className="card">
        <h3>{T.settings.serverSection}</h3>
        <div className="form-grid">
          <label>{T.settings.host}</label>
          <input className="input" value={form.host} onChange={(e) => setForm({ ...form, host: e.target.value })} placeholder={T.settings.hostPh} />
          <label>{T.settings.port}</label>
          <input className="input short" value={form.port} onChange={(e) => setForm({ ...form, port: e.target.value })} />
          <label>{T.settings.encoding}</label>
          <select className="select" value={form.encoding} onChange={(e) => setForm({ ...form, encoding: e.target.value })} style={{ maxWidth: 240 }}>
            <option value="auto">{T.settings.encAuto}</option>
            <option value="utf-8">{T.settings.encUtf8}</option>
            <option value="gbk">{T.settings.encGbk}</option>
          </select>
          <label>{T.settings.timeout}</label>
          <input className="input short" value={form.timeoutSec} onChange={(e) => setForm({ ...form, timeoutSec: e.target.value })} />
          <label>{T.settings.passive}</label>
          <div className="switch-row">
            <input type="checkbox" checked={form.passive} onChange={(e) => setForm({ ...form, passive: e.target.checked })} id="sw-passive" />
            <label htmlFor="sw-passive" style={{ color: 'var(--text-2)' }}>
              {T.settings.passiveHint}
            </label>
          </div>
          <label>{T.settings.concurrency}</label>
          <select className="select" value={form.maxConcurrentTransfers} onChange={(e) => setForm({ ...form, maxConcurrentTransfers: Number(e.target.value) })} style={{ maxWidth: 240 }}>
            {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{T.settings.concurrencyOpt(n)}</option>)}
          </select>
          <div className="full hint-text">{T.settings.concurrencyHint}</div>
          <label>{T.settings.downloadDir}</label>
          <div className="inline-row">
            <input className="input grow" readOnly value={form.downloadDir === 'desktop' ? T.settings.downloadDirDesktop : form.downloadDir} onClick={pickDir} style={{ cursor: 'pointer' }} />
            <button className="btn" onClick={pickDir}>{T.settings.pick}</button>
            <button className="btn" onClick={() => setForm({ ...form, downloadDir: 'desktop' })}>{T.settings.resetDesktop}</button>
          </div>
        </div>
        <div className="form-grid" style={{ marginTop: 4 }}>
          <label>{T.settings.autoStart}</label>
          <div className="switch-row">
            <input type="checkbox" checked={autoStart} onChange={(e) => toggleAutoStart(e.target.checked)} id="sw-autostart" />
            <label htmlFor="sw-autostart" style={{ color: 'var(--text-2)' }}>{T.settings.autoStartHint}</label>
          </div>
        </div>
        <div style={{ marginTop: 16 }}>
          <button className="btn primary" onClick={save}>{T.settings.save}</button>
        </div>
      </div>

      <div className="card">
        <h3>{T.settings.backupSection}</h3>
        <div className="backup-row">
          <button className="btn" onClick={exportCfg}>{T.settings.export}</button>
          <button className="btn" onClick={importCfg}>{T.settings.import}</button>
        </div>
        <div className="hint-text" style={{ marginTop: 10 }}>
          {T.settings.backupHint}
        </div>
      </div>

      <div className="card">
        <h3>{T.settings.dataSection}</h3>
        <div className="form-grid" style={{ gridTemplateColumns: '130px 1fr' }}>
          <label>{T.settings.configFile}</label>
          <div className="path-box">{paths.configFile || T.settings.autoDetectPending}</div>
          <label>{T.settings.logsDirLabel}</label>
          <div className="path-box">{paths.logsDir || T.settings.autoDetectPending}</div>
        </div>
        <div className="warn-text" style={{ marginTop: 12 }}>
          {T.settings.dataHint}
        </div>
      </div>
    </>
  )
}

/* ================= 账号管理 ================= */

function AccountsTab({ accounts, globalCfg, onAccountsChanged, showError, confirm, showToast }) {
  const [editing, setEditing] = useState(null) // 账号草稿或 null

  const saveOrder = async (list) => {
    try {
      const saved = await api().replaceAccounts({ accounts: list })
      onAccountsChanged(saved)
    } catch (e) { showError(e) }
  }

  const move = async (idx, delta) => {
    const list = [...accounts]
    const j = idx + delta
    if (j < 0 || j >= list.length) return
    ;[list[idx], list[j]] = [list[j], list[idx]]
    await saveOrder(list.map((a, i) => ({ ...a, order: i })))
  }

  const remove = async (a) => {
    const ok = await confirm({
      title: T.confirm.deleteAccountTitle,
      danger: true,
      okText: T.confirm.deleteAccountBtn,
      messageHtml: T.confirm.deleteAccountMsg(a.displayName, a.username),
      warn: T.confirm.deleteAccountWarn
    })
    if (!ok) return
    await saveOrder(accounts.filter((x) => x.id !== a.id).map((x, i) => ({ ...x, order: i })))
    showToast(T.settings.accountDeletedToast)
  }

  const saveEdit = async (draft) => {
    const list = draft.id
      ? accounts.map((a) => (a.id === draft.id ? draft : a))
      : [...accounts, { ...draft, id: undefined, order: accounts.length }]
    try {
      const saved = await api().replaceAccounts({ accounts: list.map((a, i) => ({ ...a, order: i })) })
      onAccountsChanged(saved)
      setEditing(null)
      showToast(T.settings.accountSavedToast)
    } catch (e) { showError(e) }
  }

  return (
    <>
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
          <h3 style={{ margin: 0 }}>{T.settings.accountsTitle(accounts.length)}</h3>
          <button className="btn primary" style={{ marginLeft: 'auto' }} onClick={() => setEditing(emptyAccount())}>{T.settings.addAccount}</button>
        </div>
        {accounts.length === 0 && <div className="hint-text">{T.settings.noAccounts}</div>}
        {accounts.map((a, i) => (
          <div className="account-manage-row" key={a.id}>
            <span className="dot" style={{ background: a.color }} />
            <div className="info">
              <div className="n">{a.displayName}{a.note && <span style={{ color: 'var(--text-3)', fontWeight: 400 }}> · {a.note}</span>}</div>
              <div className="d">{a.username} → {a.remotePath}</div>
            </div>
            <div className="ops">
              <button className="btn mini" onClick={() => setEditing({ ...a })}>{T.settings.edit}</button>
              <button className="btn mini" disabled={i === 0} onClick={() => move(i, -1)} title={T.settings.moveUp}>↑</button>
              <button className="btn mini" disabled={i === accounts.length - 1} onClick={() => move(i, 1)} title={T.settings.moveDown}>↓</button>
              <button className="btn mini danger" onClick={() => remove(a)}>{T.settings.del}</button>
            </div>
          </div>
        ))}
      </div>

      {editing && (
        <AccountEditor
          draft={editing}
          globalEncoding={globalCfg.encoding}
          onClose={() => setEditing(null)}
          onSave={saveEdit}
          showError={showError}
        />
      )}
    </>
  )
}

function AccountEditor({ draft, globalEncoding, onClose, onSave, showError }) {
  const [form, setForm] = useState(draft)
  const [showPwd, setShowPwd] = useState(false)
  const [probe, setProbe] = useState(null)   // {ok, msg} | null
  const [probing, setProbing] = useState(false)
  const [picker, setPicker] = useState(false)

  const test = async () => {
    if (!form.username.trim()) { setProbe({ ok: false, msg: T.settings.needUsername }); return }
    setProbing(true)
    setProbe(null)
    try {
      const res = await api().remoteProbe({ account: form, path: '/' })
      setProbe({ ok: true, msg: T.settings.testOk(res.encoding) })
    } catch (e) {
      setProbe({ ok: false, msg: `${e.title} ${e.hint || ''}` })
    } finally {
      setProbing(false)
    }
  }

  const submit = () => {
    if (!form.displayName.trim()) { showError(T.settings.needDisplayName); return }
    if (!form.username.trim()) { showError(T.settings.needUsernameSave); return }
    onSave({ ...form, displayName: form.displayName.trim(), username: form.username.trim(), remotePath: form.remotePath || '/' })
  }

  return (
    <Modal
      wide
      title={draft.id ? T.settings.editorEdit : T.settings.editorNew}
      icon="👤"
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={test} disabled={probing}>{probing ? T.settings.testing : T.settings.testConn}</button>
          <div className="spacer" />
          <button className="btn" onClick={onClose}>{T.dialog.cancel}</button>
          <button className="btn primary" onClick={submit}>{T.dialog.ok}</button>
        </>
      }
    >
      <div className="form-grid">
        <label>{T.settings.displayName}</label>
        <input className="input" value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} placeholder={T.settings.displayNamePh} />
        <label>{T.settings.username}</label>
        <input className="input" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} placeholder={T.settings.usernamePh} />
        <label>{T.settings.password}</label>
        <div className="inline-row">
          <input className="input grow" type={showPwd ? 'text' : 'password'} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder={T.settings.passwordPh} />
          <button className="btn" onClick={() => setShowPwd(!showPwd)}>{showPwd ? T.settings.hide : T.settings.show}</button>
        </div>
        <label>{T.settings.remotePath}</label>
        <div className="inline-row">
          <input className="input grow" value={form.remotePath} onChange={(e) => setForm({ ...form, remotePath: e.target.value })} placeholder={T.settings.remotePathPh} />
          <button className="btn" onClick={() => setPicker(true)}>{T.settings.browse}</button>
        </div>
        <label>{T.settings.encoding}</label>
        <select className="select" value={form.encoding || ''} onChange={(e) => setForm({ ...form, encoding: e.target.value || null })} style={{ maxWidth: 260 }}>
          <option value="">{T.settings.encodingFollow(globalEncoding === 'auto' ? T.settings.encAuto : globalEncoding)}</option>
          <option value="utf-8">{T.settings.encUtf8}</option>
          <option value="gbk">{T.settings.encGbk}</option>
        </select>
        <label>{T.settings.color}</label>
        <div className="color-dots">
          {PRESET_COLORS.map((c) => (
            <button
              key={c}
              className={`color-dot${form.color === c ? ' selected' : ''}`}
              style={{ background: c }}
              onClick={() => setForm({ ...form, color: c })}
              title={c}
            />
          ))}
        </div>
        <label>{T.settings.note}</label>
        <input className="input" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder={T.settings.notePh} />
      </div>
      {probe && (
        <div className={probe.ok ? 'warn-text' : 'err-text'} style={{ background: probe.ok ? 'var(--ok-weak)' : undefined, color: probe.ok ? 'var(--ok)' : undefined, marginTop: 14 }}>
          {probe.ok ? '✅ ' : '❌ '}{probe.msg}
        </div>
      )}
      {picker && (
        <RemotePathPicker
          draft={form}
          initialPath={form.remotePath || '/'}
          onClose={() => setPicker(false)}
          onPick={(p) => { setForm({ ...form, remotePath: p }); setPicker(false) }}
        />
      )}
    </Modal>
  )
}

/** 远程路径选择器：用临时连接浏览目录树，点选一个目录 */
function RemotePathPicker({ draft, initialPath, onClose, onPick }) {
  const [path, setPath] = useState(initialPath)
  const [dirs, setDirs] = useState([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState(null)

  const load = useCallback(async (p) => {
    setLoading(true)
    setErr(null)
    try {
      const res = await api().remoteProbe({ account: draft, path: p })
      setPath(res.path)
      setDirs(res.items.filter((i) => i.isDir))
    } catch (e) {
      setErr(e)
      setDirs([])
    } finally {
      setLoading(false)
    }
  }, [draft])

  useEffect(() => { load(initialPath) }, [load, initialPath])

  const crumbs = []
  {
    let cur = ''
    crumbs.push({ name: T.top.rootCrumb, path: '/' })
    if (path !== '/') {
      for (const seg of path.slice(1).split('/')) {
        cur += '/' + seg
        crumbs.push({ name: seg, path: cur })
      }
    }
  }

  return (
    <Modal
      wide
      title={T.settings.pathPickerTitle}
      icon="📁"
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={() => load('/')}>{T.settings.backRoot}</button>
          <div className="spacer" />
          <button className="btn" onClick={onClose}>{T.dialog.cancel}</button>
          <button className="btn primary" onClick={() => onPick(path)}>{T.settings.pickThis}</button>
        </>
      }
    >
      <div className="crumbs" style={{ marginBottom: 4 }}>
        {crumbs.map((c, i) => (
          <React.Fragment key={c.path}>
            {i > 0 && <span className="crumb-sep">›</span>}
            <button className={`crumb${i === crumbs.length - 1 ? ' current' : ''}`} onClick={() => load(c.path)}>{c.name}</button>
          </React.Fragment>
        ))}
      </div>
      <div className="path-picker-list">
        {loading && <div className="path-picker-empty">{T.settings.pickerLoading}</div>}
        {!loading && err && (
          <div className="path-picker-empty">
            ❌ {err.title}
            <div style={{ marginTop: 6, fontSize: 12.5, color: 'var(--text-2)', lineHeight: 1.6 }}>{err.hint}</div>
            <button className="btn" style={{ marginTop: 10 }} onClick={() => load(path)}>{T.empty.retry}</button>
          </div>
        )}
        {!loading && !err && dirs.length === 0 && <div className="path-picker-empty">{T.settings.noSubdirs}</div>}
        {!loading && !err && dirs.map((d) => (
          <button key={d.name} className="path-picker-item" onClick={() => load(path === '/' ? '/' + d.name : path + '/' + d.name)}>
            <span>📁</span><span>{d.name}</span><span style={{ marginLeft: 'auto', color: 'var(--text-3)', fontSize: 12 }}>{T.settings.pickerEnter}</span>
          </button>
        ))}
      </div>
      <div className="hint-text" style={{ marginTop: 10 }}>
        {T.settings.pickerHint}
      </div>
    </Modal>
  )
}

/* ================= 操作日志 ================= */

function LogsTab({ accounts, showError, confirm, showToast }) {
  const [rows, setRows] = useState([])
  const [months, setMonths] = useState(2)
  const [accountFilter, setAccountFilter] = useState('')
  const [actionFilter, setActionFilter] = useState('')
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await api().logsGet({ months, limit: 5000 })
      setRows(r.rows)
    } catch (e) { showError(e) } finally { setLoading(false) }
  }, [months])

  useEffect(() => { load() }, [load])

  const filtered = rows.filter((r) => {
    if (accountFilter && r.account !== accountFilter) return false
    if (actionFilter === 'transfer' && !['upload', 'download'].includes(r.action)) return false
    if (actionFilter === 'manage' && !['mkdir', 'rename', 'delete', 'rmdir'].includes(r.action)) return false
    if (actionFilter === 'connect' && r.action !== 'connect') return false
    if (text && !(r.path || '').toLowerCase().includes(text.toLowerCase()) && !(r.account || '').toLowerCase().includes(text.toLowerCase())) return false
    return true
  })

  const exportCsv = async () => {
    const r = await api().pickSaveFile({ title: T.settings.exportCsv, defaultPath: `BetterFTP操作日志-${new Date().toISOString().slice(0, 10)}.csv` })
    if (r.canceled) return
    try {
      const { count } = await api().logsExportCsv({ filePath: r.path })
      showToast(T.settings.exportCsvToast(count))
    } catch (e) { showError(e) }
  }

  const clear = async () => {
    const ok = await confirm({
      title: T.confirm.clearLogsTitle, danger: true, okText: T.confirm.clearLogsBtn,
      message: T.confirm.clearLogsMsg
    })
    if (!ok) return
    try { await api().logsClear(); load(); showToast(T.settings.clearedToast) } catch (e) { showError(e) }
  }

  return (
    <div className="card">
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12, gap: 10, flexWrap: 'wrap' }}>
        <h3 style={{ margin: 0 }}>{T.settings.logsTitle}{loading && <span style={{ color: 'var(--text-3)', fontWeight: 400 }}>{T.settings.loading}</span>}</h3>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button className="btn" onClick={load}>{T.settings.refreshLogs}</button>
          <button className="btn" onClick={exportCsv}>{T.settings.exportCsv}</button>
          <button className="btn danger" onClick={clear}>{T.settings.clear}</button>
        </div>
      </div>
      <div className="log-filters">
        <select className="select" style={{ width: 160 }} value={accountFilter} onChange={(e) => setAccountFilter(e.target.value)}>
          <option value="">{T.settings.allAccounts}</option>
          {accounts.map((a) => <option key={a.id} value={a.displayName}>{a.displayName}</option>)}
          <option value={T.settings.system}>{T.settings.system}</option>
        </select>
        <select className="select" style={{ width: 150 }} value={actionFilter} onChange={(e) => setActionFilter(e.target.value)}>
          <option value="">{T.settings.allActions}</option>
          <option value="transfer">{T.settings.filterTransfer}</option>
          <option value="manage">{T.settings.filterManage}</option>
          <option value="connect">{T.settings.filterConnect}</option>
        </select>
        <select className="select" style={{ width: 130 }} value={months} onChange={(e) => setMonths(Number(e.target.value))}>
          {[1, 2, 3, 6].map((m) => <option key={m} value={m}>{T.settings.lastMonth(m)}</option>)}
        </select>
        <input className="input" style={{ width: 200 }} placeholder={T.settings.searchPh} value={text} onChange={(e) => setText(e.target.value)} />
        <span className="hint-text">{T.settings.rows(filtered.length)}</span>
      </div>
      <div style={{ maxHeight: 420, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 10 }}>
        <table className="log-table">
          <thead>
            <tr><th style={{ width: 150 }}>{T.settings.colTime}</th><th style={{ width: 90 }}>{T.settings.colAccount}</th><th style={{ width: 100 }}>{T.settings.colAction}</th><th>{T.settings.colPath}</th><th style={{ width: 220 }}>{T.settings.colResult}</th></tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-3)', padding: 30 }}>{T.settings.noLogs}</td></tr>
            )}
            {[...filtered].reverse().map((r, i) => (
              <tr key={i}>
                <td>{fmtClock(r.time)}</td>
                <td>{r.account}</td>
                <td>{T.logActions[r.action] || r.action}</td>
                <td>{r.path}</td>
                <td className={r.result === '成功' ? 'res-ok' : r.result?.startsWith('失败') ? 'res-bad' : ''}>{r.result}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="hint-text" style={{ marginTop: 10 }}>{T.settings.logsHint}</div>
    </div>
  )
}
