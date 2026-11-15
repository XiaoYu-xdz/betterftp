/**
 * 底部四个按钮（宣传片/百宝箱/关于/设置）的自定义样式计算。
 * 支持「填充」与「外框」分别选择：单色 或 Rainbow（横向流动的渐变动画）。
 * Rainbow 使用 linear-gradient(90deg) + background-position 动画（见 styles.css）。
 * 饱和度（saturation，0~200，默认 100）作用于该按钮使用的所有颜色。
 */

function rainbowBg(colors) {
  const list = (colors && colors.length >= 2 ? colors : ['#0078d7', '#00b7c3', '#8764b8'])
  return `linear-gradient(90deg, ${list.join(', ')}, ${list[0]})`
}

function solidBg(color) {
  return `linear-gradient(${color}, ${color})`
}

// ---------- 颜色工具（hex ↔ HSL，用于饱和度调节） ----------

function clamp01(v) {
  return Math.min(1, Math.max(0, v))
}

export function hexToRgb(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || ''))
  if (!m) return { r: 255, g: 255, b: 255 }
  const n = parseInt(m[1], 16)
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
}

function rgbToHex(r, g, b) {
  const to = (v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')
  return `#${to(r)}${to(g)}${to(b)}`
}

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  if (max === min) return [0, 0, l]
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6
  else if (max === g) h = ((b - r) / d + 2) / 6
  else h = ((r - g) / d + 4) / 6
  return [h, s, l]
}

function hslToRgb(h, s, l) {
  if (s === 0) {
    const v = l * 255
    return { r: v, g: v, b: v }
  }
  const hue2rgb = (p, q, t) => {
    if (t < 0) t += 1
    if (t > 1) t -= 1
    if (t < 1 / 6) return p + (q - p) * 6 * t
    if (t < 1 / 2) return q
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
    return p
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q
  return {
    r: hue2rgb(p, q, h + 1 / 3) * 255,
    g: hue2rgb(p, q, h) * 255,
    b: hue2rgb(p, q, h - 1 / 3) * 255
  }
}

/** 按倍率调整颜色饱和度（factor=1 原样，0=灰度，2=更鲜艳） */
export function applySaturation(hex, factor) {
  const { r, g, b } = hexToRgb(hex)
  const [h, s, l] = rgbToHsl(r, g, b)
  const rgb = hslToRgb(h, clamp01(s * factor), l)
  return rgbToHex(rgb.r, rgb.g, rgb.b)
}

/**
 * @param {{saturation?:number, fill?:{mode?:string,color?:string,colors?:string[]}, border?:{mode?:string,color?:string,colors?:string[]}}} style
 * @returns {{className:string, style:object}}
 */
export function footerButtonStyle(style) {
  const fill = style?.fill || {}
  const border = style?.border || {}
  const fillRainbow = fill.mode === 'rainbow' && Array.isArray(fill.colors) && fill.colors.length >= 2
  const borderRainbow = border.mode === 'rainbow' && Array.isArray(border.colors) && border.colors.length >= 2
  const satRaw = Number.isFinite(style?.saturation) ? style.saturation : 100
  const sat = Math.max(0, Math.min(200, satRaw)) / 100
  const tint = (c) => applySaturation(c, sat)
  const fillColor = tint(fill.color || '#fdfdfd')
  const borderColor = tint(border.color || '#adadad')

  // 普通单色：直接给背景色与外框色
  if (!fillRainbow && !borderRainbow) {
    return {
      className: '',
      style: { backgroundColor: fillColor, borderColor: borderColor }
    }
  }

  // 渐变：padding-box / border-box 双背景，填充与外框各自独立；横向流动
  const layers = []
  layers.push(`${fillRainbow ? rainbowBg(fill.colors.map(tint)) : solidBg(fillColor)} padding-box`)
  layers.push(`${borderRainbow ? rainbowBg(border.colors.map(tint)) : solidBg(borderColor)} border-box`)
  return {
    className: 'bf-rainbow',
    style: {
      background: layers.join(', '),
      backgroundSize: '200% 100%',
      borderColor: 'transparent',
      // 填充是渐变时自动用白字，保证可读性
      ...(fillRainbow ? { color: '#fff' } : {})
    }
  }
}
