/**
 * ════════════════════════════════════════════════════════════════
 *  BetterFTP 界面文案中心
 *  ────────────────────────────────────────────────────────────────
 *  想改界面上的任何文字，只改这个文件即可。
 *  改完：开发模式重启 npm run dev；正式 exe 需要 npm run build:portable 重新打包。
 *
 *  免打包微调：在程序旁边的 data 文件夹里放一个 文案覆盖.json（结构与本文件
 *  相同，只写要改的那几条），重启程序即生效。例如：
 *    { "actions": { "upload": "传课件" } }
 *
 *  连接/传输失败的"错误提示"文案在另一个文件：src/main/texts.js
 * ════════════════════════════════════════════════════════════════
 */

export const T = {
  // ── 侧栏 ──────────────────────────────────────────────
  side: {
    title: 'BetterFTP',
    subtitle: '', // 品牌副标题；想显示可填回 '课件传输'
    add: '＋ 添加账号',
    noAccountsHint: '还没有老师账号。点下方「添加账号」创建第一个。',
    about: 'ⓘ 关于',
    settings: '⚙ 设置',
  },

  // ── 顶栏 ──────────────────────────────────────────────
  top: {
    unselected: '未选择账号',
    hintPickAccount: '点击左侧账号开始',
    connecting: '连接中…',
    connected: '已连接',
    connectFailed: '连接失败',
    parent: '上级',
    parentTitle: '返回上一级',
    refresh: '刷新',
    refreshTitle: '刷新当前文件夹',
    searchPlaceholder: '在当前文件夹搜索…',
    rootCrumb: '根目录',
    gbkBadge: 'GBK 编码',
  },

  // ── 权限徽章（cls: ok/warn/bad/muted 决定颜色） ────────
  perms: {
    rw: { text: '读写', cls: 'ok', tip: '此文件夹可以上传、修改和删除' },
    ro: { text: '只读', cls: 'warn', tip: '此文件夹只能查看和下载，不能上传/修改' },
    w: { text: '只写', cls: 'warn', tip: '此文件夹只能上传，不能查看内容' },
    none: { text: '受限', cls: 'bad', tip: '此文件夹无法读取也无法写入' },
    unknown: { text: '未检测', cls: 'muted', tip: '暂未能确定权限，操作失败时会给出具体提示' },
  },

  // ── 文件列表 ──────────────────────────────────────────
  table: {
    name: '名称',
    size: '大小',
    time: '修改时间',
    actions: '操作',
    dirType: '文件夹',
    open: '打开',
    download: '下载',
    rename: '重命名',
    delete: '删除',
    dirNoDownload: '文件夹请进入后下载其中的文件',
    noPerm: '当前文件夹权限不足',
    rowTipDir: '单击选择，双击进入',
    rowTipFile: '单击选择，双击打开（先下载到桌面）',
  },

  // ── 操作按钮行 ────────────────────────────────────────
  actions: {
    upload: '上传文件',
    download: '下载',
    mkdir: '新建文件夹',
    selected: (n) => `已选 ${n} 项`,
    hint: '单击选择，双击打开/进入；操作按钮在文件行右侧',
  },

  // ── 空状态 ────────────────────────────────────────────
  empty: {
    welcome: '欢迎使用 BetterFTP',
    welcomeHint: '先在设置里添加你的 FTP 账号',
    addAccount: '添加账号',
    pickAccount: '点击左侧的账号开始使用',
    pickAccountHint: '连接后自动进入你的课件文件夹',
    pickAccountBtn: '点击左侧账号',
    connecting: '正在连接…',
    connErrorTitle: '连接出现问题',
    retry: '重试连接',
    goSettings: '去设置检查',
    dropboxTitle: '只写目录（投递箱）',
    dropboxHint: '这个文件夹只允许上传，内容不可查看。点下方「上传文件」即可投递课件。',
    dirEmpty: '此文件夹是空的',
    dirEmptyHint: '点下方「上传文件」把课件传上来',
    noSearchMatch: (kw) => `没有匹配「${kw}」的文件`,
    noSearchMatchHint: '换个关键词试试',
  },

  // ── 传输队列 ──────────────────────────────────────────
  dock: {
    title: (n) => `传输队列（${n}）`,
    running: (n) => `传输中 ${n}`,
    pending: (n) => `等待 ${n}`,
    failed: (n) => `失败 ${n}`,
    none: '暂无进行中的任务',
    emptyHint: '没有传输任务。上传或下载的文件会显示在这里，切换页面不会中断。',
    queued: '排队等待中…',
    cancel: '取消',
    cancelTitle: '取消传输',
    retry: '重试',
    retryTitle: '重新传输（下载自动断点续传）',
    remove: '✕',
    removeTitle: '从列表移除',
    reveal: '打开所在位置',
    errExpandHint: '点击查看处理建议',
  },

  // ── 传输状态文字（cls 决定颜色） ──────────────────────
  taskStatus: {
    pending: { text: '等待中', cls: 'muted' },
    running: { text: '传输中', cls: 'running' },
    done: { text: '已完成', cls: 'ok' },
    failed: { text: '失败', cls: 'bad' },
    cancelled: { text: '已取消', cls: 'muted' },
  },

  // ── 对话框 / 弹窗 ─────────────────────────────────────
  dialog: {
    confirm: '请确认',
    ok: '确定',
    cancel: '取消',
    conflictTitle: '文件已存在',
    conflictMultiTitle: (n) => `${n} 个文件与远程同名`,
    conflictAsk: (name) => `${name} 已存在，请选择处理方式：`,
    optOverwrite: '覆盖',
    optOverwriteDesc: (oldDesc) => `用新的文件替换已有的${oldDesc}`,
    optRename: '重命名保留两者',
    optRenameDesc: '自动加编号（如「课件 (1).pptx」），两个都保留',
    optSkip: '跳过',
    optSkipDesc: (oldDesc) => `保留${oldDesc}，不传输这一个`,
    errorTitle: '遇到问题',
    knowBtn: '知道了',
    techDetail: (raw) => `技术详情：${raw}`,
    promptEmpty: '名称不能为空',
    promptBadChars: '名称不能包含 \\ / : * ? " < > | 字符',
  },

  // ── 主界面操作提示 / 错误 ─────────────────────────────
  msgs: {
    fellBack: (p) => `配置的默认路径 ${p} 无法打开，进入根目录`,
    openSkippedExists: '桌面上已有该文件',
    openingAfterDownload: '正在下载到桌面，完成后自动打开…',
    openFailed: '文件下载完成，打开失败',
    openFailedTitle: '无法打开文件',
    uploadDeniedRo: '当前文件夹只读',
    uploadDeniedRoHint: '此文件夹不能上传文件，请进入有权限的文件夹',
    manageDeniedRo: '当前文件夹只读',
    manageDeniedRoHint: '此文件夹不能新建、重命名或删除。请进入有写权限的文件夹操作。',
    conflictRemoteDetail: (size, time) => `远程已有同名文件（${size}，${time}）`,
    conflictLocalDetail: (dest, size, same) => `保存到 ${dest}，已有同名文件（${size}）${same ? '，与远程大小相同' : ''}`,
    conflictMultiLocalTitle: (n) => `${n} 个文件在保存位置已存在`,
    oldRemote: '远程文件',
    oldLocal: '本地文件',
    queuedUploads: (n) => `已加入传输队列：${n} 个文件`,
    downloadingTo: (n, dest) => `开始下载 ${n} 个文件到「${dest}」`,
    selectFileFirst: '请先在列表中点选一个项目',
    selectDownloadFirst: '请先在列表中勾选要下载的文件（文件夹请进入后选择）',
    selectDeleteFirst: '请先在列表中勾选要删除的项目',
    needWritable: '此位置不允许该操作，请检查文件夹权限',
    mkdirCreated: (n) => `已创建「${n}」`,
    renamed: '已重命名',
    deleted: (n) => `已删除 ${n} 项`,
  },

  // ── 新建/重命名输入框 ─────────────────────────────────
  prompts: {
    mkdirTitle: '新建文件夹',
    mkdirPlaceholder: '输入文件夹名称',
    mkdirOk: '创建',
    mkdirDup: '已存在同名文件夹',
    renameTitle: (isDir) => `重命名${isDir ? '文件夹' : '文件'}`,
    renameDup: '已存在同名文件',
    renameSame: '新名称与原名相同',
  },

  // ── 确认对话框 ────────────────────────────────────────
  confirm: {
    deleteTitle: '确认删除',
    deleteOne: (name) => ({ __html: `确定要删除 <b>${name}</b> 吗？` }),
    deleteMany: (n, names) => ({ __html: `确定要删除选中的 <b>${n}</b> 项吗？（${names}）` }),
    deleteDirWarn: '文件夹将被整体删除（含内部全部内容），删除后无法恢复。',
    deleteWarn: '删除后无法恢复',
    deleteBtn: '删除',
    importTitle: '导入配置',
    importMsg: (cur) => ({ __html: `将用备份文件覆盖当前的全部设置和账号列表（共 ${cur} 个账号会被替换）。` }),
    importWarn: '导入后当前配置无法恢复；如有需要请先导出备份。',
    importBtn: '导入',
    clearLogsTitle: '清空操作日志',
    clearLogsMsg: '确定删除本机保存的全部操作日志吗？此操作无法恢复。',
    clearLogsBtn: '清空',
    deleteAccountTitle: '删除账号',
    deleteAccountMsg: (name, user) => ({ __html: `确定删除账号 <b>${name}</b>（${user}）吗？` }),
    deleteAccountWarn: '只删除本机保存的账号信息，不会影响 FTP 服务器上的文件。',
    deleteAccountBtn: '删除账号',
  },

  // ── 设置页 ────────────────────────────────────────────
  settings: {
    back: '← 返回',
    title: '设置',
    tabGlobal: '全局',
    tabAccounts: '账号管理',
    tabLogs: '操作日志',

    // 全局
    addrEmpty: '服务器地址不能为空',
    addrScheme: (p) => `地址里不能带 ${p} `,
    addrPath: '地址里不能带路径（/）',
    addrPort: (s) => `地址里不能带端口（ "${s}"）`,
    addrBad: '地址格式不对',
    serverSection: 'FTP 服务器',
    host: '服务器地址',
    hostPh: '只填 IP，如 10.180.168.3（不带 ftp:// 和端口）',
    port: '端口',
    encoding: '默认编码',
    encAuto: '自动检测（推荐）',
    encUtf8: 'UTF-8',
    encGbk: 'GBK（中文 Windows 服务器常用）',
    timeout: '超时时间（秒）',
    passive: '被动模式',
    passiveHint: '保持开启；若提示"数据通道被防火墙拦截"，可尝试关闭改为主动模式',
    concurrency: '同时传输数',
    concurrencyOpt: (n) => `最多同时 ${n} 个`,
    concurrencyHint: '服务器限制连接数时报「421」时，请把同时传输数调小。',
    downloadDir: '下载保存位置',
    downloadDirDesktop: '桌面（默认）',
    pick: '选择…',
    resetDesktop: '恢复桌面',
    autoStart: '开机自动启动',
    autoStartHint: '开机后应用在后台就绪，双击桌面图标立即打开（推荐教室电脑开启）。此开关仅对打包版有效。',
    save: '保存全局设置',
    savedToast: '全局设置已保存',
    backupSection: '配置备份',
    export: '📤 导出配置备份',
    import: '📥 导入配置备份',
    backupHint: '备份文件包含服务器地址和全部账号（含密码），请妥善保管，不要传到公共位置。',
    exportToast: (p) => `已导出到 ${p}`,
    dataSection: '数据存放位置（自动检测）',
    configFile: '配置文件',
    logsDirLabel: '日志目录',
    autoDetectPending: '程序首次运行后自动创建',
    dataHint: '💡 本程序把配置保存在自己旁边的 data 文件夹里（便携模式）。班级电脑若 C 盘有冰点还原/还原卡，请把整个程序文件夹放到 D 盘，这样重启后账号配置不会丢失。换电脑时用「导出/导入配置备份」迁移。',
    errHostEmpty: '服务器地址填写有误',
    errPort: '端口不正确',
    errPortHint: '端口应为 1–65535 的数字，FTP 默认 21。本机测试服务器用 2121。',
    errTimeout: '超时时间不正确',
    errTimeoutHint: '超时时间应为 3–300 秒之间的数字。',
    importFailed: '导入失败',
    importSuccess: '导入成功',

    // 账号管理
    accountsTitle: (n) => `老师账号（${n}）`,
    addAccount: '＋ 添加账号',
    noAccounts: '还没有账号。点右上角「添加账号」，填入 FTP 用户名和密码。',
    edit: '编辑',
    moveUp: '上移',
    moveDown: '下移',
    del: '删除',
    accountSavedToast: '账号已保存',
    accountDeletedToast: '已删除',
    editorNew: '添加账号',
    editorEdit: '编辑账号',
    displayName: '显示名称 *',
    displayNamePh: '如：张老师',
    username: 'FTP 用户名 *',
    usernamePh: '服务器分配的用户名',
    password: 'FTP 密码',
    passwordPh: '（可留空=匿名）',
    show: '显示',
    hide: '隐藏',
    remotePath: '默认打开路径',
    remotePathPh: '/teachers/zhang',
    browse: '浏览…',
    encodingFollow: (g) => `跟随全局（${g}）`,
    color: '标记颜色',
    note: '备注（可空）',
    notePh: '如：高一(3)班 数学',
    testConn: '🔌 测试连接',
    testing: '测试中…',
    testOk: (enc) => `连接成功（编码 ${enc}），根目录可访问`,
    needUsername: '请先填写 FTP 用户名',
    needDisplayName: { title: '显示名称不能为空', hint: '给这个账号起个名字，如「张老师」' },
    needUsernameSave: { title: 'FTP 用户名不能为空', hint: '填服务器分配给这位老师的用户名' },
    pathPickerTitle: '选择默认打开路径',
    backRoot: '回到根目录',
    pickThis: '选择此目录',
    pickerLoading: '正在连接并列出目录…',
    pickerNoSubdirs: '此目录下没有子文件夹',
    pickerEnter: '进入 ›',
    pickerHint: '老师点击该账号后会自动打开这里选择的目录。提示：也可以直接输入路径（根目录用 / 开头）。',
    noSubdirs: '此目录下没有子文件夹',

    // 日志
    logsTitle: '操作日志',
    loading: '（加载中…）',
    refreshLogs: '⟳ 刷新',
    exportCsv: '导出 CSV',
    clear: '清空',
    allAccounts: '全部账号',
    allActions: '全部操作',
    filterTransfer: '上传/下载',
    filterManage: '新建/重命名/删除',
    filterConnect: '连接',
    lastMonth: (n) => `最近 ${n} 个月`,
    searchPh: '按路径/账号搜索…',
    rows: (n) => `${n} 条`,
    colTime: '时间',
    colAccount: '账号',
    colAction: '操作',
    colPath: '文件路径',
    colResult: '结果',
    noLogs: '暂无日志',
    logsHint: '日志保存在本机，按月自动归档，超过 6 个月的自动清理。',
    exportCsvToast: (n) => `已导出 ${n} 条日志`,
    clearedToast: '已清空',
    system: '系统',
  },

  // ── 关于页（主界面内嵌页，texts 里可改全部文案） ──
  about: {
    title: '关于 BetterFTP',
    version: (v) => `版本 ${v || '1.0.0'}`,
    introTitle: '这是什么',
    intro: [
      'BetterFTP 是为老师设计的校园 FTP 课件传输工具：点一下自己的账号，程序自动完成连接、登录并进入对应的课件文件夹，上传下载像本地操作一样简单。',
      '程序为绿色便携版：不写注册表、不需要管理员权限，放在 D 盘等非还原盘即可在重启后保留配置。',
    ],
    featuresTitle: '亮点',
    features: [
      { t: '账号一键切换', d: '每位老师一张卡片，点击即连接，无需记忆地址与密码' },
      { t: '自研 FTP 协议层', d: '针对校园网定制：GBK/UTF-8 中文文件名自动识别、断点续传、防火墙拦截识别与切换建议' },
      { t: '人人能读懂的错误提示', d: '认证失败、端口不通、权限不足……每条提示都附带下一步怎么做的建议' },
      { t: '权限感知', d: '自动识别只读/读写/只写文件夹，不可用的操作自动置灰' },
      { t: '传输不中断', d: '切换页面、切换账号都不影响进行中的上传下载，失败可断点续传' },
    ],
    licenseTitle: '使用协议',
    license: [
      '本程序免费供本校教学使用，可自由复制到校内电脑。',
      '程序以"现状"提供，使用本程序产生的文件丢失、传输异常等后果由使用者自行承担；重要课件请自行留底。',
      '请勿将本程序或包含账号密码的配置备份外传。',
    ],
    copyright: '© 2026 BetterFTP · 校内教学工具',
    school: '',      // ← 填学校名，如 'XX中学'，填了才显示
    contact: '',     // ← 填维护人联系方式，如 '张老师 137xxxx'
    schoolLabel: '单位',
    contactLabel: '联系人',
  },


  // ── 操作类型中文名（日志页用） ────────────────────────
  logActions: {
    upload: '上传', download: '下载', connect: '连接',
    mkdir: '新建文件夹', rename: '重命名', delete: '删除文件', rmdir: '删除文件夹',
    'export-config': '导出配置', 'import-config': '导入配置', 'clear-logs': '清空日志',
  },
}

/** 深度合并覆盖文案（文案覆盖.json 用） */
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

/** 应用运行时覆盖（main.jsx 启动时调用；原地替换保持 T 引用稳定） */
export function applyTextsOverride(over) {
  const merged = deepMergeTexts(T, over)
  for (const k of Object.keys(T)) delete T[k]
  Object.assign(T, merged)
  return T
}

export default T
