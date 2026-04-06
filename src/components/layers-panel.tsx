import { useState } from 'react'
import { useStore } from '../store/use-store'

export function LayersPanel() {
  const {
    project, activeSceneId, activeLayerId,
    setActiveLayer, addLayer, deleteLayer,
    moveLayer, duplicateLayer,
    addScene, deleteScene, setActiveScene, renameScene,
  } = useStore()

  const [editingSceneId, setEditingSceneId] = useState<string | null>(null)

  const scenes = project?.scenes ?? []
  const scene = scenes.find((s) => s.id === activeSceneId)
  const layers = scene?.layers ?? []

  return (
    <div className="flex flex-col h-full bg-gray-900 border-r border-gray-700">

      {/* ── Scenes ── */}
      <div className="border-b border-gray-700">
        <div className="flex items-center justify-between px-3 py-1.5">
          <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Scenes</span>
          <button
            className="text-xs px-1.5 py-0.5 rounded bg-gray-800 hover:bg-gray-700 text-gray-400"
            onClick={addScene}
          >
            +
          </button>
        </div>
        <div className="flex gap-1 px-2 pb-2 flex-wrap">
          {scenes.map((s) => (
            <div key={s.id} className="relative group">
              {editingSceneId === s.id ? (
                <input
                  autoFocus
                  defaultValue={s.name}
                  className="text-xs px-2 py-0.5 rounded bg-gray-700 text-white border border-indigo-500 outline-none w-20"
                  onBlur={(e) => { renameScene(s.id, e.target.value || s.name); setEditingSceneId(null) }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                    if (e.key === 'Escape') setEditingSceneId(null)
                  }}
                />
              ) : (
                <button
                  onDoubleClick={() => setEditingSceneId(s.id)}
                  onClick={() => setActiveScene(s.id)}
                  className={`text-xs px-2 py-0.5 rounded ${
                    s.id === activeSceneId
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                  }`}
                >
                  {s.name}
                </button>
              )}
              {scenes.length > 1 && (
                <button
                  className="absolute -top-1 -right-1 hidden group-hover:flex w-3.5 h-3.5 rounded-full bg-red-600 text-white items-center justify-center text-[9px] leading-none"
                  onClick={(e) => { e.stopPropagation(); deleteScene(s.id) }}
                >
                  ×
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── Layers header ── */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-700">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Layers</span>
        <button
          className="text-xs px-2 py-0.5 rounded bg-gray-800 hover:bg-gray-700 text-gray-300"
          onClick={addLayer}
        >
          + Add
        </button>
      </div>

      {/* ── Layer list ── */}
      <div className="flex-1 overflow-y-auto">
        {[...layers].reverse().map((layer, reversedIdx) => {
          const realIdx = layers.length - 1 - reversedIdx
          return (
          <div
            key={layer.id}
            onClick={() => setActiveLayer(layer.id)}
            className={`group flex items-center gap-1 px-2 py-2 cursor-pointer text-sm border-b border-gray-800 ${
              layer.id === activeLayerId
                ? 'bg-indigo-900/40 text-white'
                : 'text-gray-400 hover:bg-gray-800'
            }`}
          >
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: '#' + layer.color.toString(16).padStart(6, '0') }}
            />
            <span className="truncate flex-1 min-w-0 pl-1">{layer.name}</span>
            {/* always-visible reorder arrows */}
            <div className="flex flex-col shrink-0" onClick={(e) => e.stopPropagation()}>
              <button
                className="text-[9px] text-gray-600 hover:text-gray-300 leading-none px-0.5 disabled:opacity-20"
                onClick={() => moveLayer(layer.id, 'up')}
                disabled={realIdx === layers.length - 1}
                title="Move up"
              >▲</button>
              <button
                className="text-[9px] text-gray-600 hover:text-gray-300 leading-none px-0.5 disabled:opacity-20"
                onClick={() => moveLayer(layer.id, 'down')}
                disabled={realIdx === 0}
                title="Move down"
              >▼</button>
            </div>
            {/* hover actions */}
            <span className="text-xs text-gray-600 group-hover:hidden shrink-0">{layer.keyframes.length}kf</span>
            <div className="hidden group-hover:flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
              <button
                className="flex items-center justify-center w-5 h-5 rounded hover:bg-gray-700 text-gray-500 hover:text-gray-200 text-xs"
                onClick={() => duplicateLayer(layer.id)}
                title="Duplicate layer"
              >⧉</button>
              <button
                className="flex items-center justify-center w-5 h-5 rounded hover:bg-red-700 text-gray-500 hover:text-white text-xs"
                onClick={() => deleteLayer(layer.id)}
                title="Delete layer"
              >×</button>
            </div>
          </div>
          )
        })}
        {layers.length === 0 && (
          <div className="px-3 py-4 text-xs text-gray-600">No layers — click + Add</div>
        )}
      </div>
    </div>
  )
}
