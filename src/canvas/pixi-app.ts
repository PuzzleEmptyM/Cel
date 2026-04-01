import { Application, Graphics, Container, FederatedPointerEvent } from 'pixi.js'
import { useStore } from '../store/use-store'
import { interpolateLayer } from '../lib/interpolate'
import type { Layer, ShapeType } from '../types'

let app: Application | null = null
let layerContainer: Container | null = null
let initSeq = 0

// Per-sprite metadata so we know when to redraw
const layerSprites = new Map<string, Graphics>()
const spriteLayerMeta = new Map<string, { shape: ShapeType; color: number }>()

// Drag state — purely visual during drag; committed to store on release
type DragState = {
  layerId: string
  sprite: Graphics
  startPointerX: number
  startPointerY: number
  startSpriteX: number
  startSpriteY: number
}
let drag: DragState | null = null

// ─── Init / Destroy ──────────────────────────────────────────────────────────

export async function initPixi(canvas: HTMLCanvasElement): Promise<void> {
  const seq = ++initSeq
  const localApp = new Application()

  await localApp.init({
    canvas,
    resizeTo: canvas.parentElement ?? canvas,
    background: '#111827',
    antialias: true,
    autoDensity: true,
    resolution: window.devicePixelRatio || 1,
  })

  if (seq !== initSeq) {
    localApp.destroy(false)
    return
  }

  app = localApp

  layerContainer = new Container()
  app.stage.addChild(layerContainer)

  // Stage must be interactive to receive pointermove/up for drag
  app.stage.eventMode = 'static'
  app.stage.hitArea = app.screen
  app.stage.on('pointermove', onStageDragMove)
  app.stage.on('pointerup', onStageDragEnd)
  app.stage.on('pointerupoutside', onStageDragEnd)

  app.ticker.add(onTick)
}

export function destroyPixi(): void {
  initSeq++
  if (!app) return
  app.ticker.remove(onTick)
  app.stage.off('pointermove', onStageDragMove)
  app.stage.off('pointerup', onStageDragEnd)
  app.stage.off('pointerupoutside', onStageDragEnd)
  app.destroy(false)
  app = null
  layerSprites.clear()
  spriteLayerMeta.clear()
  layerContainer = null
  drag = null
}

// ─── Shape drawing ───────────────────────────────────────────────────────────

function drawShape(g: Graphics, shape: ShapeType, color: number): void {
  g.clear()
  g.fill({ color, alpha: 1 })
  g.stroke({ color: 0xffffff, alpha: 0.25, width: 2 })

  switch (shape) {
    case 'rect':
      g.roundRect(-40, -40, 80, 80, 10)
      break
    case 'circle':
      g.circle(0, 0, 44)
      break
    case 'star':
      drawStar(g, 0, 0, 5, 44, 20)
      break
    case 'triangle':
      g.poly([0, -44, 44, 38, -44, 38])
      break
  }

  g.fill()
  g.stroke()
}

function drawStar(g: Graphics, cx: number, cy: number, points: number, outer: number, inner: number): void {
  const step = Math.PI / points
  const verts: number[] = []
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outer : inner
    const angle = i * step - Math.PI / 2
    verts.push(cx + r * Math.cos(angle), cy + r * Math.sin(angle))
  }
  g.poly(verts)
}

// ─── Sprite management ───────────────────────────────────────────────────────

function getOrCreateSprite(layer: Layer): Graphics {
  const existing = layerSprites.get(layer.id)
  const meta = spriteLayerMeta.get(layer.id)

  if (existing && meta && meta.shape === layer.shape && meta.color === layer.color) {
    return existing
  }

  // Create new or redraw on shape/color change
  if (existing) {
    drawShape(existing, layer.shape, layer.color)
    spriteLayerMeta.set(layer.id, { shape: layer.shape, color: layer.color })
    return existing
  }

  const g = new Graphics()
  drawShape(g, layer.shape, layer.color)

  g.eventMode = 'static'
  g.cursor = 'grab'

  g.on('pointerdown', (e: FederatedPointerEvent) => {
    if (!app) return
    e.stopPropagation()

    const { setActiveLayer, setIsPlaying } = useStore.getState()
    setActiveLayer(layer.id)
    setIsPlaying(false)

    drag = {
      layerId: layer.id,
      sprite: g,
      startPointerX: e.globalX,
      startPointerY: e.globalY,
      startSpriteX: g.x,
      startSpriteY: g.y,
    }
    g.cursor = 'grabbing'
  })

  layerContainer!.addChild(g)
  layerSprites.set(layer.id, g)
  spriteLayerMeta.set(layer.id, { shape: layer.shape, color: layer.color })
  return g
}

function removeStaleLayers(activeLayers: Layer[]): void {
  const activeIds = new Set(activeLayers.map((l) => l.id))
  for (const [id, sprite] of layerSprites) {
    if (!activeIds.has(id)) {
      sprite.destroy()
      layerSprites.delete(id)
      spriteLayerMeta.delete(id)
    }
  }
}

// ─── Drag handlers ───────────────────────────────────────────────────────────

function onStageDragMove(e: FederatedPointerEvent): void {
  if (!drag) return
  drag.sprite.x = drag.startSpriteX + (e.globalX - drag.startPointerX)
  drag.sprite.y = drag.startSpriteY + (e.globalY - drag.startPointerY)
}

function onStageDragEnd(): void {
  if (!drag) return

  const { layerId, sprite } = drag
  drag.sprite.cursor = 'grab'
  drag = null

  // Commit final position to the store as a keyframe upsert
  const { project, activeSceneId, currentFrame, addKeyframe } = useStore.getState()
  if (!project || !activeSceneId) return

  const scene = project.scenes.find((s) => s.id === activeSceneId)
  const layer = scene?.layers.find((l) => l.id === layerId)
  if (!layer) return

  // Interpolate current non-positional state to preserve scale/rotation/alpha
  const current = interpolateLayer(layer.keyframes, currentFrame)

  addKeyframe(layerId, {
    frame: currentFrame,
    x: sprite.x,
    y: sprite.y,
    scaleX: current?.scaleX ?? 1,
    scaleY: current?.scaleY ?? 1,
    rotation: current?.rotation ?? 0,
    alpha: current?.alpha ?? 1,
    easing: layer.keyframes.find((kf) => kf.frame === currentFrame)?.easing ?? 'ease-in-out',
  })
}

// ─── Ticker ──────────────────────────────────────────────────────────────────

function onTick(): void {
  const state = useStore.getState()
  const { project, activeSceneId, currentFrame, isPlaying, setCurrentFrame, setIsPlaying } = state

  if (!project || !activeSceneId || !app) return

  const scene = project.scenes.find((s) => s.id === activeSceneId)
  if (!scene) return

  const visibleLayers = scene.layers.filter((l) => l.visible)
  removeStaleLayers(visibleLayers)

  for (const layer of visibleLayers) {
    const sprite = getOrCreateSprite(layer)

    // Don't override position while user is dragging this layer
    if (drag?.layerId === layer.id) continue

    const objState = interpolateLayer(layer.keyframes, currentFrame)
    if (!objState) {
      sprite.visible = false
      continue
    }
    sprite.visible = true
    sprite.x = objState.x
    sprite.y = objState.y
    sprite.scale.set(objState.scaleX, objState.scaleY)
    sprite.rotation = (objState.rotation * Math.PI) / 180
    sprite.alpha = objState.alpha
  }

  if (isPlaying) {
    const nextFrame = currentFrame + 1
    if (nextFrame >= project.duration) {
      setCurrentFrame(0)
      setIsPlaying(false)
    } else {
      setCurrentFrame(nextFrame)
    }
  }
}
