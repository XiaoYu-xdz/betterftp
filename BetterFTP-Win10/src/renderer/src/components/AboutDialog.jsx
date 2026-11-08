import React from 'react'
import { T } from '../texts.js'
import logoUrl from '../assets/logo.png'

/**
 * 「关于」页（主界面内嵌页，非弹窗）。
 * 全部文案来自 texts.js 的 about 段；school/contact 留空则不显示。
 */
export function AboutPage({ version, onBack }) {
  const A = T.about
  return (
    <div className="about-page">
      <div className="settings-header">
        <button className="btn" onClick={onBack}>← {T.settings.back.replace('← ', '')}</button>
        <h2>{A.title}</h2>
      </div>

      <div className="card">
        <div className="about-head">
          <div className="about-logo"><img className="logo-img" src={logoUrl} alt="" draggable={false} /></div>
          <div>
            <div className="about-name">{T.side.title}</div>
            <div className="about-ver">{A.version(version)}</div>
          {A.github && <a className="about-link" href={A.github} target="_blank" rel="noreferrer">{A.github.replace('https://', '')}</a>}
          </div>
        </div>
        <h3 style={{ marginTop: 14 }}>{A.introTitle}</h3>
        {A.intro.map((p, i) => (
          <p key={i} className="about-p">{p}</p>
        ))}
      </div>

      <div className="card">
        <h3>{A.featuresTitle}</h3>
        <div className="about-features">
          {A.features.map((f, i) => typeof f === 'string'
            ? <div key={i} className="about-feature-str">{f}</div>
            : (
              <div key={i} className="about-feature">
                <div className="t">✦ {f.t}</div>
                <div className="d">{f.d}</div>
              </div>
            ))}
        </div>
      </div>

      <div className="card">
        <h3>{A.licenseTitle}</h3>
        {A.license.map((p, i) => (
          <p key={i} className="about-p">{p}</p>
        ))}
      </div>

      {(A.school || A.contact) && (
        <div className="card">
          <h3>{A.adminTitle || '管理员信息'}</h3>
          {A.school && <div className="about-line">🏫 {A.schoolLabel}：{A.school}</div>}
          {A.contact && <div className="about-line">📮 {A.contactLabel}：{A.contact}</div>}
        </div>
      )}

      <div className="about-copyright">{A.copyright}</div>
    </div>
  )
}
