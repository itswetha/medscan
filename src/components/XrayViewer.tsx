import { useRef, useState, type CSSProperties, type PointerEvent, type WheelEvent } from 'react'

type ImageView = 'original' | 'heatmap' | 'overlay'
type PanPosition = { x: number; y: number }
type DragState = { pointerId: number; startX: number; startY: number; panX: number; panY: number }

type XrayViewerProps = {
  originalUrl: string
  heatmapUrl: string
  originalAlt?: string
}

const viewLabels: Record<ImageView, string> = {
  original: 'Original',
  heatmap: 'Heatmap',
  overlay: 'Overlay',
}

export function XrayViewer({ originalUrl, heatmapUrl, originalAlt = 'Uploaded chest X-ray' }: XrayViewerProps) {
  const [activeView, setActiveView] = useState<ImageView>('original')
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState<PanPosition>({ x: 0, y: 0 })
  const [brightness, setBrightness] = useState(100)
  const [contrast, setContrast] = useState(100)
  const [heatmapOpacity, setHeatmapOpacity] = useState(70)
  const [isDragging, setIsDragging] = useState(false)
  const viewportRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<DragState | null>(null)
  const hasHeatmap = Boolean(heatmapUrl)

  function updateZoom(nextZoom: number) {
    const boundedZoom = Math.max(1, Math.min(4, Number(nextZoom.toFixed(2))))
    setZoom(boundedZoom)
    if (boundedZoom === 1) {
      setPan({ x: 0, y: 0 })
      dragRef.current = null
      setIsDragging(false)
    }
  }

  function selectView(nextView: ImageView) {
    if ((nextView === 'heatmap' || nextView === 'overlay') && !hasHeatmap) return
    setActiveView(nextView)
    setPan({ x: 0, y: 0 })
    dragRef.current = null
    setIsDragging(false)
  }

  function handleWheel(event: WheelEvent<HTMLDivElement>) {
    event.preventDefault()
    updateZoom(zoom + (event.deltaY < 0 ? 0.1 : -0.1))
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    if (zoom <= 1 || event.button !== 0) return
    dragRef.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, panX: pan.x, panY: pan.y }
    event.currentTarget.setPointerCapture(event.pointerId)
    setIsDragging(true)
    event.preventDefault()
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current
    const viewport = viewportRef.current
    if (!drag || drag.pointerId !== event.pointerId || !viewport) return

    const bounds = viewport.getBoundingClientRect()
    const maxPanX = bounds.width * (zoom - 1) / 2
    const maxPanY = bounds.height * (zoom - 1) / 2
    setPan({
      x: Math.max(-maxPanX, Math.min(maxPanX, drag.panX + event.clientX - drag.startX)),
      y: Math.max(-maxPanY, Math.min(maxPanY, drag.panY + event.clientY - drag.startY)),
    })
  }

  function endPan(event: PointerEvent<HTMLDivElement>) {
    if (dragRef.current?.pointerId !== event.pointerId) return
    dragRef.current = null
    setIsDragging(false)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
  }

  function resetView() {
    setZoom(1)
    setPan({ x: 0, y: 0 })
    setBrightness(100)
    setContrast(100)
    setHeatmapOpacity(70)
    dragRef.current = null
    setIsDragging(false)
  }

  const imageLayerStyle: CSSProperties = {
    transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom})`,
    filter: `brightness(${brightness / 100}) contrast(${contrast / 100})`,
  }

  return (
    <div className="xray-viewer">
      <div className="xray-view-tabs" role="group" aria-label="X-ray image view">
        {(Object.keys(viewLabels) as ImageView[]).map((view) => (
          <button
            className={`xray-view-tab ${activeView === view ? 'selected' : ''}`}
            type="button"
            key={view}
            aria-pressed={activeView === view}
            disabled={(view === 'heatmap' || view === 'overlay') && !hasHeatmap}
            onClick={() => selectView(view)}
          >
            {viewLabels[view]}
          </button>
        ))}
      </div>

      <div className="xray-viewer-toolbar" aria-label="Zoom controls">
        <div className="xray-zoom-buttons">
          <button className="xray-icon-button" type="button" aria-label="Zoom out" title="Zoom out" disabled={zoom <= 1} onClick={() => updateZoom(zoom - 0.25)}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14" /></svg>
          </button>
          <button className="xray-icon-button" type="button" aria-label="Zoom in" title="Zoom in" disabled={zoom >= 4} onClick={() => updateZoom(zoom + 0.25)}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14m-7-7h14" /></svg>
          </button>
          <output className="xray-zoom-level" aria-live="polite">{Math.round(zoom * 100)}%</output>
        </div>
        <button className="xray-reset-button" type="button" onClick={resetView}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12a9 9 0 1 0 2.64-6.36L3 8m0-5v5h5" /></svg>
          Reset view
        </button>
      </div>

      <div
        className={`xray-viewer-stage ${zoom > 1 ? 'is-zoomed' : ''} ${isDragging ? 'is-dragging' : ''}`}
        ref={viewportRef}
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endPan}
        onPointerCancel={endPan}
      >
        <div className="xray-viewer-image-layer" style={imageLayerStyle}>
          {activeView === 'original' ? <img src={originalUrl} alt={originalAlt} draggable="false" /> : null}
          {activeView === 'heatmap' ? <img src={heatmapUrl} alt="Grad-CAM heatmap highlighting image regions" draggable="false" /> : null}
          {activeView === 'overlay' ? <>
            <img src={originalUrl} alt={originalAlt} draggable="false" />
            <img className="xray-heatmap-layer" src={heatmapUrl} alt="Grad-CAM heatmap overlay" style={{ opacity: heatmapOpacity / 100 }} draggable="false" />
          </> : null}
        </div>
      </div>

      {activeView === 'overlay' ? (
        <label className="xray-slider-control">
          <span>Heatmap intensity</span>
          <input type="range" min="0" max="100" value={heatmapOpacity} onChange={(event) => setHeatmapOpacity(Number(event.target.value))} />
          <output>{heatmapOpacity}%</output>
        </label>
      ) : null}
      <label className="xray-slider-control">
        <span>Brightness</span>
        <input type="range" min="50" max="150" value={brightness} onChange={(event) => setBrightness(Number(event.target.value))} />
        <output>{brightness}%</output>
      </label>
      <label className="xray-slider-control">
        <span>Contrast</span>
        <input type="range" min="50" max="150" value={contrast} onChange={(event) => setContrast(Number(event.target.value))} />
        <output>{contrast}%</output>
      </label>
    </div>
  )
}