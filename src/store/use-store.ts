import { create } from 'zustand'
import type { Project, Keyframe, ShapeType, Stroke } from '../types'
import { nanoid } from '../lib/nanoid'

const LAYER_COLORS = [0x6366f1, 0xec4899, 0x10b981, 0xf59e0b, 0x3b82f6, 0xef4444, 0xa855f7]

const MAX_HISTORY = 60

type AppStore = {
  project: Project | null
  activeSceneId: string | null
  activeLayerId: string | null
  currentFrame: number
  isPlaying: boolean
  onionSkinEnabled: boolean
  tool: 'select' | 'draw'
  drawColor: number
  drawWidth: number
  drawSmoothing: 0 | 2 | 4
  _undoStack: Project[]
  _redoStack: Project[]

  // actions
  undo: () => void
  redo: () => void
  initProject: () => void
  setCurrentFrame: (frame: number) => void
  setIsPlaying: (playing: boolean) => void
  setActiveLayer: (layerId: string) => void
  addKeyframe: (layerId: string, keyframe: Keyframe) => void
  deleteKeyframe: (layerId: string, frame: number) => void
  updateKeyframe: (layerId: string, frame: number, patch: Partial<Keyframe>) => void
  updateLayer: (layerId: string, patch: { shape?: ShapeType; color?: number; name?: string }) => void
  addLayer: () => void
  deleteLayer: (layerId: string) => void
  // drawing
  addStroke: (layerId: string, stroke: Stroke) => void
  clearFrameStrokes: (layerId: string, frame: number) => void
  setTool: (tool: 'select' | 'draw') => void
  setDrawColor: (color: number) => void
  setDrawWidth: (width: number) => void
  setDrawSmoothing: (smoothing: 0 | 2 | 4) => void
  toggleOnionSkin: () => void
  moveKeyframe: (layerId: string, fromFrame: number, toFrame: number) => void
  moveLayer: (layerId: string, direction: 'up' | 'down') => void
  duplicateLayer: (layerId: string) => void
  duplicateKeyframe: (layerId: string, fromFrame: number, toFrame: number) => void
  // scene actions
  addScene: () => void
  deleteScene: (sceneId: string) => void
  setActiveScene: (sceneId: string) => void
  renameScene: (sceneId: string, name: string) => void
  saveToFile: () => void
  loadFromFile: () => void
}

function blankKf(frame: number, overrides?: Partial<Keyframe>): Keyframe {
  return { frame, x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0, alpha: 1, easing: 'linear', strokes: [], ...overrides }
}

function makeDefaultProject(): Project {
  const layerId = nanoid()
  const sceneId = nanoid()
  return {
    id: nanoid(),
    name: 'Untitled',
    fps: 24,
    duration: 90,
    resolution: { width: 1280, height: 720 },
    scenes: [
      {
        id: sceneId,
        name: 'Scene 1',
        layers: [
          {
            id: layerId,
            name: 'Layer 1',
            visible: true,
            locked: false,
            mediaId: null,
            shape: 'rect',
            color: LAYER_COLORS[0],
            keyframes: [
              blankKf(0,  { x: 200,  y: 360, easing: 'ease-in-out' }),
              blankKf(45, { x: 640,  y: 200, rotation: 45, easing: 'ease-in-out' }),
              blankKf(89, { x: 1080, y: 360, rotation: 90, easing: 'ease-in-out' }),
            ],
          },
        ],
      },
    ],
    mediaManifest: [],
  }
}

type Layers = Project['scenes'][0]['layers']

function mapActiveScene(state: AppStore, fn: (layers: Layers) => Layers): Partial<AppStore> {
  if (!state.project || !state.activeSceneId) return state
  return {
    project: {
      ...state.project,
      scenes: state.project.scenes.map((scene) =>
        scene.id !== state.activeSceneId ? scene : { ...scene, layers: fn(scene.layers) }
      ),
    },
  }
}

function withHistory(state: AppStore, patch: Partial<AppStore>): Partial<AppStore> {
  if (!state.project) return patch
  const snap = structuredClone(state.project)
  return {
    ...patch,
    _undoStack: [...state._undoStack, snap].slice(-MAX_HISTORY),
    _redoStack: [],
  }
}

export const useStore = create<AppStore>((set, get) => ({
  project: null,
  activeSceneId: null,
  activeLayerId: null,
  currentFrame: 0,
  _undoStack: [],
  _redoStack: [],
  isPlaying: false,
  onionSkinEnabled: false,
  tool: 'select',
  drawColor: 0xf3f4f6,
  drawWidth: 4,
  drawSmoothing: 2,

  undo: () => set((state) => {
    const stack = state._undoStack
    if (stack.length === 0) return state
    const project = stack[stack.length - 1]
    return {
      project,
      _undoStack: stack.slice(0, -1),
      _redoStack: state.project ? [...state._redoStack, structuredClone(state.project)] : state._redoStack,
    }
  }),

  redo: () => set((state) => {
    const stack = state._redoStack
    if (stack.length === 0) return state
    const project = stack[stack.length - 1]
    return {
      project,
      _redoStack: stack.slice(0, -1),
      _undoStack: state.project ? [...state._undoStack, structuredClone(state.project)] : state._undoStack,
    }
  }),

  initProject: () => {
    const project = makeDefaultProject()
    set({ project, activeSceneId: project.scenes[0].id, activeLayerId: project.scenes[0].layers[0].id, _undoStack: [], _redoStack: [] })
  },

  setCurrentFrame: (frame) => set({ currentFrame: frame }),
  setIsPlaying: (playing) => set({ isPlaying: playing }),
  setActiveLayer: (layerId) => set({ activeLayerId: layerId }),

  addKeyframe: (layerId, keyframe) =>
    set((state) => withHistory(state, mapActiveScene(state, (layers) =>
      layers.map((layer) =>
        layer.id !== layerId ? layer : {
          ...layer,
          keyframes: [
            ...layer.keyframes.filter((kf) => kf.frame !== keyframe.frame),
            keyframe,
          ].sort((a, b) => a.frame - b.frame),
        }
      )
    ))),

  deleteKeyframe: (layerId, frame) =>
    set((state) => withHistory(state, mapActiveScene(state, (layers) =>
      layers.map((layer) =>
        layer.id !== layerId ? layer : {
          ...layer,
          keyframes: layer.keyframes.filter((kf) => kf.frame !== frame),
        }
      )
    ))),

  updateKeyframe: (layerId, frame, patch) =>
    set((state) => mapActiveScene(state, (layers) =>
      layers.map((layer) =>
        layer.id !== layerId ? layer : {
          ...layer,
          keyframes: layer.keyframes.map((kf) => kf.frame !== frame ? kf : { ...kf, ...patch }),
        }
      )
    )),

  updateLayer: (layerId, patch) =>
    set((state) => mapActiveScene(state, (layers) =>
      layers.map((layer) => layer.id !== layerId ? layer : { ...layer, ...patch })
    )),

  addLayer: () =>
    set((state) => {
      if (!state.project || !state.activeSceneId) return state
      const scene = state.project.scenes.find((s) => s.id === state.activeSceneId)!
      const colorIndex = scene.layers.length % LAYER_COLORS.length
      const newLayer = {
        id: nanoid(),
        name: `Layer ${scene.layers.length + 1}`,
        visible: true, locked: false, mediaId: null,
        shape: 'rect' as ShapeType,
        color: LAYER_COLORS[colorIndex],
        keyframes: [blankKf(0, { x: 640, y: 360, easing: 'ease-in-out' })],
      }
      return { activeLayerId: newLayer.id, ...mapActiveScene(state, (layers) => [...layers, newLayer]) }
    }),

  deleteLayer: (layerId) =>
    set((state) => {
      if (!state.project || !state.activeSceneId) return state
      const scene = state.project.scenes.find((s) => s.id === state.activeSceneId)!
      const remaining = scene.layers.filter((l) => l.id !== layerId)
      const newActiveLayerId =
        state.activeLayerId === layerId ? (remaining[remaining.length - 1]?.id ?? null) : state.activeLayerId
      return { activeLayerId: newActiveLayerId, ...mapActiveScene(state, (layers) => layers.filter((l) => l.id !== layerId)) }
    }),

  // Adds a stroke to the keyframe at currentFrame, creating that keyframe if it doesn't exist.
  addStroke: (layerId, stroke) =>
    set((state) =>
      mapActiveScene(state, (layers) =>
        layers.map((layer) => {
          if (layer.id !== layerId) return layer
          const { currentFrame } = state
          const existingKf = layer.keyframes.find((kf) => kf.frame === currentFrame)
          if (existingKf) {
            return {
              ...layer,
              keyframes: layer.keyframes.map((kf) =>
                kf.frame !== currentFrame ? kf : { ...kf, strokes: [...kf.strokes, stroke] }
              ),
            }
          }
          // No keyframe at this frame — create one with just this stroke
          const newKf = blankKf(currentFrame, { strokes: [stroke] })
          return {
            ...layer,
            keyframes: [...layer.keyframes, newKf].sort((a, b) => a.frame - b.frame),
          }
        })
      )
    ),

  clearFrameStrokes: (layerId, frame) =>
    set((state) => mapActiveScene(state, (layers) =>
      layers.map((layer) =>
        layer.id !== layerId ? layer : {
          ...layer,
          keyframes: layer.keyframes.map((kf) =>
            kf.frame !== frame ? kf : { ...kf, strokes: [] }
          ),
        }
      )
    )),

  setTool: (tool) => set({ tool }),
  setDrawColor: (drawColor) => set({ drawColor }),
  setDrawWidth: (drawWidth) => set({ drawWidth }),
  setDrawSmoothing: (drawSmoothing) => set({ drawSmoothing }),
  toggleOnionSkin: () => set((s) => ({ onionSkinEnabled: !s.onionSkinEnabled })),

  moveKeyframe: (layerId, fromFrame, toFrame) =>
    set((state) => mapActiveScene(state, (layers) =>
      layers.map((layer) => {
        if (layer.id !== layerId) return layer
        const kf = layer.keyframes.find((k) => k.frame === fromFrame)
        if (!kf) return layer
        return {
          ...layer,
          keyframes: [
            ...layer.keyframes.filter((k) => k.frame !== fromFrame && k.frame !== toFrame),
            { ...kf, frame: toFrame },
          ].sort((a, b) => a.frame - b.frame),
        }
      })
    )),

  moveLayer: (layerId, direction) =>
    set((state) => mapActiveScene(state, (layers) => {
      const idx = layers.findIndex((l) => l.id === layerId)
      if (idx === -1) return layers
      const swapIdx = direction === 'up' ? idx - 1 : idx + 1
      if (swapIdx < 0 || swapIdx >= layers.length) return layers
      const next = [...layers]
      ;[next[idx], next[swapIdx]] = [next[swapIdx], next[idx]]
      return next
    })),

  duplicateLayer: (layerId) =>
    set((state) => {
      if (!state.project || !state.activeSceneId) return state
      const scene = state.project.scenes.find((s) => s.id === state.activeSceneId)!
      const src = scene.layers.find((l) => l.id === layerId)
      if (!src) return state
      const cloned = structuredClone(src)
      cloned.id = nanoid()
      cloned.name = src.name + ' copy'
      cloned.keyframes = cloned.keyframes.map((kf) => ({
        ...kf,
        strokes: kf.strokes.map((s) => ({ ...s, id: nanoid() })),
      }))
      const idx = scene.layers.findIndex((l) => l.id === layerId)
      return {
        activeLayerId: cloned.id,
        ...mapActiveScene(state, (layers) => [
          ...layers.slice(0, idx + 1),
          cloned,
          ...layers.slice(idx + 1),
        ]),
      }
    }),

  duplicateKeyframe: (layerId, fromFrame, toFrame) =>
    set((state) => mapActiveScene(state, (layers) =>
      layers.map((layer) => {
        if (layer.id !== layerId) return layer
        const src = layer.keyframes.find((kf) => kf.frame === fromFrame)
        if (!src) return layer
        const cloned = structuredClone(src)
        cloned.frame = toFrame
        cloned.strokes = cloned.strokes.map((s) => ({ ...s, id: nanoid() }))
        return {
          ...layer,
          keyframes: [
            ...layer.keyframes.filter((kf) => kf.frame !== toFrame),
            cloned,
          ].sort((a, b) => a.frame - b.frame),
        }
      })
    )),

  addScene: () =>
    set((state) => {
      if (!state.project) return state
      const newScene = { id: nanoid(), name: `Scene ${state.project.scenes.length + 1}`, layers: [] }
      return { activeSceneId: newScene.id, activeLayerId: null, project: { ...state.project, scenes: [...state.project.scenes, newScene] } }
    }),

  deleteScene: (sceneId) =>
    set((state) => {
      if (!state.project || state.project.scenes.length <= 1) return state
      const remaining = state.project.scenes.filter((s) => s.id !== sceneId)
      const newActive = state.activeSceneId === sceneId ? remaining[0] : state.project.scenes.find((s) => s.id === state.activeSceneId)!
      return { activeSceneId: newActive.id, activeLayerId: newActive.layers[0]?.id ?? null, project: { ...state.project, scenes: remaining } }
    }),

  setActiveScene: (sceneId) =>
    set((state) => {
      if (!state.project) return state
      const scene = state.project.scenes.find((s) => s.id === sceneId)
      if (!scene) return state
      return { activeSceneId: sceneId, activeLayerId: scene.layers[0]?.id ?? null, currentFrame: 0, isPlaying: false }
    }),

  renameScene: (sceneId, name) =>
    set((state) => {
      if (!state.project) return state
      return { project: { ...state.project, scenes: state.project.scenes.map((s) => s.id !== sceneId ? s : { ...s, name }) } }
    }),

  saveToFile: () => {
    const { project } = get()
    if (!project) return
    const blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${project.name}.cel.json`
    a.click()
    URL.revokeObjectURL(url)
  },

  loadFromFile: async () => {
    const [fileHandle] = await (window as Window & typeof globalThis & { showOpenFilePicker: (opts: unknown) => Promise<FileSystemFileHandle[]> }).showOpenFilePicker({
      types: [{ description: 'Cel project', accept: { 'application/json': ['.json'] } }],
    })
    const file = await fileHandle.getFile()
    const text = await file.text()
    const project = JSON.parse(text) as Project
    set({ project, activeSceneId: project.scenes[0]?.id ?? null, activeLayerId: project.scenes[0]?.layers[0]?.id ?? null, currentFrame: 0, isPlaying: false })
  },
}))
