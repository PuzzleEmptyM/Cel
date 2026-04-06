import { useStore } from '../store/use-store'
import { interpolateLayer, getActiveStrokes } from '../lib/interpolate'
import type { Keyframe, ShapeType } from '../types'

const SHAPES: { type: ShapeType; label: string }[] = [
  { type: 'rect',     label: '▭' },
  { type: 'circle',   label: '●' },
  { type: 'star',     label: '★' },
  { type: 'triangle', label: '▲' },
  { type: 'drawing',  label: '✏' },
]

const COLORS: { label: string; value: number }[] = [
  { label: 'Indigo',  value: 0x6366f1 },
  { label: 'Pink',    value: 0xec4899 },
  { label: 'Green',   value: 0x10b981 },
  { label: 'Amber',   value: 0xf59e0b },
  { label: 'Blue',    value: 0x3b82f6 },
  { label: 'Red',     value: 0xef4444 },
  { label: 'Purple',  value: 0xa855f7 },
  { label: 'White',   value: 0xf3f4f6 },
]

function hexColor(n: number): string {
  return '#' + n.toString(16).padStart(6, '0')
}

export function Inspector() {
  const { project, activeSceneId, activeLayerId, currentFrame, addKeyframe, deleteKeyframe, duplicateKeyframe, updateLayer, clearFrameStrokes } = useStore()

  const scene = project?.scenes.find((s) => s.id === activeSceneId)
  const layer = scene?.layers.find((l) => l.id === activeLayerId)
  const transformState = layer ? interpolateLayer(layer.keyframes, currentFrame) : null
  const existingKf = layer?.keyframes.find((kf) => kf.frame === currentFrame)
  const activeStrokes = layer?.shape === 'drawing' ? getActiveStrokes(layer.keyframes, currentFrame) : null

  function handleAddKeyframe() {
    if (!layer) return
    const kf: Keyframe = {
      frame: currentFrame,
      x: transformState?.x ?? 0,
      y: transformState?.y ?? 0,
      scaleX: transformState?.scaleX ?? 1,
      scaleY: transformState?.scaleY ?? 1,
      rotation: transformState?.rotation ?? 0,
      alpha: transformState?.alpha ?? 1,
      easing: existingKf?.easing ?? 'ease-in-out',
      strokes: existingKf?.strokes ?? [],
    }
    addKeyframe(layer.id, kf)
  }

  return (
    <div className="flex flex-col h-full bg-gray-900 border-l border-gray-700 overflow-y-auto">
      <div className="px-3 py-2 border-b border-gray-700 shrink-0">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Inspector</span>
      </div>

      {layer ? (
        <div className="p-3 flex flex-col gap-4">

          {/* Shape picker */}
          <div>
            <div className="text-xs text-gray-500 mb-1.5">Shape</div>
            <div className="grid grid-cols-5 gap-1">
              {SHAPES.map(({ type, label }) => (
                <button
                  key={type}
                  onClick={() => updateLayer(layer.id, { shape: type })}
                  className={`py-1.5 rounded text-base font-medium transition-colors ${
                    layer.shape === type
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                  }`}
                  title={type}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Drawing layer info */}
          {layer.shape === 'drawing' && (
            <div className="flex flex-col gap-2">
              <div className="text-xs text-gray-500">
                Drawing layer — use the ✏ tool to draw. Each frame is its own cel.
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-500">Strokes on active cel</span>
                <span className="text-gray-300 tabular-nums">{activeStrokes?.length ?? 0}</span>
              </div>
              {existingKf && (existingKf.strokes.length > 0) && (
                <button
                  className="w-full py-1.5 text-xs rounded bg-gray-800 hover:bg-red-800 text-gray-400 hover:text-white"
                  onClick={() => clearFrameStrokes(layer.id, currentFrame)}
                >
                  Clear this frame's strokes
                </button>
              )}
            </div>
          )}

          {/* Color swatches — only for non-drawing layers */}
          {layer.shape !== 'drawing' && (
            <div>
              <div className="text-xs text-gray-500 mb-1.5">Color</div>
              <div className="grid grid-cols-4 gap-1.5">
                {COLORS.map(({ label, value }) => (
                  <button
                    key={value}
                    onClick={() => updateLayer(layer.id, { color: value })}
                    title={label}
                    style={{ backgroundColor: hexColor(value) }}
                    className={`h-7 rounded transition-transform hover:scale-110 ${
                      layer.color === value ? 'ring-2 ring-white ring-offset-1 ring-offset-gray-900' : ''
                    }`}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Transform values — only for non-drawing layers */}
          {layer.shape !== 'drawing' && transformState && (
            <div className="flex flex-col gap-2">
              <div className="text-xs text-gray-500">Transform</div>
              <PropRow label="X" value={transformState.x.toFixed(1)} />
              <PropRow label="Y" value={transformState.y.toFixed(1)} />
              <PropRow label="Scale X" value={transformState.scaleX.toFixed(2)} />
              <PropRow label="Scale Y" value={transformState.scaleY.toFixed(2)} />
              <PropRow label="Rotation" value={`${transformState.rotation.toFixed(1)}°`} />
              <PropRow label="Alpha" value={transformState.alpha.toFixed(2)} />
            </div>
          )}

          {/* Keyframe buttons — for drawing layers, "New blank cel" */}
          <div className="flex gap-2">
            <button
              className={`flex-1 py-1.5 text-xs rounded font-medium ${
                existingKf
                  ? 'bg-indigo-900 text-indigo-300 border border-indigo-700'
                  : 'bg-indigo-600 hover:bg-indigo-500 text-white'
              }`}
              onClick={handleAddKeyframe}
            >
              {layer.shape === 'drawing'
                ? existingKf ? '● Cel exists' : '+ New blank cel'
                : existingKf ? '● Keyframe set' : '+ Add Keyframe'}
            </button>
            {existingKf && (
              <button
                className="px-2 py-1.5 text-xs rounded bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white"
                onClick={() => duplicateKeyframe(layer.id, currentFrame, currentFrame + 1)}
                title="Duplicate to next frame"
              >
                ⧉
              </button>
            )}
            {existingKf && (
              <button
                className="px-2 py-1.5 text-xs rounded bg-gray-800 hover:bg-red-700 text-gray-400 hover:text-white"
                onClick={() => deleteKeyframe(layer.id, currentFrame)}
                title={layer.shape === 'drawing' ? 'Delete cel' : 'Delete keyframe'}
              >
                ×
              </button>
            )}
          </div>

          {layer.shape !== 'drawing' && !transformState && (
            <p className="text-xs text-gray-600">No keyframes — drag the shape to create one</p>
          )}
        </div>
      ) : (
        <div className="p-3 text-xs text-gray-600">Select a layer</div>
      )}
    </div>
  )
}

function PropRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-gray-500">{label}</span>
      <span className="text-gray-200 tabular-nums font-mono">{value}</span>
    </div>
  )
}
