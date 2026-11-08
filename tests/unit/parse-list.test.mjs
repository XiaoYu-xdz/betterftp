import { describe, it, expect } from 'vitest'
import { parseListBuffer } from '../../src/main/ftp/parse-list.js'
import iconv from 'iconv-lite'

describe('LIST 解析 parseListBuffer', () => {
  it('解析 Unix 风格（文件名含空格和中文）', () => {
    const raw = Buffer.from(
      'drwxr-xr-x 1 ftp ftp 4096 Nov  1 09:30 01 课件\r\n' +
      '-rw-r--r-- 1 ftp ftp 1234567 Nov  5 14:20 我的 课件.pptx\r\n' +
      'total 3\r\n', 'utf8')
    const items = parseListBuffer(raw, 'utf-8')
    expect(items).toHaveLength(2)
    expect(items[0].isDir).toBe(true)
    expect(items[0].name).toBe('01 课件')
    expect(items[1].isDir).toBe(false)
    expect(items[1].name).toBe('我的 课件.pptx')
    expect(items[1].size).toBe(1234567)
    expect(items[1].rights).toBe('rw-r--r--')
  })

  it('解析 Windows DOS 风格（<DIR> 与大小）', () => {
    const raw = Buffer.from(
      '11-05-26  02:20PM       <DIR>          第一章\r\n' +
      '11/05/2026  02:20PM       1234567 课件.pptx\r\n', 'utf8')
    const items = parseListBuffer(raw, 'utf-8')
    expect(items).toHaveLength(2)
    expect(items[0].isDir).toBe(true)
    expect(items[0].name).toBe('第一章')
    expect(items[1].isDir).toBe(false)
    expect(items[1].size).toBe(1234567)
  })

  it('GBK 字节按 utf-8 解码出现替换符，按 gbk 解码恢复', () => {
    const line = '-rw-r--r-- 1 ftp ftp 123 Nov  5 14:20 数学课件.pptx\r\n'
    const gbkBytes = iconv.encode(line, 'gbk')
    const asUtf8 = parseListBuffer(gbkBytes, 'utf-8')
    expect(asUtf8[0].name).toContain('\uFFFD')
    const asGbk = parseListBuffer(gbkBytes, 'gbk')
    expect(asGbk[0].name).toBe('数学课件.pptx')
  })

  it('跳过空行与 total 行', () => {
    const raw = Buffer.from('\r\ntotal 0\r\n', 'utf8')
    expect(parseListBuffer(raw, 'utf-8')).toHaveLength(0)
  })

  it('Unix 无年份时间（近日期）与带年份时间', () => {
    const raw = Buffer.from(
      '-rw-r--r-- 1 ftp ftp 1 Nov  5 2024 old.txt\r\n' +
      '-rw-r--r-- 1 ftp ftp 2 Nov  5 14:20 recent.txt\r\n', 'utf8')
    const items = parseListBuffer(raw, 'utf-8')
    expect(items[0].modifiedAt.getFullYear()).toBe(2024)
    expect(items[1].modifiedAt.getFullYear()).toBeGreaterThanOrEqual(2025)
  })

  it('符号链接行取目标前的名称', () => {
    const raw = Buffer.from('lrwxrwxrwx 1 ftp ftp 7 Nov  5 14:20 link -> realdir\r\n', 'utf8')
    const items = parseListBuffer(raw, 'utf-8')
    expect(items[0].name).toBe('link')
  })
})
