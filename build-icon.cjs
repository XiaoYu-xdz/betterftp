/**
 * 应用图标再生成脚本：
 *   1. 用 F:\XiaoLv\After Effects\上虞中学\betterftp2.png 生成 build/icon.ico（exe 图标）
 *   2. 同步 logo.png 到两版 src/renderer/src/assets/（程序内侧栏/关于页图标）
 * 换图标时：替换源 PNG → node build-icon.cjs → 重新打包两版
 */
const fs = require('fs')
const path = require('path')
const m = require('png-to-ico')
const pngToIco = m.default || m.imagesToIco

async function main() {
  const srcPng = path.join('F:', 'XiaoLv', 'After Effects', '上虞中学', 'betterftp2.png')
  const png = fs.readFileSync(srcPng)
  const ico = await pngToIco(png)

  fs.mkdirSync('build', { recursive: true })
  fs.writeFileSync('build/icon.ico', ico)
  fs.mkdirSync('BetterFTP-Win10/build', { recursive: true })
  fs.writeFileSync('BetterFTP-Win10/build/icon.ico', ico)

  fs.mkdirSync('src/renderer/src/assets', { recursive: true })
  fs.writeFileSync('src/renderer/src/assets/logo.png', png)
  fs.mkdirSync('BetterFTP-Win10/src/renderer/src/assets', { recursive: true })
  fs.writeFileSync('BetterFTP-Win10/src/renderer/src/assets/logo.png', png)

  console.log('icon.ico + logo.png 已更新（两版），请重新打包')
}

main().catch((e) => { console.error(e); process.exit(1) })
