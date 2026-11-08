import { contextBridge, ipcRenderer } from 'electron'

/**
 * 渲染层通过 window.betterftp 访问主进程。
 * invoke 返回 {ok, data|error}：ok=false 时抛出 error 对象（含可操作提示字段）。
 */
function invoke(channel) {
  return async (payload) => {
    const res = await ipcRenderer.invoke(channel, payload)
    if (!res.ok) throw res.error
    return res.data
  }
}

function subscribe(channel) {
  return (cb) => {
    const listener = (_e, payload) => cb(payload)
    ipcRenderer.on(channel, listener)
    return () => ipcRenderer.removeListener(channel, listener)
  }
}

const api = {
  // 文案覆盖
  textsOverride: invoke('texts:getOverride'),

  // 开机自启
  getLoginItem: invoke('app:getLoginItem'),
  setLoginItem: invoke('app:setLoginItem'),

  // 配置
  configGet: invoke('config:get'),
  saveGlobal: invoke('config:saveGlobal'),
  replaceAccounts: invoke('accounts:replaceAll'),
  exportConfig: invoke('config:export'),
  importConfig: invoke('config:import'),

  // 连接与浏览
  connectAccount: invoke('accounts:connect'),
  browseEnter: invoke('browse:enter'),
  browseRefresh: invoke('browse:refresh'),
  browseParent: invoke('browse:parent'),
  remoteProbe: invoke('remote:probe'),

  // 文件管理
  opsMkdir: invoke('ops:mkdir'),
  opsRename: invoke('ops:rename'),
  opsDelete: invoke('ops:delete'),

  // 传输
  transfersList: invoke('transfers:list'),
  enqueueUploads: invoke('transfers:enqueueUploads'),
  enqueueDownloads: invoke('transfers:enqueueDownloads'),
  transferCancel: invoke('transfers:cancel'),
  transferRetry: invoke('transfers:retry'),
  transferRemove: invoke('transfers:remove'),
  onTransfersUpdated: subscribe('transfers:updated'),

  // 本地
  desktopPath: invoke('local:desktopPath'),
  downloadDir: invoke('local:downloadDir'),
  existsWithSize: invoke('local:existsWithSize'),
  openPath: invoke('local:openPath'),
  revealItem: invoke('local:reveal'),
  dedupeName: invoke('local:dedupeName'),
  fileIcons: invoke('local:fileIcons'),

  // 对话框
  pickOpenFiles: invoke('dialog:pickOpenFiles'),
  pickDirectory: invoke('dialog:pickDirectory'),
  pickSaveFile: invoke('dialog:pickSaveFile'),
  pickOpenFile: invoke('dialog:pickOpenFile'),

  // 日志
  logsGet: invoke('logs:get'),
  logsClear: invoke('logs:clear'),
  logsExportCsv: invoke('logs:exportCsv')
}

contextBridge.exposeInMainWorld('betterftp', api)
