/**
 * 窗口尺寸计算（纯函数，便于测试）
 *
 * 背景：教室希沃大屏常见 1366×768 或 1080p@125%/150% 缩放，
 * 固定 1280×820 的窗口会超出屏幕底部。这里按"屏幕可用区域"（DIP，已含缩放换算）
 * 夹取尺寸，并在小屏首次启动时自动最大化。
 */

export const DEFAULT_WINDOW = { width: 1280, height: 820 }
export const MIN_WINDOW = { width: 960, height: 600 }

function normalizeSize(n) {
  return typeof n === 'number' && Number.isFinite(n) && n > 0 ? Math.round(n) : null
}

function clamp(v, min, max) {
  return Math.min(Math.max(v, min), max)
}

/**
 * @param {{width?:number|null, height?:number|null, maximized?:boolean}|null|undefined} saved 上次保存的窗口状态
 * @param {{width:number, height:number}} workArea 屏幕可用区域（DIP）
 * @returns {{width:number, height:number, maximize:boolean}}
 */
export function resolveWindowSize(saved, workArea) {
  const waW = Math.max(MIN_WINDOW.width, Math.round(workArea?.width || DEFAULT_WINDOW.width))
  const waH = Math.max(MIN_WINDOW.height, Math.round(workArea?.height || DEFAULT_WINDOW.height))

  const savedW = normalizeSize(saved?.width)
  const savedH = normalizeSize(saved?.height)
  const hasSavedSize = savedW !== null && savedH !== null

  const width = clamp(savedW ?? DEFAULT_WINDOW.width, MIN_WINDOW.width, waW)
  const height = clamp(savedH ?? DEFAULT_WINDOW.height, MIN_WINDOW.height, waH)

  // 小屏且用户从未设置过尺寸（首次启动）→ 直接最大化；用户手动设过的尺寸要尊重
  const smallScreen = waW < 1400 || waH < 860
  const maximize = saved?.maximized === true || (!hasSavedSize && smallScreen)

  return { width, height, maximize }
}

/** 设置页滑块应用时：把用户给定尺寸夹取到合法范围 */
export function clampWindowSize({ width, height }, workArea) {
  const waW = Math.max(MIN_WINDOW.width, Math.round(workArea?.width || DEFAULT_WINDOW.width))
  const waH = Math.max(MIN_WINDOW.height, Math.round(workArea?.height || DEFAULT_WINDOW.height))
  return {
    width: clamp(Math.round(Number(width) || DEFAULT_WINDOW.width), MIN_WINDOW.width, waW),
    height: clamp(Math.round(Number(height) || DEFAULT_WINDOW.height), MIN_WINDOW.height, waH)
  }
}
