import { describe, it, expect } from 'vitest'
import { containerFolderName } from '../../src/renderer/src/utils.js'

describe('多选下载容器文件夹命名 containerFolderName', () => {
  it('账号名 + mm.dd（两位补零）', () => {
    expect(containerFolderName('张老师', new Date(2026, 10, 15))).toBe('张老师11.15')
    expect(containerFolderName('张老师', new Date(2026, 0, 5))).toBe('张老师01.05')
    expect(containerFolderName('李老师', new Date(2026, 11, 31))).toBe('李老师12.31')
  })

  it('去掉文件名非法字符与首尾空白', () => {
    expect(containerFolderName('张/老师: 1', new Date(2026, 10, 5))).toBe('张老师 111.05')
    expect(containerFolderName('  ', new Date(2026, 10, 5))).toBe('FTP11.05')
    expect(containerFolderName(null, new Date(2026, 10, 5))).toBe('FTP11.05')
  })
})
