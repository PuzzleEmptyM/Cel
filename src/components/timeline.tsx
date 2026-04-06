import { useRef, useCallback } from 'react'
import { useStore } from '../store/use-store'

const FRAME_WIDTH = 8   // px per frame
const LABEL_WIDTH = 120 // px for the sticky left column

export function Timeline() {
  const {
    project, activeSceneId, activeLayerId,
    currentFrame, setCurrentFrame, setIsPlaying,
    setActiveLayer, moveKeyframe,
  } = useStore()

  const scrollRef = useRef<HTMLDivElement>(null)
  const duration = project?.duration ?? 90
  const scene = project?.scenes.find((s) => s.id === activeSceneId)
  const layers = scene?.layers ?? []

  function frameFromClientX(clientX: number): number {
    if (!scrollRef.current) return 0
    const rect = scrollRef.current.getBoundingClientRect()
    const scrollLeft = scrollRef.current.scrollLeft
    const x = clientX - rect.left - LABEL_WIDTH + scrollLeft
    return Math.max(0, Math.min(duration - 1, Math.round(x / FRAME_WIDTH)))
  }

  function seekToEvent(e: React.MouseEvent) {
    setCurrentFrame(frameFromClientX(e.clientX))
    setIsPlaying(false)
  }

  const onPlayheadPointerDown = useCallback((e: React.PointerEvent) => {
    e.stopPropagation()
    setIsPlaying(false)
    const el = e.currentTarget as HTMLElement
    el.setPointerCapture(e.pointerId)
    function onMove(ev: PointerEvent) { setCurrentFrame(frameFromClientX(ev.clientX)) }
    function onUp() {
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerup', onUp)
    }
    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerup', onUp)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duration])

  function onKfPointerDown(e: React.PointerEvent, layerId: string, kfFrame: number) {
    e.stopPropagation()
    setIsPlaying(false)
    const el = e.currentTarget as HTMLElement
    el.setPointerCapture(e.pointerId)
    let lastFrame = kfFrame

    function onMove(ev: PointerEvent) {
      const f = frameFromClientX(ev.clientX)
      if (f !== lastFrame) {
        el.style.left = `${f * FRAME_WIDTH}px`
        lastFrame = f
      }
    }
    function onUp() {
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerup', onUp)
      el.style.left = ''
      if (lastFrame !== kfFrame) {
        moveKeyframe(layerId, kfFrame, lastFrame)
        setCurrentFrame(lastFrame)
      }
    }
    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerup', onUp)
  }

  const trackWidth = duration * FRAME_WIDTH

  return (
    <div className="flex flex-col h-full bg-gray-900 border-t border-gray-700 overflow-hidden">
      {/* Single scrollable container — label column is sticky inside it */}
      <div ref={scrollRef} className="flex-1 overflow-auto">
        <div style={{ width: LABEL_WIDTH + trackWidth, minWidth: '100%' }}>

          {/* ── Ruler row ── */}
          <div className="flex h-6 border-b border-gray-700 shrink-0 sticky top-0 z-20 bg-gray-900">
            {/* Sticky label header */}
            <div
              className="shrink-0 bg-gray-900 border-r border-gray-700 flex items-end pb-0.5 px-2"
              style={{ width: LABEL_WIDTH, position: 'sticky', left: 0, zIndex: 30 }}
            >
              <span className="text-[9px] text-gray-600 uppercase tracking-wider">Layers</span>
            </div>
            {/* Ruler track */}
            <div
              className="relative cursor-pointer select-none"
              style={{ width: trackWidth }}
              onMouseDown={seekToEvent}
            >
              {Array.from({ length: Math.ceil(duration / 5) }, (_, i) => i * 5).map((f) => (
                <div key={f} className="absolute top-0 h-full flex items-end pb-0.5" style={{ left: f * FRAME_WIDTH }}>
                  <div className="w-px h-2 bg-gray-600" />
                  {f % 10 === 0 && <span className="text-[9px] text-gray-600 ml-0.5 leading-none">{f}</span>}
                </div>
              ))}
              {/* Playhead */}
              <div
                className="absolute top-0 h-full w-px bg-indigo-400 z-10 pointer-events-none"
                style={{ left: currentFrame * FRAME_WIDTH }}
              >
                <div
                  className="w-4 h-4 bg-indigo-400 rounded-sm -translate-x-[7px] cursor-ew-resize pointer-events-auto hover:bg-indigo-300"
                  onPointerDown={onPlayheadPointerDown}
                />
              </div>
            </div>
          </div>

          {/* ── Layer rows ── */}
          {layers.map((layer) => (
            <div key={layer.id} className="flex h-8 border-b border-gray-800 shrink-0">
              {/* Sticky label */}
              <div
                className={`shrink-0 flex items-center gap-1.5 px-2 border-r border-gray-700 cursor-pointer select-none ${
                  layer.id === activeLayerId ? 'bg-indigo-900/40' : 'bg-gray-900 hover:bg-gray-800'
                }`}
                style={{ width: LABEL_WIDTH, position: 'sticky', left: 0, zIndex: 10 }}
                onClick={() => setActiveLayer(layer.id)}
              >
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: '#' + layer.color.toString(16).padStart(6, '0') }}
                />
                <span className="text-xs text-gray-300 truncate">{layer.name}</span>
              </div>

              {/* Keyframe track */}
              <div
                className="relative"
                style={{ width: trackWidth }}
                onMouseDown={seekToEvent}
              >
                {layer.id === activeLayerId && (
                  <div className="absolute inset-0 bg-indigo-900/20 pointer-events-none" />
                )}

                {/* Playhead line across track */}
                <div
                  className="absolute top-0 bottom-0 w-px bg-indigo-400/30 pointer-events-none z-0"
                  style={{ left: currentFrame * FRAME_WIDTH }}
                />

                {/* Connector lines between keyframes */}
                {layer.keyframes.length >= 2 &&
                  [...layer.keyframes].sort((a, b) => a.frame - b.frame).slice(0, -1).map((kf, i) => {
                    const sorted = [...layer.keyframes].sort((a, b) => a.frame - b.frame)
                    const next = sorted[i + 1]
                    return (
                      <div
                        key={`${kf.frame}-line`}
                        className="absolute top-1/2 h-px bg-indigo-800 pointer-events-none"
                        style={{ left: kf.frame * FRAME_WIDTH, width: (next.frame - kf.frame) * FRAME_WIDTH }}
                      />
                    )
                  })}

                {/* Keyframe diamonds */}
                {layer.keyframes.map((kf) => (
                  <div
                    key={kf.frame}
                    className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rotate-45 z-10 cursor-ew-resize"
                    style={{ left: kf.frame * FRAME_WIDTH }}
                    onPointerDown={(e) => onKfPointerDown(e, layer.id, kf.frame)}
                    onClick={(e) => { e.stopPropagation(); setCurrentFrame(kf.frame); setIsPlaying(false) }}
                    title={`Frame ${kf.frame}`}
                  >
                    <div className={`w-full h-full rounded-sm ${
                      kf.frame === currentFrame && layer.id === activeLayerId
                        ? 'bg-white'
                        : 'bg-indigo-400 hover:bg-indigo-200'
                    }`} />
                  </div>
                ))}
              </div>
            </div>
          ))}

        </div>
      </div>
    </div>
  )
}
