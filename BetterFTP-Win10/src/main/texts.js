/**
 * ════════════════════════════════════════════════════════════════
 *  BetterFTP 错误与提示文案（主进程）
 *  ────────────────────────────────────────────────────────────────
 *  连接/传输失败时给老师的"原因 + 建议"都在这里，改完重新打包生效。
 *  界面按钮/提示等文案在 src/renderer/src/texts.js。
 * ════════════════════════════════════════════════════════════════
 */

export const OP_NAMES = {
  stor: '上传文件',
  retr: '下载文件',
  mkd: '新建文件夹',
  rmd: '删除文件夹',
  dele: '删除文件',
  rnfr: '重命名',
  list: '读取文件夹',
  cwd: '进入文件夹',
  connect: '连接',
  size: '读取文件信息',
}

export const ERR_TEXTS = {
  auth: {
    title: '账号或密码错误，登录被服务器拒绝（530）',
    hint: '请到「设置 → 账号管理」核对该账号的 FTP 用户名和密码；密码区分大小写。',
  },
  toomany: {
    title: '服务器连接数已达上限（421）',
    hint: '可能同账号在别处（如办公室电脑）还开着连接。稍等 1 分钟再试；或在「设置 → 全局」把并发传输数降为 1。',
  },
  permList: {
    title: (op) => `没有权限${op}，或该路径不存在（550）`,
    hint: '该文件夹可能是只读/受限目录；如果路径里有中文乱码，请到「设置 → 账号」尝试切换编码（GBK/UTF-8）。',
  },
  permOp: {
    title: (op) => `没有权限执行「${op}」（550）`,
    hint: '服务器拒绝了本次修改。若该文件夹为只读（界面上方有「只读」标记），上传/新建/重命名/删除都不可用。',
  },
  passiveBlocked: {
    title: (passive) => passive
      ? '被动模式的数据通道被防火墙/安全软件拦截'
      : '主动模式的数据通道被防火墙/安全软件拦截',
    hintPassive: '文件列表/传输需要额外端口，被拦截了。请到「设置 → 全局」把「被动模式」关掉改用主动模式再试；若仍失败请联系网管放行 FTP 被动端口范围。',
    hintActive: '请到「设置 → 全局」重新勾选「被动模式」再试；仍失败请联系网管检查防火墙策略。',
  },
  refused: {
    title: '连接被拒绝：服务器端口不通',
    hint: 'FTP 服务器可能没开机，或地址/端口填错。请确认电脑已连入校园网，并到「设置 → 全局」核对服务器地址和端口（默认 21）。',
  },
  timeout: {
    title: '连接超时，无法到达 FTP 服务器',
    hint: '请检查：① 网线/无线是否连上校园网；② 服务器是否开机。也可到「设置 → 全局」把超时时间调大（如 60 秒）再试。',
  },
  notfound: {
    title: '无法解析服务器地址',
    hint: '服务器地址填写有误。地址填 IP ，不要带 ftp:// 前缀、不要带端口（端口填在旁边的「端口」框）。请到「设置 → 全局」核对。',
  },
  resetData: {
    title: '传输过程中连接被中断',
    hint: '网络不稳定或服务器主动断开。可在传输队列里点「重试」；若反复出现，请检查网线/无线信号。',
  },
  resetCtrl: {
    title: '连接被服务器中断',
    hint: '网络不稳定或服务器主动断开。可在传输队列里点「重试」；若反复出现，请检查网线/无线信号。',
  },
  unknown: {
    title: (op, msg) => `${op}失败：${msg}`,
    hint: '请重试一次；若持续失败，记下上方提示并联系管理员。',
  },

  // 传输引擎专用
  engine: {
    noAccount: { title: '账号不存在或已被删除', hint: '请到「设置 → 账号管理」检查后重新上传。', action: 'openSettings' },
    localWrite: {
      title: '本地文件读写失败',
      hint: (code) => `无法读取/写入本地文件（${code}）。检查文件是否被占用、所在盘是否可写（注意：班级电脑 C 盘重启会还原，建议存 D 盘）。`,
    },
  },

  // IPC / 业务提示
  ipc: {
    accountDeleted: '账号不存在，可能已被删除',
    notValidJson: '备份文件不是有效的 JSON，无法导入',
    invalidImport: (why) => why,
    openFileFailed: (err) => `无法打开文件：${err}`,
    unknownError: '请重试一次；若持续失败，请截图本提示联系管理员。',
    probeNoAccount: '账号不存在，请先保存账号',
  },
}

/** 深度合并（文案覆盖.json 用） */
export function deepMergeTexts(base, over) {
  if (!over || typeof over !== 'object') return base
  const out = Array.isArray(base) ? [...base] : { ...base }
  for (const k of Object.keys(over)) {
    const v = over[k]
    if (v && typeof v === 'object' && !Array.isArray(v) &&
        base?.[k] && typeof base[k] === 'object' && !Array.isArray(base[k])) {
      out[k] = deepMergeTexts(base[k], v)
    } else {
      out[k] = v
    }
  }
  return out
}

/** 应用主进程文案覆盖（index.js 启动时调用，原地替换保持引用稳定） */
export function applyMainTextsOverride(over) {
  const merged = deepMergeTexts(ERR_TEXTS, over)
  for (const k of Object.keys(ERR_TEXTS)) delete ERR_TEXTS[k]
  Object.assign(ERR_TEXTS, merged)
  return ERR_TEXTS
}
