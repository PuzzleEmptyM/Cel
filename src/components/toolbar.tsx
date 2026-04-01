import { useStore } from '../store/use-store'

export function Toolbar() {
  const { project, isPlaying, setIsPlaying, currentFrame, setCurrentFrame, saveToFile, loadFromFile } = useStore()

  return (
    <div className="flex items-center gap-3 px-4 h-full bg-gray-900 border-b border-gray-700">
      <span className="text-sm font-semibold text-indigo-400 tracking-wide mr-2">Cel</span>

      <div className="h-5 w-px bg-gray-700" />

      <button
        className="px-3 py-1 text-xs rounded bg-gray-800 hover:bg-gray-700 text-gray-300"
        onClick={() => {
          setCurrentFrame(0)
          setIsPlaying(false)
        }}
      >
        ⏮
      </button>

      <button
        className="px-4 py-1 text-sm rounded bg-indigo-600 hover:bg-indigo-500 text-white font-medium"
        onClick={() => {
          if (currentFrame >= (project?.duration ?? 90) - 1) setCurrentFrame(0)
          setIsPlaying(!isPlaying)
        }}
      >
        {isPlaying ? '⏸ Pause' : '▶ Play'}
      </button>

      <div className="h-5 w-px bg-gray-700" />

      <span className="text-xs text-gray-400 tabular-nums">
        Frame {currentFrame} / {(project?.duration ?? 90) - 1}
      </span>

      <div className="flex-1" />

      <button
        className="px-3 py-1 text-xs rounded bg-gray-800 hover:bg-gray-700 text-gray-300"
        onClick={saveToFile}
      >
        Save
      </button>
      <button
        className="px-3 py-1 text-xs rounded bg-gray-800 hover:bg-gray-700 text-gray-300"
        onClick={loadFromFile}
      >
        Open
      </button>

      <span className="text-xs text-gray-500">{project?.name ?? ''}</span>
    </div>
  )
}
