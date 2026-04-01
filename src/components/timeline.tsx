import { useRef, useCallback } from 'react'
import { useStore } from '../store/use-store'

const FRAME_WIDTH = 8 // px per frame

export function Timeline() {
  const { project, activeSceneId, activeLayerId, currentFrame, setCurrentFrame, setIsPlaying } =
    useStore()

  const trackRef = useRef<HTMLDivElement>(null)

  const scene = project?.scenes.find((s) => s.id === activeSceneId)
  const duration = project?.duration ?? 90

  function frameFromClientX(clientX: number): number {
    if (!trackRef.current) return 0
    const rect = trackRef.current.getBoundingClientRect()
    return Math.max(0, Math.min(duration - 1, Math.round((clientX - rect.left) / FRAME_WIDTH)))
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

    function onMove(ev: PointerEvent) {
      setCurrentFrame(frameFromClientX(ev.clientX))
    }
    function onUp() {
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerup', onUp)
    }
    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerup', onUp)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duration])

  const scrubberLeft = currentFrame * FRAME_WIDTH

  return (
    <div className="flex flex-col h-full bg-gray-900 border-t border-gray-700 overflow-hidden">
      {/* Header row */}
      <div
        ref={trackRef}
        className="relative h-6 border-b border-gray-700 cursor-pointer shrink-0 select-none"
        style={{ width: duration * FRAME_WIDTH }}
        onMouseDown={seekToEvent}
      >
        {/* Frame ruler ticks */}
        {Array.from({ length: Math.ceil(duration / 5) }, (_, i) => i * 5).map((f) => (
          <div
            key={f}
            className="absolute top-0 h-full flex items-end pb-0.5"
            style={{ left: f * FRAME_WIDTH }}
          >
            <div className="w-px h-2 bg-gray-600" />
            {f % 10 === 0 && (
              <span className="text-[9px] text-gray-600 ml-0.5 leading-none">{f}</span>
            )}
          </div>
        ))}

        {/* Playhead */}
        <div
          className="absolute top-0 h-full w-px bg-indigo-400 z-10 pointer-events-none"
          style={{ left: scrubberLeft }}
        >
          <div
            className="w-4 h-4 bg-indigo-400 rounded-sm -translate-x-[7px] cursor-ew-resize pointer-events-auto hover:bg-indigo-300"
            onPointerDown={onPlayheadPointerDown}
          />
        </div>
      </div>

      {/* Layer tracks */}
      <div className="flex-1 overflow-y-auto overflow-x-auto">
        {(scene?.layers ?? []).map((layer) => (
          <div
            key={layer.id}
            className="relative h-8 border-b border-gray-800 shrink-0"
            style={{ width: duration * FRAME_WIDTH, minWidth: '100%' }}
          >
            {/* Active layer highlight */}
            {layer.id === activeLayerId && (
              <div className="absolute inset-0 bg-indigo-900/20 pointer-events-none" />
            )}

            {/* Keyframe diamonds */}
            {layer.keyframes.map((kf) => (
              <div
                key={kf.frame}
                className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-2.5 h-2.5 rotate-45 bg-indigo-400 border border-indigo-300 z-10 cursor-pointer hover:bg-white"
                style={{ left: kf.frame * FRAME_WIDTH }}
                onClick={() => {
                  setCurrentFrame(kf.frame)
                  setIsPlaying(false)
                }}
                title={`Frame ${kf.frame}`}
              />
            ))}

            {/* Connector line between keyframes */}
            {layer.keyframes.length >= 2 &&
              layer.keyframes
                .slice(0, -1)
                .map((kf, i) => {
                  const next = layer.keyframes[i + 1]
                  const left = kf.frame * FRAME_WIDTH
                  const width = (next.frame - kf.frame) * FRAME_WIDTH
                  return (
                    <div
                      key={`${kf.frame}-line`}
                      className="absolute top-1/2 h-px bg-indigo-800"
                      style={{ left, width }}
                    />
                  )
                })}
          </div>
        ))}
      </div>
    </div>
  )
}
