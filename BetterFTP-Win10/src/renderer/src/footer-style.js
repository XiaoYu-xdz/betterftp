/**
 * 底部四个按钮（宣传片/百宝箱/关于/设置）的自定义样式计算。
 * 支持「填充」与「外框」分别选择：单色 或 Rainbow（动态渐变）。
 * Rainbow 通过 CSS 自定义属性 --bf-angle + conic-gradient 实现旋转动画（见 styles.css）。
 */

function rainbowBg(colors) {
  const list = (colors && colors.length >= 2 ? colors : ['#0078d7', '#00b7c3', '#8764b8'])
  return `conic-gradient(from var(--bf-angle), ${list.join(', ')}, ${list[0]})`
}

function solidBg(color) {
  return `linear-gradient(${color}, ${color})`
}

/**
 * @param {{fill?:{mode?:string,color?:string,colors?:string[]}, border?:{mode?:string,color?:string,colors?:string[]}}} style
 * @returns {{className:string, style:object}}
 */
export function footerButtonStyle(style) {
  const fill = style?.fill || {}
  const border = style?.border || {}
  const fillRainbow = fill.mode === 'rainbow' && Array.isArray(fill.colors) && fill.colors.length >= 2
  const borderRainbow = border.mode === 'rainbow' && Array.isArray(border.colors) && border.colors.length >= 2
  const fillColor = fill.color || '#fdfdfd'
  const borderColor = border.color || '#adadad'

  // 普通单色：直接给背景色与外框色（保持原有按钮观感）
  if (!fillRainbow && !borderRainbow) {
    return {
      className: '',
      style: { backgroundColor: fillColor, borderColor: borderColor }
    }
  }

  // 渐变：用 padding-box / border-box 双背景实现「填充」与「外框」各自独立
  const layers = []
  layers.push(`${fillRainbow ? rainbowBg(fill.colors) : solidBg(fillColor)} padding-box`)
  layers.push(`${borderRainbow ? rainbowBg(border.colors) : solidBg(borderColor)} border-box`)
  return {
    className: 'bf-rainbow',
    style: {
      background: layers.join(', '),
      borderColor: 'transparent',
      // 填充是彩虹渐变时自动用白字，保证可读性
      ...(fillRainbow ? { color: '#fff' } : {})
    }
  }
}
