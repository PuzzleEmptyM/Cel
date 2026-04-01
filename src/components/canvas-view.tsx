import { useEffect, useRef } from 'react'
import { initPixi, destroyPixi } from '../canvas/pixi-app'

export function CanvasView() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!canvasRef.current) return
    initPixi(canvasRef.current)
    return () => destroyPixi()
  }, [])

  return (
    <div className="relative w-full h-full bg-gray-900 flex items-center justify-center overflow-hidden">
      <canvas ref={canvasRef} className="w-full h-full" />
    </div>
  )
}
