import type { ReactNode } from 'react'
import { LungsIllustration } from './LungsIllustration'

function ShieldIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 5 6v5c0 4.5 3 8.3 7 10 4-1.7 7-5.5 7-10V6l-7-3Z" /><path d="m9 12 2 2 4-4" /></svg>
}
function ScanIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8V6a2 2 0 0 1 2-2h2m8 0h2a2 2 0 0 1 2 2v2m0 8v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2M4 12h16" /></svg>
}
function DoctorIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3v6a4 4 0 0 0 8 0V3M10 13v2a4 4 0 0 0 8 0v-1" /><circle cx="18" cy="12" r="2" /></svg>
}

export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="auth-page">
      <aside className="auth-visual" aria-label="About the platform">
        <a className="auth-brand" href="/" aria-label="Vital Scan AI home">
          <span className="brand-mark" aria-hidden="true">VS</span>
          <span>Vital Scan AI</span>
        </a>
        <div className="auth-visual-copy">
          <span className="eyebrow">AI-ASSISTED CHEST X-RAY SCREENING</span>
          <h2>Breathe easy.<br />Screen with confidence.</h2>
          <p>Upload a chest X-ray, see a clear explanation of the result, and have a licensed doctor review it.</p>
        </div>
        <div className="auth-hero">
          <span className="ring ring-1" aria-hidden="true" />
          <span className="ring ring-2" aria-hidden="true" />
          <span className="dot dot-1" aria-hidden="true" />
          <span className="dot dot-2" aria-hidden="true" />
          <span className="dot dot-3" aria-hidden="true" />
          <LungsIllustration className="auth-lungs" />
          <div className="float-card float-card-1"><span className="float-icon"><ScanIcon /></span><div><strong>Quality check</strong><small>Blur &amp; resolution</small></div></div>
          <div className="float-card float-card-2"><span className="float-icon"><ShieldIcon /></span><div><strong>Explainable AI</strong><small>Grad-CAM heatmaps</small></div></div>
          <div className="float-card float-card-3"><span className="float-icon"><DoctorIcon /></span><div><strong>Doctor review</strong><small>Licensed specialists</small></div></div>
        </div>
      </aside>
      <div className="auth-panel">{children}</div>
    </main>
  )
}
