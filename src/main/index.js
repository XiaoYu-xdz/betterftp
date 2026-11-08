import { app, BrowserWindow, Menu, shell } from 'electron'
import path from 'node:path'
import fs from 'node:fs'
import { resolveDataDir } from './paths.js'
import { loadConfig, saveConfig } from './store/config.js'
import { OperationLogger } from './store/logger.js'
import { FtpSession } from './ftp/client.js'
import { TransferEngine } from './ftp/transfer-engine.js'
import { registerIpc, broadcast } from './ipc.js'
import { applyMainTextsOverride } from './texts.js'

const isSmoke = process.argv.includes('--smoke')
// 开机自启时带 --hidden：窗口先隐藏在后台，用户点图标时由单实例聚焦秒开
const isHiddenStart = process.argv.includes('--hidden')
// 资源定位：dev = 项目根（out/ 的上一级）；打包 = app.asar。
// electron-vite 输出 CJS，__dirname 在运行时可用（不能用 import.meta.url）。
const appRoot = () => (app.isPackaged ? app.getAppPath() : path.resolve(__dirname, '../..'))

// 便携模式：PORTABLE_EXECUTABLE_DIR 由 electron-builder portable 运行时注入
const dataDir = resolveDataDir({
  isPackaged: app.isPackaged,
  exePath: app.getPath('exe'),
  portableDir: process.env.PORTABLE_EXECUTABLE_DIR || null,
  userDataDir: app.getPath('userData')
})

let cfg = null
let logger = null
let engine = null
const sessions = new Map() // accountId -> FtpSession
let mainWindow = null

function getGlobal() {
  return cfg.global
}

function findAccount(id) {
  return cfg.accounts.find((a) => a.id === id) || null
}

function persist() {
  cfg = saveConfig(dataDir, cfg)
  return cfg
}

function getSession(account) {
  const existing = sessions.get(account.id)
  if (existing) return existing
  const s = new FtpSession({ account, globalConfig: cfg.global })
  sessions.set(account.id, s)
  return s
}

function destroySession(accountId) {
  const s = sessions.get(accountId)
  if (s) {
    s.destroy()
    sessions.delete(accountId)
  }
}

function resolveDownloadDir() {
  const d = cfg.global.downloadDir
  if (d && d !== 'desktop' && path.isAbsolute(d)) return d
  try { return app.getPath('desktop') } catch { return app.getPath('home') }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 1024,
    minHeight: 660,
    show: !isSmoke && !isHiddenStart,
    backgroundColor: '#f5f7fa',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(appRoot(), 'out/preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      spellcheck: false
    }
  })
  Menu.setApplicationMenu(null)
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) shell.openExternal(url)
    return { action: 'deny' }
  })
  mainWindow.on('closed', () => { mainWindow = null })

  if (!app.isPackaged && process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(path.join(appRoot(), 'out/renderer/index.html'))
  }
  return mainWindow
}

const singleLock = app.requestSingleInstanceLock()
if (!singleLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.show() // 自启隐藏模式下，第二次启动=把后台窗口调到前台（秒开）
      mainWindow.focus()
    }
  })

  app.whenReady().then(() => {
    cfg = loadConfig(dataDir)
    // 文案覆盖（data\文案覆盖.json）：不重新打包也能改提示文字，重启生效
    try {
      const overFile = path.join(dataDir, '文案覆盖.json')
      applyMainTextsOverride(JSON.parse(fs.readFileSync(overFile, 'utf8')))
    } catch { /* 没有覆盖文件或格式不对：用默认文案 */ }
    logger = new OperationLogger(dataDir)
    engine = new TransferEngine({
      getConfig: getGlobal,
      findAccount,
      logger
    })
    engine.on('updated', (tasks) => broadcast('transfers:updated', tasks))

    registerIpc({
      getCfg: () => cfg,
      persist,
      dataDir,
      logger,
      engine,
      sessions,
      getSession,
      destroySession,
      resolveDownloadDir,
      getWindow: () => mainWindow
    })

    createWindow()

    if (isSmoke) {
      mainWindow.webContents.once('did-finish-load', () => console.log('RENDERER_LOADED'))
      mainWindow.webContents.on('did-fail-load', (_e, code, desc) => {
        console.log('RENDERER_FAIL', code, desc)
        app.exit(1)
      })
      setTimeout(() => {
        console.log('SMOKE_OK dataDir=' + dataDir)
        app.exit(0)
      }, 2500)
    }

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })

  app.on('window-all-closed', () => {
    // 班级电脑单用户场景：关窗即退出，不驻留后台
    app.quit()
  })

  app.on('before-quit', () => {
    engine?.destroy()
    for (const s of sessions.values()) s.destroy()
    sessions.clear()
  })
}
