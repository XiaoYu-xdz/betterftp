const fs = require('fs')
const pngToIco = require('png-to-ico')

async function main() {
  const png = fs.readFileSync('F:/XiaoLv/After Effects/上虞中学/betterftp2.png')
  // 256x256 PNG 直接封装为 ICO（Windows 会自动缩放各尺寸）
  const ico = await pngToIco(png)
  fs.mkdirSync('build', { recursive: true })
  fs.writeFileSync('build/icon.ico', ico)
  // 同步到 Win10 版
  fs.mkdirSync('BetterFTP-Win10/build', { recursive: true })
  fs.writeFileSync('BetterFTP-Win10/build/icon.ico', ico)
  // 程序内 logo 资源（两版）
  fs.mkdirSync('src/renderer/src/assets', { recursive: true })
  fs.writeFileSync('src/renderer/src/assets/logo.png', png)
  fs.writeFileSync('BetterFTP-Win10/src/renderer/src/assets/logo.png', png)
  console.log('icon.ico + logo.png 生成完毕')
}

main().catch((e) => { console.error(e); process.exit(1) })
