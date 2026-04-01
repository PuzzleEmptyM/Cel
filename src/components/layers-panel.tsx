import { useStore } from '../store/use-store'

export function LayersPanel() {
  const { project, activeSceneId, activeLayerId, setActiveLayer, addLayer } = useStore()

  const scene = project?.scenes.find((s) => s.id === activeSceneId)
  const layers = scene?.layers ?? []

  return (
    <div className="flex flex-col h-full bg-gray-900 border-r border-gray-700">
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-700">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Layers</span>
        <button
          className="text-xs px-2 py-0.5 rounded bg-gray-800 hover:bg-gray-700 text-gray-300"
          onClick={addLayer}
        >
          + Add
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {[...layers].reverse().map((layer) => (
          <div
            key={layer.id}
            onClick={() => setActiveLayer(layer.id)}
            className={`flex items-center gap-2 px-3 py-2 cursor-pointer text-sm border-b border-gray-800 ${
              layer.id === activeLayerId
                ? 'bg-indigo-900/40 text-white'
                : 'text-gray-400 hover:bg-gray-800'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-indigo-400 shrink-0" />
            <span className="truncate">{layer.name}</span>
            <span className="ml-auto text-xs text-gray-600">{layer.keyframes.length}kf</span>
          </div>
        ))}
      </div>
    </div>
  )
}
