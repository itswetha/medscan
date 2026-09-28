import { useState, type ChangeEvent } from 'react'
import { isAxiosError } from 'axios'
import { useNavigate } from 'react-router-dom'
import { analyzeScan, continueWithPoorQuality, uploadScan, type ScanQualityResult } from '../../api/scans'
import { AppShell } from '../../components/layout/AppShell'

export default function Upload() {
  const [file, setFile] = useState<File | null>(null)
  const [result, setResult] = useState<ScanQualityResult | null>(null)
  const [progress, setProgress] = useState(0)
  const [uploading, setUploading] = useState(false)
  const [continuing, setContinuing] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const navigate = useNavigate()
  const [error, setError] = useState('')

  function selectFile(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0] ?? null
    setFile(selected)
    setResult(null)
    setError('')
  }

  async function submitUpload() {
    if (!file) return
    setUploading(true)
    setError('')
    setProgress(0)
    try {
      setResult(await uploadScan(file, setProgress))
    } catch (cause) {
      setError(isAxiosError(cause) ? (cause.response?.data?.detail ?? 'Upload failed. Please try again.') : 'Upload failed. Please try again.')
    } finally {
      setUploading(false)
    }
  }

  function resetUpload() {
    setFile(null)
    setResult(null)
    setProgress(0)
    setError('')
  }

  async function proceed() {
    if (!result) return
    setContinuing(true)
    setAnalyzing(true)
    setError('')
    try {
      if (result.quality_status === 'poor') await continueWithPoorQuality(result.scan_id)
      await analyzeScan(result.scan_id)
      navigate(`/patient/scans/${result.scan_id}/result`)
    } catch (cause) {
      setError(isAxiosError(cause) ? (cause.response?.data?.detail ?? 'Could not continue with this scan.') : 'Could not continue with this scan.')
    } finally {
      setContinuing(false)
      setAnalyzing(false)
    }
  }

  return (
    <AppShell>
      <section className="page-heading">
        <span className="eyebrow">PATIENT WORKSPACE</span>
        <h1>Upload X-ray</h1>
        <p>Upload a chest X-ray image for an image quality check.</p>
      </section>

      {!result && (
        <section className="placeholder-card upload-card">
          <h2>Select an image</h2>
          <p>JPEG or PNG, under 10 MB.</p>
          <label className="file-picker">
            <span>{file ? file.name : 'Choose JPEG or PNG image'}</span>
            <input type="file" accept="image/jpeg,image/png,.jpg,.jpeg,.png" onChange={selectFile} disabled={uploading} />
          </label>
          {uploading && (
            <div className="upload-progress" role="status" aria-live="polite">
              <div className="progress-track"><div className="progress-fill" style={{ width: `${Math.max(progress, 4)}%` }} /></div>
              <span>{progress >= 100 ? 'Checking image quality…' : `Uploading… ${progress}%`}</span>
            </div>
          )}
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="button button-primary upload-action" onClick={submitUpload} disabled={!file || uploading}>
            {uploading ? 'Processing image…' : 'Upload image'}
          </button>
        </section>
      )}

      {result && (
        <section className={`quality-card ${result.quality_status}`}>
          <div className="quality-heading">
            <span className={`quality-symbol ${result.quality_status}`} aria-hidden="true">{result.quality_status === 'good' ? '✓' : '!'}</span>
            <div>
              <h2>{result.quality_status === 'good' ? 'Good image quality' : 'Image quality needs attention'}</h2>
              <p>{result.quality_status === 'good' ? 'The image passed the quality check and is ready to continue.' : 'Some issues may affect the next step. You can re-upload or continue.'}</p>
            </div>
          </div>
          <div className="score-row"><span>Quality score</span><strong>{result.quality_score}/100</strong></div>
          <div className="progress-track score-track" role="progressbar" aria-label="Image quality score" aria-valuemin={0} aria-valuemax={100} aria-valuenow={result.quality_score}>
            <div className={`progress-fill ${result.quality_status}`} style={{ width: `${result.quality_score}%` }} />
          </div>
          {result.quality_issues.length > 0 && (
            <div className="issues-box">
              <h3>Issues found</h3>
              <ul>{result.quality_issues.map((issue) => <li key={issue}>{issue}</li>)}</ul>
            </div>
          )}
          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="quality-actions">
            {result.quality_status === 'poor' && <button className="button button-quiet" onClick={resetUpload}>Re-upload Image</button>}
            <button className="button button-primary" onClick={proceed} disabled={continuing}>
              {analyzing ? 'Running AI analysis…' : continuing ? 'Continuing…' : result.quality_status === 'good' ? 'Continue to Analysis' : 'Continue Anyway'}
            </button>
          </div>
        </section>
      )}


      <p className="clinical-notice">The image quality check is not a medical diagnosis. Any AI screening result is preliminary and must be reviewed by a licensed doctor.</p>
    </AppShell>
  )
}
