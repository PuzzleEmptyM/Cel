import { useStore } from '../store/use-store'

const DRAW_COLORS = [
  { label: 'White',  value: 0xf3f4f6 },
  { label: 'Black',  value: 0x111827 },
  { label: 'Red',    value: 0xef4444 },
  { label: 'Orange', value: 0xf97316 },
  { label: 'Yellow', value: 0xfbbf24 },
  { label: 'Green',  value: 0x10b981 },
  { label: 'Blue',   value: 0x3b82f6 },
  { label: 'Purple', value: 0xa855f7 },
]

const BRUSH_SIZES = [
  { label: 'S', value: 2 },
  { label: 'M', value: 6 },
  { label: 'L', value: 14 },
]

const SMOOTHING_LEVELS: { label: string; value: 0 | 2 | 4 }[] = [
  { label: 'Off', value: 0 },
  { label: '~', value: 2 },
  { label: '~~', value: 4 },
]

export function Toolbar() {
  const {
    project, isPlaying, setIsPlaying, currentFrame, setCurrentFrame,
    onionSkinEnabled, toggleOnionSkin,
    tool, setTool, drawColor, setDrawColor, drawWidth, setDrawWidth, drawSmoothing, setDrawSmoothing,
    saveToFile, loadFromFile,
  } = useStore()

  return (
    <div className="flex items-center gap-2 px-4 h-full bg-gray-900 border-b border-gray-700 overflow-x-auto">
      <span className="text-sm font-semibold text-indigo-400 tracking-wide shrink-0">Cel</span>

      <div className="h-5 w-px bg-gray-700 shrink-0" />

      {/* Tool toggle */}
      <div className="flex rounded overflow-hidden border border-gray-700 shrink-0">
        <button
          className={`px-2.5 py-1 text-sm ${tool === 'select' ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
          onClick={() => setTool('select')}
          title="Select / Move (V)"
        >
          ↖
        </button>
        <button
          className={`px-2.5 py-1 text-sm ${tool === 'draw' ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
          onClick={() => setTool('draw')}
          title="Draw (B)"
        >
          ✏
        </button>
      </div>

      {/* Brush settings — only when draw tool active */}
      {tool === 'draw' && (
        <>
          <div className="h-5 w-px bg-gray-700 shrink-0" />
          {/* Color swatches */}
          <div className="flex gap-1 shrink-0">
            {DRAW_COLORS.map(({ label, value }) => (
              <button
                key={value}
                title={label}
                onClick={() => setDrawColor(value)}
                style={{ backgroundColor: '#' + value.toString(16).padStart(6, '0') }}
                className={`w-5 h-5 rounded-full border-2 transition-transform hover:scale-110 ${
                  drawColor === value ? 'border-white' : 'border-transparent'
                }`}
              />
            ))}
          </div>
          <div className="h-5 w-px bg-gray-700 shrink-0" />
          {/* Brush size */}
          <div className="flex gap-1 shrink-0">
            {BRUSH_SIZES.map(({ label, value }) => (
              <button
                key={value}
                onClick={() => setDrawWidth(value)}
                className={`px-2 py-0.5 text-xs rounded ${
                  drawWidth === value
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-800 hover:bg-gray-700 text-gray-400'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="h-5 w-px bg-gray-700 shrink-0" />
          {/* Smoothing */}
          <div className="flex items-center gap-1 shrink-0">
            <span className="text-[10px] text-gray-500">Smooth</span>
            {SMOOTHING_LEVELS.map(({ label, value }) => (
              <button
                key={value}
                onClick={() => setDrawSmoothing(value)}
                className={`px-2 py-0.5 text-xs rounded ${
                  drawSmoothing === value
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-800 hover:bg-gray-700 text-gray-400'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </>
      )}

      <div className="h-5 w-px bg-gray-700 shrink-0" />

      {/* Playback */}
      <button
        className="px-2 py-1 text-xs rounded bg-gray-800 hover:bg-gray-700 text-gray-300 shrink-0"
        onClick={() => { setCurrentFrame(0); setIsPlaying(false) }}
      >
        ⏮
      </button>
      <button
        className="px-3 py-1 text-sm rounded bg-indigo-600 hover:bg-indigo-500 text-white font-medium shrink-0"
        onClick={() => {
          if (currentFrame >= (project?.duration ?? 90) - 1) setCurrentFrame(0)
          setIsPlaying(!isPlaying)
        }}
      >
        {isPlaying ? '⏸' : '▶'}
      </button>

      <div className="h-5 w-px bg-gray-700 shrink-0" />

      <span className="text-xs text-gray-400 tabular-nums shrink-0">
        {currentFrame} / {(project?.duration ?? 90) - 1}
      </span>

      <div className="h-5 w-px bg-gray-700 shrink-0" />

      <button
        className={`px-3 py-1 text-xs rounded font-medium shrink-0 ${
          onionSkinEnabled ? 'bg-indigo-700 text-white' : 'bg-gray-800 hover:bg-gray-700 text-gray-400'
        }`}
        onClick={toggleOnionSkin}
        title="Toggle onion skinning"
      >
        Onion
      </button>

      <div className="flex-1" />

      <button className="px-3 py-1 text-xs rounded bg-gray-800 hover:bg-gray-700 text-gray-300 shrink-0" onClick={saveToFile}>Save</button>
      <button className="px-3 py-1 text-xs rounded bg-gray-800 hover:bg-gray-700 text-gray-300 shrink-0" onClick={loadFromFile}>Open</button>

      <span className="text-xs text-gray-500 shrink-0">{project?.name ?? ''}</span>
    </div>
  )
}
