import React from 'react'

/**
 * 全局错误边界：渲染层任何未捕获异常显示错误信息，而不是整屏空白。
 * （设置页白屏事故的防复发措施）
 */
export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('渲染层异常:', error, info?.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{
          height: '100vh', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 12,
          fontFamily: '"Microsoft YaHei UI", sans-serif', padding: 24, textAlign: 'center'
        }}>
          <div style={{ fontSize: 40 }}>⚠️</div>
          <div style={{ fontSize: 17, fontWeight: 700 }}>界面出现异常</div>
          <div style={{ color: '#5b6474', fontSize: 14, maxWidth: 560, lineHeight: 1.7 }}>
            请重启程序再试。若反复出现，请把下方技术详情截图给管理员。
          </div>
          <pre style={{
            background: '#f6f7fa', border: '1px solid #e3e6ec', borderRadius: 8,
            padding: 12, fontSize: 12, maxWidth: 640, whiteSpace: 'pre-wrap',
            wordBreak: 'break-all', color: '#444'
          }}>{String(this.state.error?.stack || this.state.error)}</pre>
          <button
            onClick={() => location.reload()}
            style={{ padding: '8px 22px', cursor: 'pointer' }}
          >重新加载界面</button>
        </div>
      )
    }
    return this.props.children
  }
}
