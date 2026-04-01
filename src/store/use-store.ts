import { create } from 'zustand'
import type { Project, Keyframe, ShapeType } from '../types'
import { nanoid } from '../lib/nanoid'

const LAYER_COLORS = [0x6366f1, 0xec4899, 0x10b981, 0xf59e0b, 0x3b82f6, 0xef4444, 0xa855f7]

type AppStore = {
  project: Project | null
  activeSceneId: string | null
  activeLayerId: string | null
  currentFrame: number
  isPlaying: boolean

  // actions
  initProject: () => void
  setCurrentFrame: (frame: number) => void
  setIsPlaying: (playing: boolean) => void
  setActiveLayer: (layerId: string) => void
  addKeyframe: (layerId: string, keyframe: Keyframe) => void
  updateKeyframe: (layerId: string, frame: number, patch: Partial<Keyframe>) => void
  updateLayer: (layerId: string, patch: { shape?: ShapeType; color?: number; name?: string }) => void
  addLayer: () => void
  saveToFile: () => void
  loadFromFile: () => void
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
              { frame: 0,  x: 200,  y: 360, scaleX: 1, scaleY: 1, rotation: 0,  alpha: 1, easing: 'ease-in-out' },
              { frame: 45, x: 640,  y: 200, scaleX: 1, scaleY: 1, rotation: 45, alpha: 1, easing: 'ease-in-out' },
              { frame: 89, x: 1080, y: 360, scaleX: 1, scaleY: 1, rotation: 90, alpha: 1, easing: 'ease-in-out' },
            ],
          },
        ],
      },
    ],
    mediaManifest: [],
  }
}

export const useStore = create<AppStore>((set, get) => ({
  project: null,
  activeSceneId: null,
  activeLayerId: null,
  currentFrame: 0,
  isPlaying: false,

  initProject: () => {
    const project = makeDefaultProject()
    set({
      project,
      activeSceneId: project.scenes[0].id,
      activeLayerId: project.scenes[0].layers[0].id,
    })
  },

  setCurrentFrame: (frame) => set({ currentFrame: frame }),

  setIsPlaying: (playing) => set({ isPlaying: playing }),

  setActiveLayer: (layerId) => set({ activeLayerId: layerId }),

  addKeyframe: (layerId, keyframe) =>
    set((state) => {
      if (!state.project || !state.activeSceneId) return state
      return {
        project: {
          ...state.project,
          scenes: state.project.scenes.map((scene) =>
            scene.id !== state.activeSceneId
              ? scene
              : {
                  ...scene,
                  layers: scene.layers.map((layer) =>
                    layer.id !== layerId
                      ? layer
                      : {
                          ...layer,
                          keyframes: [
                            ...layer.keyframes.filter((kf) => kf.frame !== keyframe.frame),
                            keyframe,
                          ].sort((a, b) => a.frame - b.frame),
                        }
                  ),
                }
          ),
        },
      }
    }),

  updateKeyframe: (layerId, frame, patch) =>
    set((state) => {
      if (!state.project || !state.activeSceneId) return state
      return {
        project: {
          ...state.project,
          scenes: state.project.scenes.map((scene) =>
            scene.id !== state.activeSceneId
              ? scene
              : {
                  ...scene,
                  layers: scene.layers.map((layer) =>
                    layer.id !== layerId
                      ? layer
                      : {
                          ...layer,
                          keyframes: layer.keyframes.map((kf) =>
                            kf.frame !== frame ? kf : { ...kf, ...patch }
                          ),
                        }
                  ),
                }
          ),
        },
      }
    }),

  updateLayer: (layerId, patch) =>
    set((state) => {
      if (!state.project || !state.activeSceneId) return state
      return {
        project: {
          ...state.project,
          scenes: state.project.scenes.map((scene) =>
            scene.id !== state.activeSceneId
              ? scene
              : {
                  ...scene,
                  layers: scene.layers.map((layer) =>
                    layer.id !== layerId ? layer : { ...layer, ...patch }
                  ),
                }
          ),
        },
      }
    }),

  addLayer: () =>
    set((state) => {
      if (!state.project || !state.activeSceneId) return state
      const scene = state.project.scenes.find((s) => s.id === state.activeSceneId)!
      const colorIndex = scene.layers.length % LAYER_COLORS.length
      const newLayer = {
        id: nanoid(),
        name: `Layer ${scene.layers.length + 1}`,
        visible: true,
        locked: false,
        mediaId: null,
        shape: 'rect' as ShapeType,
        color: LAYER_COLORS[colorIndex],
        // Spawn at canvas center so it's immediately visible
        keyframes: [
          { frame: 0, x: 640, y: 360, scaleX: 1, scaleY: 1, rotation: 0, alpha: 1, easing: 'ease-in-out' as const },
        ],
      }
      return {
        activeLayerId: newLayer.id,
        project: {
          ...state.project,
          scenes: state.project.scenes.map((scene) =>
            scene.id !== state.activeSceneId
              ? scene
              : { ...scene, layers: [...scene.layers, newLayer] }
          ),
        },
      }
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
    set({
      project,
      activeSceneId: project.scenes[0]?.id ?? null,
      activeLayerId: project.scenes[0]?.layers[0]?.id ?? null,
      currentFrame: 0,
      isPlaying: false,
    })
  },
}))
