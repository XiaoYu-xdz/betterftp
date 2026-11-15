/**
 * 今日人品：同一学生 + 同一天 → 结果完全一致（重启、换人查看都不会穿帮），跨天自动变化。
 * 算法：FNV-1a 32 位哈希 `${姓名}|${YYYY-MM-DD}`，取模 101 得到 0~100。
 */

export function dayKey(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function hashString(str) {
  let h = 0x811c9dc5
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h >>> 0
}

/** 返回 { name, score: 0..100, tier } */
export function fortuneOf(name, date = new Date()) {
  const score = hashString(`${name}|${dayKey(date)}`) % 101
  const tier = score >= 90 ? 'great' : score >= 70 ? 'good' : score >= 40 ? 'normal' : score >= 15 ? 'low' : 'bad'
  return { name, score, tier, day: dayKey(date) }
}
