import { Application, Graphics, Container, Rectangle, FederatedPointerEvent } from 'pixi.js'
import { useStore } from '../store/use-store'
import { interpolateLayer, getActiveStrokes } from '../lib/interpolate'
import type { Layer, ShapeType, Stroke } from '../types'
import { nanoid } from '../lib/nanoid'
import { smoothStroke } from '../lib/smooth-stroke'

let app: Application | null = null
let layerContainer: Container | null = null
let ghostContainer: Container | null = null
let selectionContainer: Container | null = null
let liveStrokeGraphics: Graphics | null = null
let drawOverlay: Graphics | null = null
let initSeq = 0

const layerSprites = new Map<string, Graphics>()
const spriteLayerMeta = new Map<string, { shape: ShapeType; color: number; strokeCount: number; celFrame: number }>()
const ghostSprites = new Map<string, Graphics>()

// ─── Selection handles ────────────────────────────────────────────────────────

const HANDLE_HALF = 54  // half-size of the bounding box in local shape space
const HANDLE_PX = 8     // visual size of corner handle square

// 4 corner handles + 1 rotation handle
const cornerHandles: Graphics[] = []
let rotHandle: Graphics | null = null
let selBox: Graphics | null = null

type HandleDrag =
  | { type: 'scale'; cx: 1 | -1; cy: 1 | -1; spx: number; spy: number; rot: number }
  | { type: 'rotate'; startAngle: number; startRot: number; spx: number; spy: number }
let handleDrag: HandleDrag | null = null

type DragState = {
  layerId: string
  sprite: Graphics
  startPointerX: number
  startPointerY: number
  startSpriteX: number
  startSpriteY: number
}
let drag: DragState | null = null

let livePoints: { x: number; y: number }[] = []
let isDrawing = false
let playbackAccumMs = 0

const ONION_OFFSETS = [-2, -1, 1, 2]
const ONION_TINT_PREV = 0xff5555
const ONION_TINT_NEXT = 0x55aaff
const ONION_ALPHA = [0.15, 0.3, 0.3, 0.15]

// ─── Selection handle helpers ─────────────────────────────────────────────────

/** Commits the sprite's current transform as a keyframe so handle drags have a base. */
function commitSpriteAsKeyframe(layerId: string, sprite: Graphics): void {
  const { project, activeSceneId, currentFrame, addKeyframe } = useStore.getState()
  const layer = project?.scenes.find(s => s.id === activeSceneId)?.layers.find(l => l.id === layerId)
  if (!layer) return
  const existing = layer.keyframes.find(kf => kf.frame === currentFrame)
  addKeyframe(layerId, {
    frame: currentFrame, x: sprite.x, y: sprite.y,
    scaleX: sprite.scale.x, scaleY: sprite.scale.y,
    rotation: (sprite.rotation * 180) / Math.PI,
    alpha: existing?.alpha ?? 1,
    easing: existing?.easing ?? 'ease-in-out',
    strokes: existing?.strokes ?? [],
  })
}

function initSelectionHandles(): void {
  if (!selectionContainer) return

  selBox = new Graphics()
  selBox.eventMode = 'none'
  selectionContainer.addChild(selBox)

  const corners: [1 | -1, 1 | -1][] = [[-1, -1], [1, -1], [1, 1], [-1, 1]]
  for (const [cx, cy] of corners) {
    const g = new Graphics()
    g.eventMode = 'static'
    g.cursor = 'nwse-resize'
    g.hitArea = new Rectangle(-8, -8, 16, 16)
    g.on('pointerdown', (e: FederatedPointerEvent) => {
      e.stopPropagation()
      const { activeLayerId } = useStore.getState()
      if (!activeLayerId) return
      const sprite = layerSprites.get(activeLayerId)
      if (!sprite) return
      commitSpriteAsKeyframe(activeLayerId, sprite)
      handleDrag = { type: 'scale', cx, cy, spx: sprite.x, spy: sprite.y, rot: sprite.rotation }
    })
    cornerHandles.push(g)
    selectionContainer.addChild(g)
  }

  rotHandle = new Graphics()
  rotHandle.eventMode = 'static'
  rotHandle.cursor = 'crosshair'
  rotHandle.hitArea = new Rectangle(-8, -8, 16, 16)
  rotHandle.on('pointerdown', (e: FederatedPointerEvent) => {
    e.stopPropagation()
    const { activeLayerId } = useStore.getState()
    if (!activeLayerId) return
    const sprite = layerSprites.get(activeLayerId)
    if (!sprite) return
    commitSpriteAsKeyframe(activeLayerId, sprite)
    handleDrag = {
      type: 'rotate',
      startAngle: Math.atan2(e.globalY - sprite.y, e.globalX - sprite.x),
      startRot: sprite.rotation,
      spx: sprite.x, spy: sprite.y,
    }
  })
  selectionContainer.addChild(rotHandle)
}

function onHandleStageDragMove(e: FederatedPointerEvent): void {
  if (!handleDrag) return
  const { activeLayerId, updateKeyframe, currentFrame } = useStore.getState()
  if (!activeLayerId) return
  const sprite = layerSprites.get(activeLayerId)
  if (!sprite) return

  if (handleDrag.type === 'scale') {
    const { cx, cy, spx, spy, rot } = handleDrag
    const dx = e.globalX - spx
    const dy = e.globalY - spy
    const cos = Math.cos(-rot)
    const sin = Math.sin(-rot)
    const localX = dx * cos - dy * sin
    const localY = dx * sin + dy * cos
    const newSx = Math.max(0.1, (localX * cx) / HANDLE_HALF)
    const newSy = Math.max(0.1, (localY * cy) / HANDLE_HALF)
    sprite.scale.set(newSx, newSy)
    updateKeyframe(activeLayerId, currentFrame, { scaleX: newSx, scaleY: newSy })
  } else {
    const { startAngle, startRot, spx, spy } = handleDrag
    const angle = Math.atan2(e.globalY - spy, e.globalX - spx)
    const newRot = startRot + (angle - startAngle)
    sprite.rotation = newRot
    updateKeyframe(activeLayerId, currentFrame, { rotation: (newRot * 180) / Math.PI })
  }
}

function onHandleStageDragEnd(): void {
  handleDrag = null
}

function positionSelectionHandles(sprite: Graphics): void {
  if (!selectionContainer || !selBox) return
  selectionContainer.visible = true
  selectionContainer.x = sprite.x
  selectionContainer.y = sprite.y
  selectionContainer.rotation = sprite.rotation
  // No container scale — we manually place handles at scaled positions
  const hw = HANDLE_HALF * Math.abs(sprite.scale.x)
  const hh = HANDLE_HALF * Math.abs(sprite.scale.y)

  selBox.clear()
  selBox.stroke({ color: 0x6366f1, width: 1, alpha: 0.8 })
  selBox.rect(-hw, -hh, hw * 2, hh * 2)
  selBox.stroke()
  selBox.stroke({ color: 0x6366f1, width: 1, alpha: 0.5 })
  selBox.moveTo(0, -hh)
  selBox.lineTo(0, -(hh + 20))
  selBox.stroke()

  const positions: [number, number][] = [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]]
  cornerHandles.forEach((g, i) => {
    g.clear()
    g.fill({ color: 0xffffff })
    g.stroke({ color: 0x6366f1, width: 1.5 })
    g.rect(-HANDLE_PX / 2, -HANDLE_PX / 2, HANDLE_PX, HANDLE_PX)
    g.fill()
    g.stroke()
    g.x = positions[i][0]
    g.y = positions[i][1]
  })

  if (rotHandle) {
    rotHandle.clear()
    rotHandle.fill({ color: 0xffffff })
    rotHandle.stroke({ color: 0x6366f1, width: 1.5 })
    rotHandle.circle(0, 0, HANDLE_PX / 2)
    rotHandle.fill()
    rotHandle.stroke()
    rotHandle.y = -(hh + 20)
  }
}

function hideSelectionHandles(): void {
  if (selectionContainer) selectionContainer.visible = false
}

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

  if (seq !== initSeq) { localApp.destroy(false); return }

  app = localApp

  ghostContainer = new Container()
  layerContainer = new Container()
  selectionContainer = new Container()
  selectionContainer.eventMode = 'static'
  selectionContainer.visible = false
  liveStrokeGraphics = new Graphics()

  // Overlay sits on top — intercepts all pointer events in draw mode
  drawOverlay = new Graphics()
  drawOverlay.eventMode = 'none'
  drawOverlay.hitArea = new Rectangle(-10000, -10000, 20000, 20000)
  drawOverlay.on('pointerdown', onDrawStart)
  drawOverlay.on('pointermove', onDrawMove)
  drawOverlay.on('pointerup', onDrawEnd)
  drawOverlay.on('pointerupoutside', onDrawEnd)

  app.stage.addChild(ghostContainer)
  app.stage.addChild(layerContainer)
  app.stage.addChild(selectionContainer)
  app.stage.addChild(liveStrokeGraphics)
  app.stage.addChild(drawOverlay)

  app.stage.eventMode = 'static'
  app.stage.hitArea = app.screen
  app.stage.on('pointermove', onStageDragMove)
  app.stage.on('pointermove', onHandleStageDragMove)
  app.stage.on('pointerup', onStageDragEnd)
  app.stage.on('pointerup', onHandleStageDragEnd)
  app.stage.on('pointerupoutside', onStageDragEnd)
  app.stage.on('pointerupoutside', onHandleStageDragEnd)

  initSelectionHandles()
  app.ticker.add(onTick)
}

export function destroyPixi(): void {
  initSeq++
  if (!app) return
  app.ticker.remove(onTick)
  app.stage.off('pointermove', onStageDragMove)
  app.stage.off('pointermove', onHandleStageDragMove)
  app.stage.off('pointerup', onStageDragEnd)
  app.stage.off('pointerup', onHandleStageDragEnd)
  app.stage.off('pointerupoutside', onStageDragEnd)
  app.stage.off('pointerupoutside', onHandleStageDragEnd)
  app.destroy(false)
  app = null
  layerSprites.clear()
  spriteLayerMeta.clear()
  ghostSprites.clear()
  cornerHandles.length = 0
  rotHandle = null
  selBox = null
  layerContainer = null
  ghostContainer = null
  selectionContainer = null
  liveStrokeGraphics = null
  drawOverlay = null
  drag = null
  handleDrag = null
  livePoints = []
  isDrawing = false
}

// ─── Shape drawing ───────────────────────────────────────────────────────────

function drawShape(g: Graphics, shape: ShapeType, color: number): void {
  g.clear()
  g.fill({ color, alpha: 1 })
  g.stroke({ color: 0xffffff, alpha: 0.25, width: 2 })
  switch (shape) {
    case 'rect':     g.roundRect(-40, -40, 80, 80, 10); break
    case 'circle':   g.circle(0, 0, 44); break
    case 'star':     drawStar(g, 0, 0, 5, 44, 20); break
    case 'triangle': g.poly([0, -44, 44, 38, -44, 38]); break
    case 'drawing':  break // handled separately
  }
  if (shape !== 'drawing') { g.fill(); g.stroke() }
}

function drawStar(g: Graphics, cx: number, cy: number, points: number, outer: number, inner: number): void {
  const step = Math.PI / points
  const verts: number[] = []
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outer : inner
    const a = i * step - Math.PI / 2
    verts.push(cx + r * Math.cos(a), cy + r * Math.sin(a))
  }
  g.poly(verts)
}

function renderStrokes(g: Graphics, strokes: Stroke[]): void {
  g.clear()
  for (const stroke of strokes) {
    if (stroke.points.length < 2) continue
    g.moveTo(stroke.points[0].x, stroke.points[0].y)
    for (let i = 1; i < stroke.points.length; i++) {
      g.lineTo(stroke.points[i].x, stroke.points[i].y)
    }
    g.stroke({ color: stroke.color, width: stroke.width, cap: 'round', join: 'round' })
  }
}

function renderLiveStroke(points: { x: number; y: number }[]): void {
  if (!liveStrokeGraphics || points.length < 2) return
  const { drawColor, drawWidth } = useStore.getState()
  liveStrokeGraphics.clear()
  liveStrokeGraphics.moveTo(points[0].x, points[0].y)
  for (let i = 1; i < points.length; i++) liveStrokeGraphics.lineTo(points[i].x, points[i].y)
  liveStrokeGraphics.stroke({ color: drawColor, width: drawWidth, cap: 'round', join: 'round' })
}

// ─── Sprite management ───────────────────────────────────────────────────────

function getOrCreateSprite(layer: Layer): Graphics {
  let g = layerSprites.get(layer.id)

  if (!g) {
    g = new Graphics()
    g.eventMode = 'static'
    g.cursor = 'grab'
    g.on('pointerdown', (e: FederatedPointerEvent) => {
      if (!app) return
      const { tool } = useStore.getState()
      if (tool === 'draw') return // overlay handles it
      e.stopPropagation()
      useStore.getState().setActiveLayer(layer.id)
      useStore.getState().setIsPlaying(false)
      drag = {
        layerId: layer.id, sprite: g!,
        startPointerX: e.globalX, startPointerY: e.globalY,
        startSpriteX: g!.x, startSpriteY: g!.y,
      }
      g!.cursor = 'grabbing'
    })
    layerContainer!.addChild(g)
    layerSprites.set(layer.id, g)
  }

  const meta = spriteLayerMeta.get(layer.id)

  if (layer.shape === 'drawing') {
    // Redrawn per-tick by onTick via currentFrame — just ensure eventMode is right
    g.eventMode = 'none'
    g.cursor = 'default'
  } else {
    if (!meta || meta.shape !== layer.shape || meta.color !== layer.color) {
      drawShape(g, layer.shape, layer.color)
      spriteLayerMeta.set(layer.id, { shape: layer.shape, color: layer.color, strokeCount: 0, celFrame: -1 })
    }
    g.eventMode = 'static'
    g.cursor = drag?.layerId === layer.id ? 'grabbing' : 'grab'
  }

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

// ─── Onion skinning ──────────────────────────────────────────────────────────

function updateGhosts(visibleLayers: Layer[], currentFrame: number): void {
  const neededKeys = new Set<string>()

  for (const layer of visibleLayers) {
    for (let i = 0; i < ONION_OFFSETS.length; i++) {
      const offset = ONION_OFFSETS[i]
      const ghostFrame = currentFrame + offset
      if (ghostFrame < 0) continue

      const key = `${layer.id}:${offset}`
      neededKeys.add(key)

      let g = ghostSprites.get(key)
      if (!g) {
        g = new Graphics()
        g.eventMode = 'none'
        ghostContainer!.addChild(g)
        ghostSprites.set(key, g)
      }

      if (layer.shape === 'drawing') {
        renderStrokes(g, getActiveStrokes(layer.keyframes, ghostFrame))
      } else {
        drawShape(g, layer.shape, layer.color)
      }

      g.tint = offset < 0 ? ONION_TINT_PREV : ONION_TINT_NEXT

      const objState = interpolateLayer(layer.keyframes, ghostFrame)
      if (!objState || layer.shape === 'drawing') {
        if (layer.shape === 'drawing') {
          g.visible = true
          g.alpha = ONION_ALPHA[i]
        } else {
          g.visible = false
        }
        continue
      }
      g.visible = true
      g.x = objState.x; g.y = objState.y
      g.scale.set(objState.scaleX, objState.scaleY)
      g.rotation = (objState.rotation * Math.PI) / 180
      g.alpha = ONION_ALPHA[i]
    }
  }

  for (const [key, g] of ghostSprites) {
    if (!neededKeys.has(key)) { g.destroy(); ghostSprites.delete(key) }
  }
}

function hideAllGhosts(): void {
  for (const g of ghostSprites.values()) g.visible = false
}

// ─── Draw handlers ───────────────────────────────────────────────────────────

function onDrawStart(e: FederatedPointerEvent): void {
  isDrawing = true
  livePoints = [{ x: e.globalX, y: e.globalY }]
  if (liveStrokeGraphics) liveStrokeGraphics.clear()
}

function onDrawMove(e: FederatedPointerEvent): void {
  if (!isDrawing) return
  livePoints.push({ x: e.globalX, y: e.globalY })
  renderLiveStroke(livePoints)
}

function onDrawEnd(): void {
  if (!isDrawing) return
  isDrawing = false
  if (liveStrokeGraphics) liveStrokeGraphics.clear()

  const pts = livePoints
  livePoints = []
  if (pts.length < 2) return

  const { activeLayerId, drawColor, drawWidth, drawSmoothing, addStroke, updateLayer, project, activeSceneId } = useStore.getState()
  if (!activeLayerId) return

  // Auto-convert layer to drawing type so strokes are rendered
  const layer = project?.scenes.find((s) => s.id === activeSceneId)?.layers.find((l) => l.id === activeLayerId)
  if (layer && layer.shape !== 'drawing') {
    updateLayer(activeLayerId, { shape: 'drawing' })
  }

  const smoothedPts = smoothStroke(pts, drawSmoothing)
  const stroke: Stroke = { id: nanoid(), color: drawColor, width: drawWidth, points: smoothedPts }
  addStroke(activeLayerId, stroke)
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

  const { project, activeSceneId, currentFrame, addKeyframe } = useStore.getState()
  if (!project || !activeSceneId) return
  const scene = project.scenes.find((s) => s.id === activeSceneId)
  const layer = scene?.layers.find((l) => l.id === layerId)
  if (!layer) return
  const current = interpolateLayer(layer.keyframes, currentFrame)
  const existingKf = layer.keyframes.find((kf) => kf.frame === currentFrame)
  addKeyframe(layerId, {
    frame: currentFrame, x: sprite.x, y: sprite.y,
    scaleX: current?.scaleX ?? 1, scaleY: current?.scaleY ?? 1,
    rotation: current?.rotation ?? 0, alpha: current?.alpha ?? 1,
    easing: existingKf?.easing ?? 'ease-in-out',
    strokes: existingKf?.strokes ?? [],
  })
}

// ─── Ticker ──────────────────────────────────────────────────────────────────

function onTick(): void {
  const state = useStore.getState()
  const { project, activeSceneId, currentFrame, isPlaying, onionSkinEnabled, tool, setCurrentFrame, setIsPlaying } = state

  if (!project || !activeSceneId || !app) return
  const scene = project.scenes.find((s) => s.id === activeSceneId)
  if (!scene) return

  // Sync draw overlay — active in draw mode when not playing
  if (drawOverlay) {
    const drawActive = tool === 'draw' && !isPlaying
    drawOverlay.eventMode = drawActive ? 'static' : 'none'
    if (app) app.renderer.canvas.style.cursor = drawActive ? 'crosshair' : ''
  }

  const visibleLayers = scene.layers.filter((l) => l.visible)
  removeStaleLayers(visibleLayers)

  if (onionSkinEnabled && !isPlaying) {
    updateGhosts(visibleLayers, currentFrame)
  } else {
    hideAllGhosts()
  }

  const { activeLayerId } = state
  let activeSprite: Graphics | null = null

  for (const layer of visibleLayers) {
    const sprite = getOrCreateSprite(layer)
    if (drag?.layerId === layer.id) continue

    if (layer.shape === 'drawing') {
      const sorted = [...layer.keyframes].sort((a, b) => a.frame - b.frame)
      const prevKf = [...sorted].reverse().find((kf) => kf.frame <= currentFrame) ?? sorted[0]
      const celFrame = prevKf?.frame ?? -1

      // Redraw current cel if it changed
      const meta = spriteLayerMeta.get(layer.id)
      const strokes = prevKf?.strokes ?? []
      if (!meta || meta.celFrame !== celFrame || meta.strokeCount !== strokes.length) {
        renderStrokes(sprite, strokes)
        spriteLayerMeta.set(layer.id, { shape: 'drawing', color: 0, strokeCount: strokes.length, celFrame })
      }
      sprite.x = 0; sprite.y = 0; sprite.scale.set(1, 1); sprite.rotation = 0
      sprite.visible = true
      sprite.alpha = 1
    } else {
      const objState = interpolateLayer(layer.keyframes, currentFrame)
      if (!objState) { sprite.visible = false; continue }
      sprite.visible = true
      sprite.x = objState.x; sprite.y = objState.y
      sprite.scale.set(objState.scaleX, objState.scaleY)
      sprite.rotation = (objState.rotation * Math.PI) / 180
      sprite.alpha = objState.alpha
      if (layer.id === activeLayerId) activeSprite = sprite
    }
  }

  // Show selection handles on active non-drawing shape layer, hide otherwise
  const activeLayer = scene.layers.find(l => l.id === activeLayerId)
  if (activeSprite && activeLayer && activeLayer.shape !== 'drawing' && tool === 'select' && !isPlaying && !drag) {
    positionSelectionHandles(activeSprite)
  } else {
    hideSelectionHandles()
  }

  if (isPlaying) {
    playbackAccumMs += app.ticker.deltaMS
    const msPerFrame = 1000 / project.fps
    if (playbackAccumMs >= msPerFrame) {
      playbackAccumMs -= msPerFrame
      const nextFrame = currentFrame + 1
      if (nextFrame >= project.duration) {
        setCurrentFrame(0); setIsPlaying(false); playbackAccumMs = 0
      } else {
        setCurrentFrame(nextFrame)
      }
    }
  } else {
    playbackAccumMs = 0
  }
}
