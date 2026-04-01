export type Easing = 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out'

export type ShapeType = 'rect' | 'circle' | 'star' | 'triangle'

export type Keyframe = {
  frame: number
  x: number
  y: number
  scaleX: number
  scaleY: number
  rotation: number
  alpha: number
  easing: Easing
}

export type Layer = {
  id: string
  name: string
  visible: boolean
  locked: boolean
  mediaId: string | null
  shape: ShapeType
  color: number  // hex int e.g. 0x6366f1
  keyframes: Keyframe[]
}

export type Scene = {
  id: string
  name: string
  layers: Layer[]
}

export type MediaEntry = {
  id: string
  filename: string
  path: string
  hash: string
  width?: number
  height?: number
  importedAt: number
}

export type Project = {
  id: string
  name: string
  fps: number
  duration: number
  resolution: { width: number; height: number }
  scenes: Scene[]
  mediaManifest: MediaEntry[]
}
